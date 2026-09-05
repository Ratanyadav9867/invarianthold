# InvariantHold: REST API Reference

Base URL: `http://localhost:8000`
Swagger Interactive Docs: `http://localhost:8000/docs`

---

## 1. System & Health

### `GET /health`
Returns backend health, database connection status, and ML engine state.
```json
{
  "status": "HEALTHY",
  "service": "InvariantHold",
  "version": "1.0.0",
  "database": "CONNECTED",
  "ml_engine": "ACTIVE (scikit-learn)",
  "simulation_engine": "READY"
}
```

---

## 2. Authentication & Users

### `POST /api/auth/login`
Authenticate user with username or email and password.
- **Request Body**:
  ```json
  {
    "username": "analyst@invarianthold.io",
    "password": "REDACTED_PASSWORD"
  }
  ```
- **Response**:
  ```json
  {
    "access_token": "eyJhbGciOi...",
    "token_type": "bearer",
    "user": {
      "id": "usr-analyst-01",
      "username": "analyst",
      "role": "SECURITY_ANALYST"
    }
  }
  ```

---

## 3. Enforcement Components

### `GET /api/components`
List all security enforcement components in the fabric.

### `GET /api/components/{id}`
Retrieve a specific component by ID (e.g. `ENC-01`, `FW-01`).

### `POST /api/components/{id}/recover`
Recover a failed component to `HEALTHY` and re-verify dependent paths.

---

## 4. Invariants & Paths

### `GET /api/invariants`
List all defined security invariants with required controls and severities.

### `POST /api/invariants/verify`
Trigger a full mathematical path re-verification across all active traffic paths.

### `GET /api/paths`
List all traffic paths, their active routes, applicable invariants, and live statuses.

### `GET /api/paths/affected`
List only paths currently in `BLOCKED`, `VIOLATED`, `AT_RISK`, or `REROUTED` status.

### `POST /api/reroute`
Trigger automatic rerouting of blocked paths to compliant alternate routes.
- **Request Body**:
  ```json
  { "path_id": null }
  ```
  *(Pass `null` to reroute all affected paths, or specify a path ID)*

---

## 5. Failure Simulation

### `POST /api/failures/inject`
Inject failure into one or more enforcement components.
- **Request Body**:
  ```json
  {
    "component_ids": ["ENC-01"],
    "failure_type": "PRIMARY_ENCRYPTION_FAIL"
  }
  ```
- **Response**:
  ```json
  {
    "action": "FAILURE_INJECTED",
    "failed_components": ["ENC-01"],
    "total_paths": 10,
    "affected_paths_count": 3,
    "safe_paths_count": 7,
    "safe_path_preservation_pct": 70.0,
    "summary_message": "3 path(s) isolated by Targeted Fail-Safe. 7 safe path(s) (70.0%) remain operational."
  }
  ```

---

## 6. Simulated Traffic

### `POST /api/traffic/simulate`
Generate and route simulated packets.
- **Request Body**:
  ```json
  { "packet_count": 1000 }
  ```
- **Response**:
  ```json
  {
    "total_packets": 1000,
    "packets_delivered": 700,
    "packets_blocked": 300,
    "unsafe_traffic_delivered": 0,
    "safe_traffic_preserved_pct": 70.0,
    "safety_guarantee_verified": true
  }
  ```

### `GET /api/traffic`
Fetch recent simulated packet telemetry (supports `?limit=50`).

### `GET /api/traffic/stats`
Get aggregate traffic metrics across all simulated flows.

---

## 7. AI & Explainability

### `GET /api/ai/anomalies`
Fetch Isolation Forest anomaly analysis on live telemetry.
- Query Parameter: `?scenario=NORMAL` or `?scenario=BURST_ANOMALY`

### `POST /api/ai/explain`
Generate structured decision explanations or full incident root cause analysis.
- **Request Body**:
  ```json
  { "path_id": "PATH-PCI-TX-01" }
  ```

---

## 8. Cryptographic Audit

### `GET /api/audit`
Retrieve the latest hash-chained cryptographic audit records (supports `?limit=100`).

### `POST /api/audit/verify`
Audit blockchain-style ledger integrity from genesis to current block.

---

## 9. Judge Demonstration Mode

### `POST /api/demo/run`
Execute the automated 8-step deterministic Judge Demo workflow.
- Query Parameter: `?packet_count=1000`

### `POST /api/demo/reset`
Reset network topology, components, and paths back to healthy baseline.
