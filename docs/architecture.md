# InvariantHold: Technical Architecture Specification

## 1. Executive Summary

InvariantHold resolves the fundamental breakdown in distributed security enforcement: **relying on individual component health flags fails to guarantee security invariants along traffic paths.**

When an intermediate enforcement point degrades (e.g. Primary Encryption Gateway `ENC-01`), perimeter firewalls and servers remain green, masking the reality that sensitive payment records are transiting without encryption. Traditional security orchestration reacts either with neglect (security breach) or blind fail-closed shutdowns (costly collateral outage).

InvariantHold introduces **Path-Level Deterministic Invariant Verification**:
- **Source of Truth**: The deterministic invariant engine mathematically proves if all required controls for an invariant are present and operational on a path.
- **Targeted Fail-Safe**: Isolates *only* the affected unsafe paths, preserving 100% of unrelated traffic flows.
- **Safe Rerouting**: Discovers alternate paths and strictly verifies that the invariant is `GUARANTEED` before any traffic is migrated.
- **Measurable Safety Property**: `unsafe_traffic_delivered == 0` across all operating conditions.
- **Advisory AI & ML**: scikit-learn Isolation Forest detects abnormal telemetry shifts without ever overriding deterministic security proofs.

---

## 2. Component Pipeline

```mermaid
flowchart TD
    subgraph client["Client Tier"]
        UI[Unified Cyber SOC Dashboard :8000]
        API_STUDIO[Integrated API Studio]
    end

    subgraph gateway["Security Gateway & RBAC"]
        AUTH[JWT Verification HS256]
        RBAC[Server-Side RBAC: ADMIN / ANALYST / VIEWER]
        HEADERS[Security Headers & Sanitized Errors]
    end

    subgraph core["Deterministic Core Layer"]
        FE[Failure Injection Studio] --> GE[NetworkX Graph Engine]
        GE --> IE[Invariant Verification Engine - FINAL SOURCE OF TRUTH]
        IE --> FS{Invariant Verdict?}
        FS -- GUARANTEED --> ALLOW[Allow Safe Traffic Path]
        FS -- NO_POLICY / VIOLATED --> TFS[Targeted Fail-Safe: Isolate Unsafe Path Only]
        TFS --> RE[Safe Rerouting Engine]
        RE --> ALT{Alternate Route Evaluated}
        ALT -- GUARANTEED --> MIGRATE[Migrate to Pre-Verified Route ENC-02]
        ALT -- REJECTED --> BLOCK[Maintain Path Isolation BLOCKED]
        ALLOW --> TE[Simulated Traffic Engine]
        MIGRATE --> TE
        BLOCK --> TE
        TE --> ASSERT["SAFETY PROOF: unsafe_traffic_delivered == 0"]
        ASSERT --> AL[Tamper-Evident SHA-256 Audit Ledger]
    end

    subgraph advisory["Advisory & Intelligence (Zero Invariant Authority)"]
        ML[scikit-learn Isolation Forest Anomaly Detector]
        RISK[Deterministic 0-100 Risk Scoring Engine]
        EXPLAIN[Structured Decision Explainability & GenAI]
    end

    client --> gateway
    gateway --> core
    core --> advisory
```

## 3. Technology Stack & Separation of Concerns

| Tier | Technology | Role | Final Security Authority? |
|---|---|---|:---:|
| **Invariant Verification** | Python / NetworkX | Path-level control reachability & health evaluation | **YES (Source of Truth)** |
| **Targeted Fail-Safe** | FailureEngine | Precision path isolation without collateral damage | **YES** |
| **Safe Rerouting** | ReroutingEngine | Graph alternate discovery & pre-verified migration | **YES** |
| **Traffic Simulation** | TrafficEngine | Ground-truth packet simulation across paths | Evaluates Ground Truth |
| **ML Anomaly Detection**| scikit-learn IsolationForest | Telemetry anomaly scoring & pattern recognition | **NO (Advisory Signal Only)** |
| **Risk Scoring** | RiskEngine | Normalized 0-100 composite risk calculation | **NO** |
| **Explainability** | ExplainEngine | Human-readable root cause & remediation advice | **NO** |
| **Audit Ledger** | SHA-256 Chaining | Immutable blockchain-style tamper-evident log | Verification Ledger |
| **Backend API** | FastAPI / SQLite WAL | High-performance REST endpoints | API Layer |
| **Frontend SOC** | Dark Cyber UI / React Flow | Real-time interactive telemetry visualization | Presentation |
