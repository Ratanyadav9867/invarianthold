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

**InvariantHold** provides deterministic path-level security invariant verification:
1. **Deterministic Invariant Engine (Source of Truth)**: Evaluates whether all required security controls for an invariant are present and operational on each specific traffic path.
2. **Targeted Fail-Safe**: Isolates *only* the affected unsafe paths (e.g. 3 PCI paths blocked), while keeping unrelated safe traffic (e.g. 7 web and database paths, 70.0%) operational.
3. **Safe Rerouting**: Discovers alternate candidate paths (e.g. redundant `ENC-02`) and verifies that the candidate route is `GUARANTEED` *before* migrating traffic. Candidate paths with `NO_POLICY`, `VIOLATED`, `BLOCKED`, or `AT_RISK` are strictly rejected.
4. **Ground-Truth Traffic Verification**: Injects configurable virtual packet flows (100 to 1,000+ packets) to prove the central safety assertion:
   $$\text{unsafe\_traffic\_delivered} == 0$$
   Unsafe traffic delivery is dynamically computed from actual packet delivery outcomes, never hardcoded.
5. **Advisory ML Anomaly Detection**: `scikit-learn` Isolation Forest detects failure bursts and telemetry spikes to assist SecOps risk scoring without ever overriding deterministic security decisions.
6. **Tamper-Evident SHA-256 Hash-Chained Audit Ledger**: Cryptographic hash chaining records every administrative mutation and security decision with automated tamper detection.

---

## 3. End-to-End Architecture

```mermaid
flowchart TD
    subgraph Client Tier
        UI[Unified Cyber SOC Dashboard :8000]
        API_STUDIO[Integrated API Studio]
    end

    subgraph Security Gateway & RBAC
        AUTH[JWT Verification HS256]
        RBAC[Server-Side RBAC: ADMIN / ANALYST / VIEWER]
        HEADERS[Security Headers & Sanitized Errors]
    end

    subgraph Deterministic Core Layer
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

    subgraph Advisory & Intelligence (Zero Invariant Authority)
        ML[scikit-learn Isolation Forest Anomaly Detector]
        RISK[Deterministic 0-100 Risk Scoring Engine]
        EXPLAIN[Structured Decision Explainability & GenAI]
    end

    Client Tier --> Security Gateway & RBAC
    Security Gateway & RBAC --> Deterministic Core Layer
    Deterministic Core Layer --> Advisory & Intelligence
```

---

## 4. Invariant Engine Semantics

The platform enforces strict deterministic invariant statuses:

| Status | Meaning | Reroute Eligible? |
|---|---|:---:|
| **`GUARANTEED`** | All required security controls are verified present and healthy on the path. | ✅ YES |
| **`AT_RISK`** | Invariant controls are present but components are in degraded health. | ❌ NO |
| **`VIOLATED`** | One or more required security controls are missing or failed. | ❌ NO |
| **`BLOCKED`** | Path has been intentionally isolated by targeted fail-safe enforcement. | ❌ NO |
| **`NO_POLICY`** | No security invariant is configured for this path (**NO POLICY ≠ GUARANTEED**). | ❌ NO |

---

## 5. Role-Based Access Control (RBAC)

Authorization is enforced strictly on the server side:

| Role | Permissions | Mutation Access |
|---|---|:---:|
| **`ADMIN`** | Full access: configuration, failure injection, rerouting, component recovery, simulation, and environment reset. | ✅ Full |
| **`SECURITY_ANALYST`** | Operational access: failure injection, rerouting, component recovery, simulation, and judge demo execution. | ✅ Operations |
| **`VIEWER`** | Read-only access: inspect topology, invariants, traffic, audit logs, and system telemetry. All mutations return `403 Forbidden`. | ❌ Read-Only |

---

## 6. Demo Credentials (DEMO ONLY — NOT FOR PRODUCTION)

> [!WARNING]
> The credentials below are provided exclusively for hackathon evaluation and local testing. In production, configure all credentials and signing keys via environment variables or `.env`.

| Role | Username / Email | Demo Password | Purpose |
|---|---|---|---|
| **ADMIN** | `admin@invarianthold.io` | Configured in `.env` | Full administrative operations & reset |
| **SECURITY_ANALYST** | `analyst@invarianthold.io` | Configured in `.env` | Security operations & failure injection |
| **VIEWER** | `viewer@invarianthold.io` | Configured in `.env` | Read-only evaluation of RBAC barriers |

---

## 7. Quickstart Guide (Local Execution)

### Prerequisites
- Python 3.10+ (Python 3.11, 3.12, 3.13 supported)
- Windows / Linux / macOS

### 1. Set Up Virtual Environment & Dependencies
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 2. Configure Environment
```powershell
cp .env.example .env
```
*(In development, an ephemeral `SECRET_KEY` and random demo credentials will be generated automatically if `.env` is omitted).*

### 3. Run the Automated Test Suite
```powershell
pytest -v
```

### 4. Launch the Unified Platform
```powershell
python run.py
```
Open **[http://localhost:8000](http://localhost:8000)** in your browser for the full Cyber SOC Dashboard, Interactive Topology, built-in API Studio, and 8-Step Judge Showcase.

---

## 8. Security Limitations & Production Considerations
- **Storage**: Default deployment uses SQLite 3 with WAL mode and synchronous writes. For enterprise multi-region deployments, configure PostgreSQL.
- **Audit Immutability**: The SHA-256 hash chain is tamper-evident (detects any row modification, payload tampering, or link breaking). It detects tampering within the database; for append-only guarantees at the storage layer, replicate hashes to external immutable storage (e.g. AWS S3 Object Lock or CloudWatch).
- **Advisory ML**: Isolation Forest anomaly scores provide situational awareness for SecOps analysts and contribute to composite risk scoring; they never override deterministic invariant verification.
