"""
Autonomous Safe Recovery Engine.

Extends ReroutingEngine with three operational modes:
  MONITOR     — Observe and report; no automatic action.
  RECOMMEND   — Find and return guaranteed routes; no DB modification.
  AUTO        — Execute rerouting to guaranteed routes and verify traffic.

CRITICAL SAFETY RULES:
  1. A route is ONLY accepted if InvariantEngine returns verdict == "GUARANTEED".
  2. If no guaranteed path exists: traffic is isolated, NOT rerouted.
  3. ML/AI cannot make the final routing decision.
  4. The fail-closed guarantee: unsafe_traffic_delivered MUST == 0 after recovery.
"""
import datetime
from typing import Any

from app.models.component import Component
from app.models.invariant import TrafficPath
from app.services.audit_engine import AuditEngine
from app.services.graph_engine import GraphEngine
from app.services.invariant_engine import InvariantEngine
from app.services.rerouting_engine import ReroutingEngine
from sqlalchemy.orm import Session

# ─── Recovery Mode ─────────────────────────────────────────────────────────────
VALID_MODES = {"MONITOR", "RECOMMEND", "AUTO"}
_current_mode: str = "MONITOR"   # Safe default


def get_recovery_mode() -> str:
    return _current_mode


def set_recovery_mode(mode: str) -> str:
    global _current_mode
    if mode not in VALID_MODES:
        raise ValueError(f"Invalid mode '{mode}'. Must be one of {VALID_MODES}.")
    _current_mode = mode
    return _current_mode


