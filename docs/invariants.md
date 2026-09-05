# Security Invariants & Verification Specification

## 1. Mathematical Invariant Formulation

A **Security Invariant** $I$ is formally defined as a tuple:

$$I = (Z_{src}, Z_{dst}, C_{req}, S_{sev})$$

Where:
- $Z_{src}$: Set of allowed source security zones.
- $Z_{dst}$: Set of destination protected security zones.
- $C_{req}$: Required set of security enforcement control types $\subseteq \{\text{FIREWALL}, \text{ENCRYPTION\_GATEWAY}, \text{DLP}, \text{IDS}, \text{WAF}, \text{PAM}\}$.
- $S_{sev}$: Invariant severity level ($\text{LOW} = 25, \text{MEDIUM} = 50, \text{HIGH} = 75, \text{CRITICAL} = 100$).

A traffic path $P = (n_1, n_2, \dots, n_k)$ satisfies invariant $I$ if and only if:
1. $n_1 \in Z_{src}$ and $n_k \in Z_{dst}$.
2. Every control type $c \in C_{req}$ is provided by at least one active node on the path:
   $$\forall c \in C_{req}, \quad \exists n \in P \quad \text{such that} \quad \text{Controls}(n) = c \quad \land \quad \text{Status}(n) = \text{HEALTHY}$$

If any $c \in C_{req}$ is missing or its providing component has $\text{Status} \neq \text{HEALTHY}$, the path evaluates to $\text{VIOLATED}$, engaging immediate **Targeted Fail-Safe Isolation** ($\text{Status}(P) = \text{BLOCKED}$).

---

## 2. Default Fintech Invariants Matrix

| ID | Name | Severity | Protected Boundary | Required Controls | Bound Paths |
|---|---|:---:|:---:|:---:|:---:|
| `INV-PCI-01` | PCI Boundary Protection | **CRITICAL** | PCI Enclave | `FIREWALL`, `ENCRYPTION_GATEWAY`, `DLP` | `PATH-PCI-TX-01`, `PATH-PCI-TX-02`, `PATH-PCI-RECURRING` |
| `INV-ADMIN-02`| Admin Privilege Enforcement| **HIGH** | Management | `PAM`, `FIREWALL` | `PATH-ADMIN-PCI`, `PATH-ADMIN-DB`, `PATH-ADMIN-APP` |
| `INV-WEB-03` | Public Web Ingress Protection | **MEDIUM** | DMZ / App | `WAF`, `FIREWALL` | `PATH-WEB-CATALOG`, `PATH-WEB-AUTH` |
| `INV-DB-04` | Database Query Invariant | **HIGH** | Database | `FIREWALL`, `IDS` | `PATH-DB-CUSTOMER`, `PATH-DB-ORDERS` |
