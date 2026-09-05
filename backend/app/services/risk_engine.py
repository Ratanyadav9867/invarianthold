from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.models.component import Component
from app.models.invariant import TrafficPath, SecurityInvariant

SEVERITY_WEIGHTS = {
    "LOW": 25.0,
    "MEDIUM": 50.0,
    "HIGH": 75.0,
    "CRITICAL": 100.0
}

class RiskEngine:
    """
    Deterministic Risk Scoring Engine.
    Computes a transparent 0-100 risk score based on invariant severity,
    path blast radius, ML anomaly signals, and cascading exposure.
    """

    @classmethod
    def calculate_risk(
        cls,
        db: Session,
        anomaly_score: float = 0.0,
        failed_component_ids: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Calculate composite risk score (0-100) and return full factor breakdown.
        """
        all_paths = db.query(TrafficPath).filter(TrafficPath.is_active == True).all()
        total_paths = len(all_paths)
        if total_paths == 0:
            return cls._empty_risk_response()

        blocked_paths = [p for p in all_paths if p.status in ["BLOCKED", "VIOLATED"]]
        rerouted_paths = [p for p in all_paths if p.status == "REROUTED"]
        affected_count = len(blocked_paths) + len(rerouted_paths)

        # 1. Blast Radius Calculation (0-100)
        blast_radius = (affected_count / total_paths) * 100.0

        # 2. Maximum Invariant Severity Score (0-100)
        invariants = db.query(SecurityInvariant).all()
        active_violated_invariants = set()
        for p in blocked_paths:
            if p.applicable_invariant_id:
                active_violated_invariants.add(p.applicable_invariant_id)

        if active_violated_invariants:
            highest_sev = "LOW"
            for inv in invariants:
                if inv.id in active_violated_invariants:
                    if inv.severity == "CRITICAL":
                        highest_sev = "CRITICAL"
                        break
                    elif inv.severity == "HIGH" and highest_sev in ["LOW", "MEDIUM"]:
                        highest_sev = "HIGH"
                    elif inv.severity == "MEDIUM" and highest_sev == "LOW":
                        highest_sev = "MEDIUM"
            severity_score = SEVERITY_WEIGHTS.get(highest_sev, 50.0)
        elif rerouted_paths:
            severity_score = 35.0  # Rerouted successfully: lower risk
        else:
            severity_score = 0.0  # Healthy baseline

        # 3. Anomaly Score Normalization (0-100)
        # If anomaly_score is 0.0-1.0, scale to 0-100; if already 0-100, clamp
        norm_anomaly_score = min(100.0, max(0.0, anomaly_score * 100.0 if anomaly_score <= 1.0 else anomaly_score))

        # 4. Cascading Risk (0-100)
        # Evaluates multi-component failure depth and cross-boundary dependencies
        failed_comps = db.query(Component).filter(Component.status != "HEALTHY").all()
        failed_count = len(failed_comps)
        pci_impacted = any("PCI" in p.destination_node for p in blocked_paths)
        db_impacted = any("DB" in p.destination_node for p in blocked_paths)

        cascade_score = 0.0
        if failed_count > 1:
            cascade_score += min(50.0, (failed_count - 1) * 25.0)
        if pci_impacted:
            cascade_score += 30.0
        if db_impacted:
            cascade_score += 20.0
        cascading_risk = min(100.0, cascade_score)

        # 5. Composite Formula
        raw_risk = (
            (severity_score * 0.35) +
            (blast_radius * 0.25) +
            (norm_anomaly_score * 0.20) +
            (cascading_risk * 0.20)
        )
        final_risk = round(min(100.0, max(0.0, raw_risk)), 1)

        # 6. Risk Level Categorization
        if final_risk <= 25.0:
            risk_level = "LOW"
        elif final_risk <= 50.0:
            risk_level = "MEDIUM"
        elif final_risk <= 75.0:
            risk_level = "HIGH"
        else:
            risk_level = "CRITICAL"

        return {
            "risk_score": final_risk,
            "risk_level": risk_level,
            "factors": {
                "severity_score": round(severity_score, 1),
                "blast_radius": round(blast_radius, 1),
                "anomaly_score": round(norm_anomaly_score, 1),
                "cascading_risk": round(cascading_risk, 1)
            },
            "weights": {
                "severity_weight": 0.35,
                "blast_radius_weight": 0.25,
                "anomaly_weight": 0.20,
                "cascading_weight": 0.20
            },
            "metrics": {
                "total_paths": total_paths,
                "blocked_paths_count": len(blocked_paths),
                "rerouted_paths_count": len(rerouted_paths),
                "failed_components_count": failed_count,
                "pci_boundary_threatened": pci_impacted
            },
            "explanation": (
                f"Risk evaluated at {final_risk}/100 ({risk_level}). "
                f"Driven by Invariant Severity ({round(severity_score, 1)}), "
                f"Blast Radius ({round(blast_radius, 1)}%), "
                f"Anomaly Score ({round(norm_anomaly_score, 1)}), and "
                f"Cascading Risk ({round(cascading_risk, 1)})."
            )
        }

    @staticmethod
    def _empty_risk_response():
        return {
            "risk_score": 0.0,
            "risk_level": "LOW",
            "factors": {"severity_score": 0.0, "blast_radius": 0.0, "anomaly_score": 0.0, "cascading_risk": 0.0},
            "weights": {"severity_weight": 0.35, "blast_radius_weight": 0.25, "anomaly_weight": 0.20, "cascading_weight": 0.20},
            "metrics": {"total_paths": 0, "blocked_paths_count": 0, "rerouted_paths_count": 0, "failed_components_count": 0, "pci_boundary_threatened": False},
            "explanation": "Healthy baseline state. Risk evaluated at 0/100 (LOW)."
        }
