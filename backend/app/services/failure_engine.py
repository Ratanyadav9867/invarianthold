from typing import List, Dict, Any, Optional
import datetime
from sqlalchemy.orm import Session
from app.models.component import Component
from app.models.invariant import TrafficPath, SecurityInvariant
from app.services.graph_engine import GraphEngine
from app.services.invariant_engine import InvariantEngine

class FailureEngine:
    """
    Failure Simulator & Targeted Fail-Safe Engine.
    Executes precision failure injection, identifies dependent paths via graph topology,
    and isolates ONLY unsafe traffic paths while preserving unrelated safe traffic.
    """

    @classmethod
    def inject_failure(
        cls,
        db: Session,
        component_ids: List[str],
        failure_type: str = "MANUAL_INJECTION"
    ) -> Dict[str, Any]:
        """
        Inject failure into one or more enforcement components.
        Applies Targeted Fail-Safe exclusively to affected unsafe paths.
        """
        if not component_ids:
            return {"error": "No component IDs provided."}

        # 1. Update component statuses in DB
        components = db.query(Component).filter(Component.id.in_(component_ids)).all()
        if not components:
            return {"error": f"Components {component_ids} not found."}

        now = datetime.datetime.now(datetime.timezone.utc)
        for comp in components:
            comp.status = "FAILED"
            comp.health_score = 0.0
            comp.failure_count += 1
            comp.last_failure_at = now

        db.commit()

        # 2. Reload graph engine
        graph_engine = GraphEngine(db)

        # 3. Identify affected paths using graph dependency mapping
        dependency_map = graph_engine.build_dependency_map(db)
        affected_path_ids = set()
        for comp_id in component_ids:
            affected_path_ids.update(dependency_map.get(comp_id, []))

        all_paths = db.query(TrafficPath).filter(TrafficPath.is_active == True).all()
        total_paths = len(all_paths)

        affected_paths_records = []
        safe_paths_records = []
        structured_explanations = []

        # 4. Evaluate paths and apply Targeted Fail-Safe
        for path in all_paths:
            if path.id in affected_path_ids:
                # Path depends on failed component -> verify invariant
                eval_res = InvariantEngine.verify_path(db, path, graph_engine)
                
                if eval_res["verdict"] == "VIOLATED":
                    # Engage Targeted Fail-Safe: ISOLATE THIS PATH
                    path.status = "BLOCKED"
                    path.decision_reason = (
                        f"Targeted Fail-Safe: Path isolated because invariant '{eval_res['invariant_name']}' "
                        f"cannot be guaranteed. Failed component(s): {eval_res['failed_components']}."
                    )
                    path.last_verified_at = now

                    # Build structured explanation object (Mandatory PRD Requirement)
                    explanation = {
                        "path_id": path.id,
                        "path_name": path.name,
                        "source": path.source_node,
                        "destination": path.destination_node,
                        "hops": path.current_hops,
                        "decision": "BLOCKED",
                        "reason": f"Required control point {component_ids} became unavailable.",
                        "broken_invariant": eval_res["invariant_name"],
                        "invariant_id": eval_res["invariant_id"],
                        "required_controls": eval_res["required_controls"],
                        "failed_controls": [c.type for c in components if c.id in eval_res["failed_components"]],
                        "failed_components": eval_res["failed_components"],
                        "affected_boundary": "PCI" if "PCI" in path.destination_node else "INTERNAL",
                        "alternate_route_available": bool(path.alternate_hops)
                    }
                    structured_explanations.append(explanation)
                    affected_paths_records.append(path.to_dict())
                else:
                    path.status = eval_res["verdict"]
                    path.decision_reason = eval_res["reason"]
                    path.last_verified_at = now
                    safe_paths_records.append(path.to_dict())
            else:
                # Path does NOT depend on failed component -> remains GUARANTEED
                eval_res = InvariantEngine.verify_path(db, path, graph_engine)
                path.status = eval_res["verdict"]
                path.decision_reason = eval_res["reason"]
                path.last_verified_at = now
                if path.status == "GUARANTEED":
                    safe_paths_records.append(path.to_dict())

        db.commit()

        # 5. Calculate exact dynamic metrics
        blocked_count = len(affected_paths_records)
        safe_count = len(safe_paths_records)
        safe_preservation_pct = round((safe_count / total_paths * 100), 1) if total_paths > 0 else 0.0

        return {
            "action": "FAILURE_INJECTED",
            "failed_components": component_ids,
            "failure_type": failure_type,
            "total_paths": total_paths,
            "affected_paths_count": blocked_count,
            "safe_paths_count": safe_count,
            "safe_path_preservation_pct": safe_preservation_pct,
            "affected_paths": affected_paths_records,
            "safe_paths": safe_paths_records,
            "explanations": structured_explanations,
            "summary_message": (
                f"{blocked_count} path(s) isolated by Targeted Fail-Safe. "
                f"{safe_count} safe path(s) ({safe_preservation_pct}%) remain operational."
            )
        }

    @classmethod
    def recover_component(cls, db: Session, component_id: str) -> Dict[str, Any]:
        """
        Recover a single failed component to HEALTHY status.
        Re-verifies affected paths and restores them only if the invariant is GUARANTEED.
        """
        comp = db.query(Component).filter(Component.id == component_id).first()
        if not comp:
            return {"error": f"Component {component_id} not found."}

        comp.status = "HEALTHY"
        comp.health_score = 1.0
        db.commit()

        # Reload graph
        graph_engine = GraphEngine(db)
        now = datetime.datetime.now(datetime.timezone.utc)

        # Re-verify all paths
        paths = db.query(TrafficPath).filter(TrafficPath.is_active == True).all()
        recovered_paths = []
        still_blocked_paths = []

        for path in paths:
            eval_res = InvariantEngine.verify_path(db, path, graph_engine)
            if eval_res["verdict"] == "GUARANTEED":
                if path.status == "BLOCKED":
                    recovered_paths.append(path.id)
                path.status = "GUARANTEED"
                path.decision_reason = f"Component {component_id} restored. Invariant '{eval_res['invariant_name']}' guaranteed."
            else:
                if path.status == "BLOCKED":
                    still_blocked_paths.append(path.id)
                path.status = eval_res["verdict"]
                path.decision_reason = eval_res["reason"]
            path.last_verified_at = now

        db.commit()

        return {
            "action": "COMPONENT_RECOVERED",
            "component_id": component_id,
            "status": "HEALTHY",
            "recovered_paths": recovered_paths,
            "still_blocked_paths": still_blocked_paths,
            "summary_message": f"Component {component_id} recovered. {len(recovered_paths)} path(s) restored to GUARANTEED."
        }

    @classmethod
    def recover_all(cls, db: Session) -> Dict[str, Any]:
        """Restore all components to HEALTHY status and re-verify all paths."""
        components = db.query(Component).all()
        for comp in components:
            comp.status = "HEALTHY"
            comp.health_score = 1.0

        db.commit()

        # Reload graph
        graph_engine = GraphEngine(db)
        verification_summary = InvariantEngine.verify_all_paths(db, graph_engine)

        return {
            "action": "ALL_COMPONENTS_RECOVERED",
            "total_components": len(components),
            "verification_summary": verification_summary,
            "summary_message": "All components restored to HEALTHY. All invariants re-verified."
        }
