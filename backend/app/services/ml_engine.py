from typing import Any

import numpy as np

try:
    from sklearn.ensemble import IsolationForest
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

FEATURE_NAMES = [
    "failure_frequency",
    "failed_component_count",
    "packet_rate",
    "average_latency",
    "packet_loss",
    "invariant_violation_count",
    "path_change_frequency",
    "recovery_frequency"
]

class MLEngine:
    """
    ML-Powered Telemetry Anomaly Detection Engine.
    Uses an Isolation Forest model trained on reproducible baseline telemetry.
    Strictly advisory: never makes final security or access-control decisions.
    """

    def __init__(self, random_state: int = 42):
        self.random_state = random_state
        self.model = None
        self.baseline_stats: dict[str, dict[str, float]] = {}
        self._init_and_train()

    def _init_and_train(self):
        """Generate synthetic normal baseline telemetry and train the Isolation Forest."""
        np.random.seed(self.random_state)
        n_samples = 300

        # Normal baseline distributions
        # 1. failure_frequency: ~0.0 to 0.05
        failure_freq = np.random.uniform(0.0, 0.05, n_samples)
        # 2. failed_component_count: mostly 0, rarely 1
        failed_comps = np.random.choice([0, 1], size=n_samples, p=[0.95, 0.05])
        # 3. packet_rate: ~100 to 150 pkts/sec
        packet_rate = np.random.normal(120.0, 10.0, n_samples)
        # 4. average_latency: ~2.0 to 3.0 ms
        avg_latency = np.random.normal(2.5, 0.3, n_samples)
        # 5. packet_loss: ~0.0%
        packet_loss = np.random.uniform(0.0, 0.2, n_samples)
        # 6. invariant_violation_count: 0
        violations = np.zeros(n_samples)
        # 7. path_change_frequency: ~0.0
        path_changes = np.random.uniform(0.0, 0.02, n_samples)
        # 8. recovery_frequency: ~0.0 to 0.02
        recovery_freq = np.random.uniform(0.0, 0.02, n_samples)

        X_train = np.column_stack([
            failure_freq,
            failed_comps,
            packet_rate,
            avg_latency,
            packet_loss,
            violations,
            path_changes,
            recovery_freq
        ])

        # Store baseline mean and std for contributing metric deviation calculation
        for idx, name in enumerate(FEATURE_NAMES):
            self.baseline_stats[name] = {
                "mean": float(np.mean(X_train[:, idx])),
                "std": float(np.std(X_train[:, idx])) or 0.01
            }

        if SKLEARN_AVAILABLE:
            self.model = IsolationForest(
                n_estimators=100,
                contamination=0.03,
                random_state=self.random_state
            )
            self.model.fit(X_train)

    def analyze_telemetry(
        self,
        features: dict[str, float]
    ) -> dict[str, Any]:
        """
        Analyze live or simulated system telemetry vector.
        Returns anomaly_score (0.0 to 1.0), is_anomaly, risk_level, and contributing metrics.
        """
        # Build feature vector matching schema
        vector = [features.get(name, self.baseline_stats[name]["mean"]) for name in FEATURE_NAMES]
        X = np.array([vector])

        # Calculate z-score deviation for each metric
        deviations = {}
        for name in FEATURE_NAMES:
            val = features.get(name, self.baseline_stats[name]["mean"])
            mean = self.baseline_stats[name]["mean"]
            std = self.baseline_stats[name]["std"]
            z_score = abs(val - mean) / std if std > 0 else 0.0
            deviations[name] = round(float(z_score), 2)

        # Identify top contributing metrics
        sorted_deviations = sorted(deviations.items(), key=lambda item: item[1], reverse=True)
        top_contributors = {k: v for k, v in sorted_deviations[:3] if v > 1.5}

        if SKLEARN_AVAILABLE and self.model is not None:
            # IsolationForest decision_function: lower means more anomalous
            # Convert raw score to normalized 0.0 (normal) to 1.0 (highly anomalous)
            raw_score = self.model.decision_function(X)[0]  # typically -0.5 to 0.5
            pred = self.model.predict(X)[0]  # 1 for inlier, -1 for outlier

            # Map raw score to 0.0 (normal) - 1.0 (anomalous)
            anomaly_score = round(float(np.clip((0.15 - raw_score) / 0.35, 0.0, 1.0)), 2)
            is_anomaly = bool(pred == -1 or anomaly_score >= 0.65)
        else:
            # Fallback statistical scoring based on max z-score deviations
            max_dev = max(deviations.values()) if deviations else 0.0
            anomaly_score = round(float(min(1.0, max_dev / 5.0)), 2)
            is_anomaly = bool(anomaly_score >= 0.65)

        # Classify risk level
        if anomaly_score < 0.35:
            risk_level = "LOW"
        elif anomaly_score < 0.65:
            risk_level = "MEDIUM"
        elif anomaly_score < 0.85:
            risk_level = "HIGH"
        else:
            risk_level = "CRITICAL"

        return {
            "anomaly_score": anomaly_score,
            "is_anomaly": is_anomaly,
            "risk_level": risk_level,
            "features_analyzed": features,
            "contributing_metrics": top_contributors,
            "advisory_note": (
                "ML is purely advisory for telemetry anomaly detection. "
                "Deterministic Invariant Verification Engine remains the sole security authority."
            )
        }

    def evaluate_scenario(
        self,
        scenario_type: str = "NORMAL"
    ) -> dict[str, Any]:
        """
        Evaluate synthetic test scenarios for demo and validation.
        Supported scenarios: 'NORMAL', 'SINGLE_FAILURE', 'BURST_ANOMALY', 'LATENCY_SPIKE'.
        """
        if scenario_type == "NORMAL":
            telemetry = {
                "failure_frequency": 0.01,
                "failed_component_count": 0,
                "packet_rate": 122.0,
                "average_latency": 2.4,
                "packet_loss": 0.0,
                "invariant_violation_count": 0,
                "path_change_frequency": 0.0,
                "recovery_frequency": 0.0
            }
        elif scenario_type == "SINGLE_FAILURE":
            telemetry = {
                "failure_frequency": 0.12,
                "failed_component_count": 1,
                "packet_rate": 115.0,
                "average_latency": 3.2,
                "packet_loss": 0.0,
                "invariant_violation_count": 1,
                "path_change_frequency": 0.1,
                "recovery_frequency": 0.0
            }
        elif scenario_type == "BURST_ANOMALY":
            telemetry = {
                "failure_frequency": 0.85,
                "failed_component_count": 4,
                "packet_rate": 280.0,
                "average_latency": 9.8,
                "packet_loss": 8.5,
                "invariant_violation_count": 6,
                "path_change_frequency": 0.75,
                "recovery_frequency": 0.0
            }
        elif scenario_type == "LATENCY_SPIKE":
            telemetry = {
                "failure_frequency": 0.05,
                "failed_component_count": 0,
                "packet_rate": 125.0,
                "average_latency": 18.5,
                "packet_loss": 3.2,
                "invariant_violation_count": 0,
                "path_change_frequency": 0.0,
                "recovery_frequency": 0.0
            }
        else:
            telemetry = {name: self.baseline_stats[name]["mean"] for name in FEATURE_NAMES}

        res = self.analyze_telemetry(telemetry)
        res["scenario_type"] = scenario_type
        return res

ml_engine = MLEngine()
