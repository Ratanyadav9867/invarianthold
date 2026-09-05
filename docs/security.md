# InvariantHold: Security Architecture & Threat Model

## 1. Security Philosophy

InvariantHold is designed around a single axiom:

> **"Component health does not imply invariant security. Invariants must be mathematically verified at the traffic path level."**

In traditional microservice and enterprise network architectures, health checks are decoupled from security invariants. A health ping (`HTTP 200` or TCP keepalive) only indicates that an enforcement process is responding, not that it is enforcing the required cryptographic, data-loss, or access policies for a given transaction path.

InvariantHold inverts this model:
- The **Graph & Path Engine** maintains the active network topology.
- The **Invariant Engine** treats security invariants as strict formal assertions.
- When an enforcement node fails or degrades, the system treats all dependent traffic paths as **untrusted and unsafe**, engaging an immediate **Targeted Fail-Safe** to block ingress *before* unencrypted or non-compliant packets can reach sensitive enclaves.

---

## 2. Threat Modeling & Failure Modes

| Threat / Failure Scenario | Traditional System Response | InvariantHold Fail-Safe Response |
|---|---|---|
| **Silent Intermediate Node Failure** (e.g. `ENC-01` process crash) | Traffic continues flowing; plaintext cardholder data enters PCI enclave (Critical breach). | Invariant engine identifies `ENC-01` failure, detects 3 dependent PCI paths, and immediately switches them to `BLOCKED`. |
| **Fail-Closed Blind Overreaction** | Entire network or subnet isolated, shutting down public catalog, auth, and database access. | Targeted isolation: Only the 3 dependent PCI paths are blocked. Unrelated safe paths (70.0%) remain 100% operational. |
| **Insecure Rerouting** | Traffic blindly routed to any reachable node without policy verification. | Candidate routes are pre-verified against the invariant before migration. If an alternate route does not contain all required controls, rerouting is rejected and path remains blocked. |
| **Audit Log Tampering** | Attacker modifies log rows in database to conceal policy violations. | SHA-256 hash-chaining breaks if any record payload, timestamp, or previous hash is altered. Automated audit detects exact tampered block. |
| **Privilege Escalation** | Admin accesses database directly bypassing bastion proxy. | Invariant `INV-ADMIN-02` strictly requires `PAM` + `FIREWALL`. Direct paths lacking `PAM` are marked `VIOLATED`. |

---

## 3. Cryptographic Audit Chain Integrity

Every state transition, failure injection, recovery, and security decision is hashed using SHA-256 with blockchain-style chaining:

$$H_0 = 0^{64} \quad (\text{Genesis Hash})$$
$$H_i = \text{SHA-256}\left(H_{i-1} \parallel T_i \parallel \text{Actor}_i \parallel \text{Action}_i \parallel \text{Target}_i \parallel \text{CanonicalJSON}(\text{Details}_i)\right)$$

The endpoint `POST /api/audit/verify` audits the entire ledger sequentially:
1. Recomputes $H_i$ for each block $i \in [1, N]$.
2. Verifies that block $i$'s recorded `previous_hash` strictly equals $H_{i-1}$.
3. Verifies that block $i$'s recorded `current_hash` strictly equals the recomputed $H_i$.
4. Flags any discrepancy as `CHAIN_LINK_BROKEN` or `PAYLOAD_ALTERED`.

---

## 4. Role-Based Access Control (RBAC)

Passwords are never stored in plaintext and are salted and hashed with `bcrypt`:

| Role | Default Demo Account | Permissions |
|---|---|---|
| **ADMIN** | `admin@invarianthold.io` | Full system control: failure simulation, rerouting, incident management, audit log inspection, topology resets. |
| **SECURITY_ANALYST** | `analyst@invarianthold.io` | Simulation execution, reroute triggers, incident investigation, telemetry inspection. |
| **VIEWER** | `viewer@invarianthold.io` | Read-only access to dashboards, invariant matrices, packet streams, and audit reports. |

JWT access tokens are cryptographically signed using HS256 with a configurable secret key and explicit token expiration.
