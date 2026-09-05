# InvariantHold: Machine Learning & Telemetry Anomaly Architecture

## 1. Architectural Guardrail: Advisory ML vs. Deterministic Security

A critical design requirement of InvariantHold is:

> **"Machine Learning models must NEVER make the final security or access-control decision."**

In cybersecurity, probabilistic models (like neural networks or gradient-boosted trees) can produce false negatives when exposed to novel attack vectors or edge cases. If an ML model is granted the authority to permit traffic across a protected boundary, an adversarial bypass or statistical drift could lead to severe data breaches.

Therefore, InvariantHold enforces a strict separation:

```
[ Telemetry Stream ] ──► [ Isolation Forest ] ──► [ Advisory Signal / Anomaly Score ]
                                                              │
                                                              ▼
                                                    [ SecOps SOC Alerting & Risk Estimation ]

[ Path Traffic Flow ] ──► [ Invariant Verification Engine ] ──► [ FINAL DECISION: ALLOW / BLOCK / REROUTE ]
                                 (Source of Truth)
```

- **Invariant Verification Engine**: Deterministic, mathematical source of truth. Decides whether traffic is safe.
- **ML Anomaly Engine**: Advisory signal only. Decides whether system telemetry patterns are unusual.

---

## 2. Model Specification: Isolation Forest

InvariantHold uses the **Isolation Forest** unsupervised algorithm (`scikit-learn`):
- **Why Isolation Forest?**: It explicitly isolates anomalies instead of profiling normal data points. Anomalous telemetry points (e.g. failure bursts, packet loss spikes) have shorter tree paths and can be separated with far fewer random splits than normal operating telemetry.
- **Hyperparameters**:
  - `n_estimators`: 100 decision trees
  - `contamination`: 0.03 (assumes 3% outlier rate in baseline)
  - `random_state`: 42 (ensures deterministic, reproducible demonstrations)

---

## 3. Telemetry Feature Vector

The model monitors 8 continuous and discrete telemetry features:

| Feature Index | Name | Baseline Normal Range | Anomalous Trigger Scenario |
|:---:|---|:---:|---|
| 1 | `failure_frequency` | $0.00 - 0.05$ | Multi-node cascade ($> 0.50$) |
| 2 | `failed_component_count` | $0$ (rarely $1$) | Component burst ($\ge 3$) |
| 3 | `packet_rate` | $100 - 140$ pkts/sec | Traffic spike or flood ($> 250$) |
| 4 | `average_latency` | $2.0 - 3.5$ ms | Latency degradation ($> 8.0$ ms) |
| 5 | `packet_loss` | $0.0 - 0.2\%$ | Network drop burst ($> 5.0\%$) |
| 6 | `invariant_violation_count`| $0$ | Policy violation storm ($> 2$) |
| 7 | `path_change_frequency` | $0.00 - 0.02$ | Route flapping ($> 0.40$) |
| 8 | `recovery_frequency` | $0.00 - 0.02$ | Rapid oscillating node recovery |

---

## 4. Anomaly Scoring & Contributing Deviations

1. **Normalized Anomaly Score ($0.00$ to $1.00$)**:
   The raw decision function score $s \in [-0.5, 0.5]$ is mapped to a normalized score where $0.0$ represents normal baseline and $1.0$ represents severe anomaly.
2. **Z-Score Feature Contribution**:
   For each metric $x_j$, the deviation from baseline mean $\mu_j$ and standard deviation $\sigma_j$ is calculated:
   $$Z_j = \frac{|x_j - \mu_j|}{\sigma_j}$$
   Metrics with $Z_j > 2.0$ are surfaced to SecOps analysts as **top contributing anomaly factors**.
