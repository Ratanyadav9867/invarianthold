import datetime
from typing import Any

from app.models.invariant import TrafficPath
from app.services.graph_engine import GraphEngine
from app.services.invariant_engine import InvariantEngine
from sqlalchemy.orm import Session


class ReroutingEngine:
    """
    Safe Rerouting & Self-Healing Engine.
    Searches for alternate topological paths and migrates traffic ONLY
    when the candidate route is mathematically verified GUARANTEED by the Invariant Engine.
    """

    @classmethod
    def attempt_reroute_path(cls, db: Session, path_id: str) -> dict[str, Any]:
        """
        Attempt to discover and migrate an unsafe or blocked path to a compliant alternate route.
        """
        path = db.query(TrafficPath).filter(TrafficPath.id == path_id).first()
        if not path:
            return {"error": f"Path {path_id} not found."}

        graph_engine = GraphEngine(db)

        # Candidate path discovery
        candidates = graph_engine.find_candidate_alternate_paths(db, path)
        if not candidates:
            return {
                "path_id": path.id,
                "rerouted": False,
                "status": path.status,
                "reason": "No topological alternate routes exist between source and destination.",
                "candidate_count": 0
            }

        # Evaluate candidate routes against the deterministic invariant engine
        accepted_route: list[str] | None = None
        rejection_reasons = []

        for candidate in candidates:
            eval_res = InvariantEngine.verify_path(db, path, graph_engine, hops=candidate)
            verdict = eval_res.get("verdict")
            if verdict == "GUARANTEED":
                accepted_route = candidate
                break
            else:
                rejection_reasons.append({
                    "candidate_hops": candidate,
                    "verdict": verdict,
                    "reason": eval_res.get("reason", f"Candidate rejected with status {verdict}")
                })

        now = datetime.datetime.now(datetime.UTC)

        if accepted_route:
            previous_hops = list(path.current_hops or [])
            path.alternate_hops = previous_hops
            path.current_hops = accepted_route
            path.status = "REROUTED"
            path.decision_reason = (
                f"Safe Rerouting Succeeded: Traffic migrated to alternate route {accepted_route}. "
                f"All required security controls verified and GUARANTEED."
            )
            path.last_verified_at = now
            db.commit()

            return {
                "path_id": path.id,
                "rerouted": True,
                "status": "REROUTED",
                "previous_hops": previous_hops,
                "new_hops": accepted_route,
                "decision_reason": path.decision_reason,
                "invariant_guaranteed": True,
                "structured_explanation": {
                    "path_id": path.id,
                    "decision": "REROUTED",
                    "previous_route": previous_hops,
                    "active_route": accepted_route,
                    "verification": "GUARANTEED",
                    "message": "Traffic successfully restored via compliant alternate route."
                }
            }
        else:
            # Candidate routes were rejected by Invariant Engine
            path.status = "BLOCKED"
            path.decision_reason = (
                "Rerouting Aborted: Candidate alternate paths were evaluated, but none satisfied the "
                "security invariant. Path remains BLOCKED to guarantee zero unsafe packet delivery."
            )
            path.last_verified_at = now
            db.commit()

            return {
                "path_id": path.id,
                "rerouted": False,
                "status": "BLOCKED",
                "decision_reason": path.decision_reason,
                "candidate_count": len(candidates),
                "rejections": rejection_reasons,
                "structured_explanation": {
                    "path_id": path.id,
                    "decision": "BLOCKED",
                    "reason": "No compliant alternate path available.",
                    "verification": "REJECTED",
                    "safety_preserved": True
                }
            }

    @classmethod
    def reroute_all_affected(cls, db: Session) -> dict[str, Any]:
        """
        Scan all BLOCKED and VIOLATED paths and attempt compliant reroutes.
        """
        paths = db.query(TrafficPath).filter(
            TrafficPath.is_active == True,
            TrafficPath.status.in_(["BLOCKED", "VIOLATED"])
        ).all()

        rerouted_paths = []
        still_blocked_paths = []

        for path in paths:
            result = cls.attempt_reroute_path(db, path.id)
            if result.get("rerouted"):
                rerouted_paths.append(result)
            else:
                still_blocked_paths.append(result)

        return {
            "action": "BATCH_REROUTE_COMPLETED",
            "total_evaluated": len(paths),
            "rerouted_count": len(rerouted_paths),
            "still_blocked_count": len(still_blocked_paths),
            "rerouted_paths": rerouted_paths,
            "still_blocked_paths": still_blocked_paths,
            "summary_message": (
                f"{len(rerouted_paths)} path(s) successfully rerouted to guaranteed alternate routes. "
                f"{len(still_blocked_paths)} path(s) remain safely isolated."
            )
        }
