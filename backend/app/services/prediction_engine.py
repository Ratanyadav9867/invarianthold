"""
Predictive Invariant Failure Engine — STRICTLY ADVISORY.

Analyzes live component telemetry to predict which components/invariants
are at risk of failure. Uses transparent weighted scoring (no black-box ML).

CRITICAL SAFETY RULE:
  - This engine NEVER authorizes or denies traffic.
  - It CANNOT override the deterministic InvariantEngine.
  - All output is advisory only.
  - If prediction fails, the system falls back to deterministic verification.
"""
import datetime
from typing import Any

from app.models.component import Component
from app.models.invariant import SecurityInvariant, TrafficPath
from sqlalchemy.orm import Session


# ─── Thresholds ────────────────────────────────────────────────────────────────
_HEALTH_SCORE_WARN = 0.75      # below → contributing signal
_HEALTH_SCORE_RISK = 0.50      # below → high signal
_LATENCY_WARN_MS   = 5.0       # ms above baseline
_LATENCY_RISK_MS   = 12.0
_FAILURE_COUNT_WARN = 2
_FAILURE_COUNT_RISK = 5
_RECENT_FAILURE_HOURS = 24     # failure within this window counts
_PREDICTION_HORIZON_HOURS = 6  # how far ahead we predict


class PredictionEngine:
    """
    Lightweight transparent prediction engine.
    Uses weighted feature scoring — no opaque ML models.
    Output is strictly advisory and must never be used to route traffic.
    """

    @classmethod
    def predict_component(
        cls,
        db: Session,
        component: Component,
    ) -> dict[str, Any]:
        """
        Score a single component's failure probability based on live telemetry.
        Returns a structured advisory prediction record.
        """
        score = 0.0          # 0.0 (safe) … 1.0 (critical)
        features: list[str] = []

        # ── Feature 1: Health score degradation ──────────────────────────────
        hs = component.health_score or 1.0
        if hs <= 0.0:
            score += 0.40
            features.append(f"component is currently FAILED (health_score=0.0)")
        elif hs < _HEALTH_SCORE_RISK:
            score += 0.30
            features.append(f"health_score critically low ({hs:.2f} < {_HEALTH_SCORE_RISK})")
        elif hs < _HEALTH_SCORE_WARN:
            score += 0.15
            features.append(f"health_score degraded ({hs:.2f} < {_HEALTH_SCORE_WARN})")

        # ── Feature 2: Elevated latency ───────────────────────────────────────
        lat = component.latency_ms or 0.0
        if lat >= _LATENCY_RISK_MS:
            score += 0.25
            features.append(f"latency critically elevated ({lat:.1f}ms ≥ {_LATENCY_RISK_MS}ms)")
        elif lat >= _LATENCY_WARN_MS:
            score += 0.10
            features.append(f"latency above normal ({lat:.1f}ms ≥ {_LATENCY_WARN_MS}ms)")

        # ── Feature 3: Historical failure frequency ───────────────────────────
        fc = component.failure_count or 0
        if fc >= _FAILURE_COUNT_RISK:
            score += 0.20
            features.append(f"high historical failure count ({fc} failures)")
        elif fc >= _FAILURE_COUNT_WARN:
            score += 0.10
            features.append(f"recurring failures detected ({fc} failures)")

        # ── Feature 4: Recent failure (recency signal) ────────────────────────
        if component.last_failure_at:
            now = datetime.datetime.now(datetime.UTC)
            lfa = component.last_failure_at
            if lfa.tzinfo is None:
                lfa = lfa.replace(tzinfo=datetime.UTC)
            hours_since = (now - lfa).total_seconds() / 3600
            if hours_since <= _RECENT_FAILURE_HOURS:
                score += 0.15
                features.append(f"failure occurred {hours_since:.1f}h ago (within {_RECENT_FAILURE_HOURS}h window)")

        # ── Feature 5: Currently DEGRADED status ─────────────────────────────
        if component.status == "DEGRADED":
            score += 0.10
            features.append("component is in DEGRADED state")
        elif component.status == "FAILED":
            score += 0.05  # already captured in health score; small extra weight
            features.append("component is currently FAILED")

        # ── Feature 6: Paths depending on this component that are at-risk ────
        affected_paths = db.query(TrafficPath).filter(
            TrafficPath.is_active == True,
            TrafficPath.status.in_(["AT_RISK", "BLOCKED", "VIOLATED"])
        ).all()
        at_risk_paths = []
        for p in affected_paths:
            hops = p.current_hops or []
            # Check component appears in path hops (node-level lookup via component id in meta_info)
            if component.id in str(hops):  # fast string search fallback
                at_risk_paths.append(p.id)

        if len(at_risk_paths) >= 2:
            score += 0.15
            features.append(f"{len(at_risk_paths)} dependent paths are currently AT_RISK/BLOCKED")
        elif len(at_risk_paths) == 1:
            score += 0.07
            features.append(f"1 dependent path is AT_RISK/BLOCKED ({at_risk_paths[0]})")

        # ── Clamp score ───────────────────────────────────────────────────────
        score = min(score, 1.0)
        failure_probability = round(score * 100, 1)

        # ── Risk classification ───────────────────────────────────────────────
        if failure_probability >= 75:
            risk_level = "CRITICAL"
            prediction = "IMMINENT_FAILURE"
        elif failure_probability >= 50:
            risk_level = "HIGH"
            prediction = "AT_RISK"
        elif failure_probability >= 25:
            risk_level = "MEDIUM"
            prediction = "WATCH"
        else:
            risk_level = "LOW"
            prediction = "NOMINAL"

        # ── Find associated invariant ─────────────────────────────────────────
        invariant_id = None
        invariant_name = "N/A"
        comp_paths = db.query(TrafficPath).filter(TrafficPath.is_active == True).all()
        for p in comp_paths:
            if component.id in str(p.current_hops or []) and p.applicable_invariant_id:
                inv = db.query(SecurityInvariant).filter(
                    SecurityInvariant.id == p.applicable_invariant_id
                ).first()
                if inv:
                    invariant_id = inv.id
                    invariant_name = inv.name
                    break

        explanation = (
            f"Component '{component.name}' ({component.id}) has a predicted failure probability of "
            f"{failure_probability}% over the next {_PREDICTION_HORIZON_HOURS} hours. "
            f"Contributing factors: {'; '.join(features) if features else 'None detected — component nominal'}. "
            f"ADVISORY ONLY: This prediction does NOT modify security policy. "
            f"The deterministic InvariantEngine remains the sole security authority."
        )

        return {
            "component_id": component.id,
            "component_name": component.name,
            "component_type": component.type,
            "zone": component.zone,
            "current_status": component.status,
            "current_health_score": round(hs, 3),
            "invariant_id": invariant_id,
            "invariant_name": invariant_name,
            "risk_level": risk_level,
            "failure_probability": failure_probability,
            "prediction": prediction,
            "prediction_horizon_hours": _PREDICTION_HORIZON_HOURS,
            "contributing_features": features if features else ["No risk signals detected"],
            "explanation": explanation,
            "advisory_note": (
                "STRICT ADVISORY: ML/prediction output CANNOT override invariant verification. "
                "Route authorization is performed exclusively by the deterministic InvariantEngine."
            ),
            "timestamp": datetime.datetime.now(datetime.UTC).isoformat(),
        }

    @classmethod
    def predict_all(cls, db: Session) -> dict[str, Any]:
        """Generate predictions for all active components."""
        components = db.query(Component).all()
        predictions = [cls.predict_component(db, c) for c in components]

        # Sort by failure_probability descending
        predictions.sort(key=lambda x: x["failure_probability"], reverse=True)

        critical = [p for p in predictions if p["risk_level"] == "CRITICAL"]
        high = [p for p in predictions if p["risk_level"] == "HIGH"]
        at_risk_count = len(critical) + len(high)

        return {
            "predictions": predictions,
            "total_components": len(components),
            "at_risk_count": at_risk_count,
            "critical_count": len(critical),
            "high_risk_count": len(high),
            "advisory_note": (
                "Predictions are advisory telemetry signals only. "
                "The deterministic InvariantEngine remains the authoritative security decision engine."
            ),
            "generated_at": datetime.datetime.now(datetime.UTC).isoformat(),
        }
