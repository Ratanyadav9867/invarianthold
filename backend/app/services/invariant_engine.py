from typing import List, Dict, Any, Optional
import datetime
from sqlalchemy.orm import Session
from app.models.component import Component
from app.models.invariant import SecurityInvariant, TrafficPath
from app.services.graph_engine import GraphEngine

class InvariantEngine:
    """
    Deterministic Invariant Verification Engine.
    This is the mathematical source of truth for the entire platform.
    It does not rely on ML or probabilistic estimation.
    """

    @staticmethod
    def verify_path(
        db: Session,
        path: TrafficPath,
        graph_engine: GraphEngine,
        hops: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Verify whether the given path hops satisfy the applicable security invariant.
        Uses actual node components and their live operational status.
        """
        eval_hops = hops if hops is not None else (path.current_hops or [])
        
        # 1. Fetch applicable invariant
        invariant: Optional[SecurityInvariant] = None
        if path.applicable_invariant_id:
            invariant = db.query(SecurityInvariant).filter(
                SecurityInvariant.id == path.applicable_invariant_id,
                SecurityInvariant.enabled == True
            ).first()

        # If no enabled invariant applies, path is considered GUARANTEED
        if not invariant:
            return {
                "path_id": path.id,
                "verdict": "GUARANTEED",
                "invariant_id": None,
                "invariant_name": "No Invariant Applied",
                "required_controls": [],
                "present_controls": [],
                "missing_controls": [],
                "failed_components": [],
                "healthy_components": [],
                "hops": eval_hops,
                "reason": "No security invariant assigned to this path."
            }

        required_controls = list(invariant.required_controls or [])

        # 2. Extract components along the evaluated hops
        components_on_path = graph_engine.get_path_components(db, eval_hops)
        
        # Map control type -> list of operational components providing it
        control_providers: Dict[str, List[Component]] = {}
        failed_components: List[Component] = []
        healthy_components: List[Component] = []

        for comp in components_on_path:
            if comp.type not in control_providers:
                control_providers[comp.type] = []
            control_providers[comp.type].append(comp)

            if comp.status != "HEALTHY":
                failed_components.append(comp)
            else:
                healthy_components.append(comp)

        # 3. Check for missing controls
        present_control_types = set(control_providers.keys())
        missing_controls = [ctrl for ctrl in required_controls if ctrl not in present_control_types]

        # 4. Check for failed/unhealthy components providing required controls
        failed_required_controls = []
        for ctrl in required_controls:
            if ctrl in control_providers:
                providers = control_providers[ctrl]
                # If ALL providers of this control are degraded/failed, the control is broken
                operational_providers = [p for p in providers if p.status == "HEALTHY"]
                if not operational_providers:
                    failed_required_controls.append(ctrl)

        # 5. Deterministic verdict determination
        if missing_controls:
            verdict = "VIOLATED"
            reason = f"Security invariant '{invariant.name}' broken: Missing required control(s) {missing_controls} on path."
        elif failed_required_controls:
            failed_names = [f"{c.id} ({c.type})" for c in failed_components if c.type in failed_required_controls]
            verdict = "VIOLATED"
            reason = (
                f"Security invariant '{invariant.name}' broken: Required control(s) {failed_required_controls} "
                f"compromised due to failed component(s): {', '.join(failed_names)}."
            )
        else:
            # Check for degraded health (AT_RISK)
            degraded = [c for c in components_on_path if c.health_score < 0.8 or c.status == "DEGRADED"]
            if degraded:
                verdict = "AT_RISK"
                reason = f"Invariant verified, but components degraded: {[c.id for c in degraded]}."
            else:
                verdict = "GUARANTEED"
                reason = f"Invariant '{invariant.name}' fully guaranteed. All required controls {required_controls} are operational."

        return {
            "path_id": path.id,
            "verdict": verdict,
            "invariant_id": invariant.id,
            "invariant_name": invariant.name,
            "required_controls": required_controls,
            "present_controls": list(present_control_types),
            "missing_controls": missing_controls,
            "failed_components": [c.id for c in failed_components],
            "healthy_components": [c.id for c in healthy_components],
            "hops": eval_hops,
            "reason": reason
        }

    @classmethod
    def verify_all_paths(cls, db: Session, graph_engine: GraphEngine) -> Dict[str, Any]:
        """Verify all active paths in the database and update their statuses."""
        paths = db.query(TrafficPath).filter(TrafficPath.is_active == True).all()
        results = {}
        guaranteed_count = 0
        violated_count = 0
        blocked_count = 0

        for path in paths:
            # If path was explicitly BLOCKED by fail-safe, we still evaluate if it's currently viable
            res = cls.verify_path(db, path, graph_engine)
            # If path was BLOCKED and is still violated, preserve BLOCKED status
            if path.status == "BLOCKED" and res["verdict"] == "VIOLATED":
                res["verdict"] = "BLOCKED"
            
            # Update path in DB
            path.status = res["verdict"]
            path.decision_reason = res["reason"]
            path.last_verified_at = datetime.datetime.now(datetime.timezone.utc)
            
            results[path.id] = res
            if res["verdict"] == "GUARANTEED":
                guaranteed_count += 1
            elif res["verdict"] == "BLOCKED":
                blocked_count += 1
            elif res["verdict"] == "VIOLATED":
                violated_count += 1

        db.commit()

        total_paths = len(paths)
        safe_preservation_pct = round((guaranteed_count / total_paths * 100), 1) if total_paths > 0 else 100.0

        return {
            "total_paths": total_paths,
            "guaranteed": guaranteed_count,
            "violated": violated_count,
            "blocked": blocked_count,
            "safe_path_preservation_pct": safe_preservation_pct,
            "results": results
        }
