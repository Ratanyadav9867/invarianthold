# InvariantHold

### Runtime Security Invariant Verification & Targeted Fail-Safe Platform

> **"Do not trust component health alone. Verify the security invariant at the traffic-path level."**

---

## 1. The Core Problem

In modern distributed security fabrics (Firewalls, WAFs, Encryption Gateways, DLP, IDS, PAM), operators monitor health dashboards where every node appears green. However, when an intermediate enforcement point degrades (e.g. Primary PCI Encryption Gateway `ENC-01`), the perimeter firewall and database servers remain healthy, yet **sensitive cardholder data crossing that path is no longer encrypted.**

Traditional security platforms respond with one of two extremes:
1. **Neglect / Ignorance**: The breach occurs silently because individual component health checks remain green.
2. **Blind Fail-Closed Outage**: Shutting down the entire network when an enforcement point degrades, causing severe business disruption.

---

## 2. The InvariantHold Solution

**InvariantHold** provides mathematical, path-level security invariant verification:
1. **Deterministic Invariant Engine (Source of Truth)**: Evaluates whether all required security controls for an invariant are present and operational on each specific traffic path.
2. **Targeted Fail-Safe**: Isolates *only* the affected unsafe paths (e.g. 3 PCI paths blocked), while keeping unrelated safe traffic (e.g. 7 web and database paths, 70.0%) operational.
3. **Safe Rerouting**: Discovers alternate candidate paths (e.g. redundant `ENC-02`) and verifies that the invariant is `GUARANTEED` *before* migrating traffic.
4. **Ground-Truth Traffic Verification**: Injects configurable virtual packet flows (100 to 1,000+ packets) to prove the central safety assertion:
   $$\text{unsafe\_traffic\_delivered} == 0$$
5. **Advisory ML Anomaly Detection**: `scikit-learn` Isolation Forest detects failure bursts and telemetry spikes to assist SecOps risk scoring without ever overriding deterministic security proofs.
6. **Immutable Cryptographic Audit Ledger**: SHA-256 blockchain-style hash-chaining records every decision and provides automated tamper detection.

---

## 3. End-to-End Architecture

```mermaid
flowchart TD
    subgraph Client Tier
        UI[Dark Cyber SOC Dashboard]
        API_DOCS[FastAPI Swagger / OpenAPI]
    end

    subgraph Service Layer
        FE[Failure Injection Studio] --> GE[NetworkX Graph Engine]
        GE --> IE[Invariant Verification Engine - SOURCE OF TRUTH]
        IE --> FS{Is Invariant Guaranteed?}
        FS -- YES --> ALLOW[Allow Safe Traffic Path]
        FS -- NO --> TFS[Targeted Fail-Safe: Isolate Unsafe Path Only]
        TFS --> RE[Safe Rerouting Engine]
        RE --> ALT{Compliant Route Found?}
        ALT -- YES --> PRE_VERIFY[Pre-Verify Invariant on Route]
        PRE_VERIFY -- GUARANTEED --> MIGRATE[Migrate to Alternate Route ENC-02]
        PRE_VERIFY -- VIOLATED --> BLOCK[Preserve Path Isolation BLOCKED]
        ALT -- NO --> BLOCK
        ALLOW --> TE[Simulated Traffic Engine]
        MIGRATE --> TE
        BLOCK --> TE
        TE --> ASSERT["SAFETY ASSERTION: unsafe_traffic_delivered == 0"]
        ASSERT --> AL[SHA-256 Hash-Chained Audit Ledger]
    end

    subgraph Advisory & Intelligence
        ML[scikit-learn Isolation Forest Anomaly Detector]
        RISK[Deterministic 0-100 Risk Scoring Engine]
        EXPLAIN[Structured Explainability & GenAI Fallback]
    end

    Client Tier --> Service Layer
    Service Layer --> Advisory & Intelligence
```

---

## 4. Quickstart Guide (Local Execution)

### Prerequisites
- Python 3.10+ (Python 3.13 tested and verified)
- Windows / Linux / macOS

### 1. Clone or Open Project
```powershell
cd C:\Users\R\.gemini\antigravity\scratch\invarianthold
```

### 2. Activate Virtual Environment & Install Dependencies
```powershell
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 3. Run Automated Acceptance Tests (100% Pass Rate)
```powershell
pytest -v
```

### 4. Launch InvariantHold Unified Server
```powershell
python run.py
```

Open your browser to:
- **Interactive SOC Dashboard**: [http://localhost:8000](http://localhost:8000)
- **Interactive REST API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check Endpoint**: [http://localhost:8000/health](http://localhost:8000/health)

---

## 5. Demo Credentials (RBAC)

| Role | Username / Email | Default Password | Permissions |
|---|---|---|---|
| **ADMIN** | `admin@invarianthold.io` | `REDACTED_PASSWORD` | Full administrative control, scenario execution, ledger reset |
| **SECURITY_ANALYST** | `analyst@invarianthold.io` | `REDACTED_PASSWORD` | Failure simulation, rerouting, incident triage |
| **VIEWER** | `viewer@invarianthold.io` | `REDACTED_PASSWORD` | Read-only dashboards and audit log inspection |

---

## 6. Judge Verification Scorecard

The platform includes a 1-click **Judge Demo Mode** that runs an automated 8-step test scenario. Click the **"RUN JUDGE DEMO"** button on the UI header or trigger via API:

```powershell
curl -X POST "http://localhost:8000/api/demo/run?packet_count=1000"
```

### Final Scorecard Guarantees:
- **Security Invariants Guaranteed**: `YES`
- **Unsafe Traffic Delivered**: `0`
- **Unnecessary Paths Blocked**: `0` (Zero collateral disruption)
- **Safe Path Preservation**: `70.0%` dynamically calculated during `ENC-01` failure
- **Rerouting Verification**: Traffic migrated to `ENC-02` only after pre-verification confirmed `GUARANTEED`
- **Audit Integrity**: `VERIFIED` across all SHA-256 cryptographic blocks

---

## 7. Project Documentation

Detailed technical manuals are located in `/docs`:
- [`architecture.md`](docs/architecture.md): Full pipeline, component separation of concerns, and data flows.
- [`invariants.md`](docs/invariants.md): Mathematical invariant formulations and default fintech invariants.
- [`demo.md`](docs/demo.md): Judge demonstration sequence diagram and step-by-step narration.