class RecoveryEngine:
    """
    Autonomous Safe Recovery with three modes.
    Wraps and extends ReroutingEngine — does not duplicate rerouting logic.
    """

    @classmethod
    def assess(cls, db: Session) -> dict[str, Any]:
        """
        Scan for affected paths, score candidate routes, build recovery plan.
        This is read-only — does NOT modify any DB records.
        """
        graph_engine = GraphEngine(db)

        # Collect affected (blocked/violated) paths
        affected_paths = db.query(TrafficPath).filter(
            TrafficPath.is_active == True,
            TrafficPath.status.in_(["BLOCKED", "VIOLATED", "AT_RISK"])
        ).all()

        failed_components = db.query(Component).filter(
            Component.status.in_(["FAILED", "DEGRADED"])
        ).all()

        path_assessments = []
        for path in affected_paths:
            candidates = graph_engine.find_candidate_alternate_paths(db, path)
            evaluated = []
            guaranteed_candidates = []
            rejected_candidates = []

            for candidate in candidates[:5]:   # evaluate up to 5 candidates
                res = InvariantEngine.verify_path(db, path, graph_engine, hops=candidate)
                entry = {
                    "hops": candidate,
                    "verdict": res["verdict"],
                    "reason": res.get("reason", ""),
                }
                evaluated.append(entry)
                if res["verdict"] == "GUARANTEED":
                    guaranteed_candidates.append(entry)
                else:
                    rejected_candidates.append(entry)

            path_assessments.append({
                "path_id": path.id,
                "path_name": path.name,
                "current_status": path.status,
                "current_hops": path.current_hops or [],
                "candidate_count": len(candidates),
                "guaranteed_routes": guaranteed_candidates,
                "rejected_routes": rejected_candidates,
                "recovery_possible": len(guaranteed_candidates) > 0,
                "recommendation": (
                    f"Reroute to {guaranteed_candidates[0]['hops']}"
                    if guaranteed_candidates
                    else "NO_SAFE_RECOVERY_PATH — traffic must remain isolated"
                ),
            })

        no_safe_path_count = sum(1 for p in path_assessments if not p["recovery_possible"])
        recoverable_count = sum(1 for p in path_assessments if p["recovery_possible"])

        return {
            "mode": get_recovery_mode(),
            "failed_components": [c.id for c in failed_components],
            "affected_paths_count": len(affected_paths),
            "recoverable_paths": recoverable_count,
            "no_safe_path_count": no_safe_path_count,
            "path_assessments": path_assessments,
            "overall_recommendation": (
                f"{recoverable_count} path(s) can be safely recovered. "
                f"{no_safe_path_count} path(s) must remain isolated (no guaranteed route)."
            ),
            "assessed_at": datetime.datetime.now(datetime.UTC).isoformat(),
        }

    @classmethod
    def execute_recovery(
        cls,
        db: Session,
        path_id: str | None = None,
        actor: str = "SYSTEM",
    ) -> dict[str, Any]:
        """
        Execute recovery based on current mode.

        MONITOR   → Returns assessment only. No DB changes.
        RECOMMEND → Returns guaranteed route candidates. No DB changes.
        AUTO      → Executes rerouting via ReroutingEngine (GUARANTEED only).
        """
        mode = get_recovery_mode()

        if mode == "MONITOR":
            assessment = cls.assess(db)
            return {
                "mode": "MONITOR",
                "action": "OBSERVE_ONLY",
                "assessment": assessment,
                "db_modified": False,
                "message": "MONITOR mode: assessment generated, no recovery action taken.",
            }

        elif mode == "RECOMMEND":
            assessment = cls.assess(db)
            return {
                "mode": "RECOMMEND",
                "action": "RECOMMENDATIONS_GENERATED",
                "assessment": assessment,
                "db_modified": False,
                "message": "RECOMMEND mode: guaranteed routes identified. Human approval required to execute.",
            }

        elif mode == "AUTO":
            # Execute rerouting — only to GUARANTEED paths
            if path_id:
                result = ReroutingEngine.attempt_reroute_path(db, path_id)
                rerouted = [result] if result.get("rerouted") else []
                blocked = [] if result.get("rerouted") else [result]
            else:
                result = ReroutingEngine.reroute_all_affected(db)
                rerouted = result.get("rerouted_paths", [])
                blocked = result.get("still_blocked_paths", [])

            # Verify: confirm unsafe_traffic_delivered == 0
            unsafe_count = cls._verify_unsafe_traffic(db)

            # Audit
            AuditEngine.record_event(
                db,
                actor=actor,
                action="AUTO_RECOVERY_EXECUTED",
                target=path_id or "ALL_AFFECTED_PATHS",
                details={
                    "rerouted_count": len(rerouted),
                    "still_blocked_count": len(blocked),
                    "unsafe_traffic_delivered": unsafe_count,
                }
            )

            return {
                "mode": "AUTO",
                "action": "RECOVERY_EXECUTED",
                "rerouted_paths": rerouted,
                "still_blocked_paths": blocked,
                "rerouted_count": len(rerouted),
                "still_blocked_count": len(blocked),
                "unsafe_traffic_delivered": unsafe_count,
                "safety_guarantee": "PASS" if unsafe_count == 0 else "FAIL",
                "db_modified": True,
                "message": (
                    f"AUTO recovery: {len(rerouted)} path(s) rerouted to GUARANTEED routes. "
                    f"{len(blocked)} path(s) remain safely isolated (no safe route available). "
                    f"unsafe_traffic_delivered={unsafe_count}."
                ),
            }

        return {"error": f"Unknown mode: {mode}"}

    @classmethod
    def _verify_unsafe_traffic(cls, db: Session) -> int:
        """
        Verify no unsafe traffic was delivered to blocked paths.
        Returns count of unsafe deliveries (must be 0 for safety guarantee).
        """
        from app.models.traffic import TrafficPacket
        # Count packets delivered to BLOCKED paths (there should be none)
        blocked_path_ids = [
            p.id for p in db.query(TrafficPath).filter(
                TrafficPath.status.in_(["BLOCKED", "VIOLATED"])
            ).all()
        ]
        if not blocked_path_ids:
            return 0

        unsafe = db.query(TrafficPacket).filter(
            TrafficPacket.path_id.in_(blocked_path_ids),
            TrafficPacket.delivered == True,
            TrafficPacket.safe == False,
        ).count()
        return unsafe
