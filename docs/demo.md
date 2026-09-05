# Judge Demonstration Script & Verification Walkthrough

## 1. Automated 8-Step Verification Workflow

The One-Click Judge Demo executes this automated 8-step lifecycle:

```mermaid
sequenceDiagram
    participant Judge as Judge / SecOps
    participant Demo as DemoEngine
    participant Invariant as InvariantEngine
    participant FailSafe as Targeted Fail-Safe
    participant Reroute as ReroutingEngine
    participant Traffic as TrafficEngine
    participant ML as ML Isolation Forest
    participant Audit as Audit Ledger

    Judge->>Demo: POST /api/demo/run
    Demo->>Invariant: Step 1: Verify Healthy Baseline
    Invariant-->>Demo: 10 Paths GUARANTEED
    Demo->>FailSafe: Step 2: Inject ENC-01 Failure
    FailSafe-->>Demo: Exact 3 PCI Paths Identified
    Demo->>FailSafe: Step 3: Engage Targeted Isolation
    FailSafe-->>Demo: 3 Paths BLOCKED, 7 Paths Preserved (70.0%)
    Demo->>Traffic: Inject 1000 Packets
    Traffic-->>Demo: Unsafe Delivered = 0, Blocked Unsafe = 300
    Demo->>Reroute: Step 4: Search Alternate via ENC-02
    Reroute->>Invariant: Pre-Verify Candidate Route
    Invariant-->>Reroute: Invariant GUARANTEED
    Reroute-->>Demo: 3 Paths REROUTED
    Demo->>Traffic: Step 5: Post-Reroute Packet Verification
    Traffic-->>Demo: Unsafe Delivered = 0, 100% Operational
    Demo->>ML: Step 6: Trigger Telemetry Burst
    ML-->>Demo: Anomaly Score 0.76 (ANOMALOUS)
    Demo->>Audit: Step 7: Cryptographic Ledger Verification
    Audit-->>Demo: SHA-256 Chain Integrity 100% Valid
    Demo-->>Judge: Step 8: Deliver Final Scorecard (0 Unsafe Leaks)
```

---

## 2. Expected Scorecard Assertions

1. **Security Invariants Guaranteed**: `YES`
2. **Unsafe Traffic Delivered**: `0`
3. **Unnecessary Paths Blocked**: `0` (Zero collateral damage)
4. **Safe Path Preservation**: `70.0%` dynamically calculated during failure
5. **Recovery Time**: Sub-second deterministic isolation & rerouting
6. **Audit Integrity**: `VERIFIED`
