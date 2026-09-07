import re

from app.api.deps import require_auth, require_role
from app.config import settings
from app.core.security import (
    create_access_token,
    verify_password,
    get_password_hash,
    is_login_locked,
    record_failed_login,
    clear_failed_logins,
)
from app.core.topology_seed import seed_database
from app.database import get_db
from app.models.audit import AuditLog
from app.models.auth import User
from app.models.component import Component
from app.models.invariant import SecurityInvariant, TrafficPath
from app.models.traffic import Incident, TrafficPacket
from app.schemas.common import (
    ExplainRequest,
    FailureInjectionRequest,
    LoginRequest,
    RerouteRequest,
    TokenResponse,
    TrafficSimulateRequest,
)
from app.services.audit_engine import AuditEngine
from app.services.demo_engine import DemoEngine
from app.services.explain_engine import ExplainEngine
from app.services.failure_engine import FailureEngine
from app.services.graph_engine import GraphEngine
from app.services.invariant_engine import InvariantEngine
from app.services.ml_engine import ml_engine
from app.services.rerouting_engine import ReroutingEngine
from app.services.risk_engine import RiskEngine
from app.services.traffic_engine import TrafficEngine
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

router = APIRouter()

# Component IDs must be alphanumeric plus dash/underscore only (e.g. "ENC-01").
# Blocks path traversal (`../`), slashes, and other injection-prone characters.
SAFE_ID_REGEX = re.compile(r"^[A-Za-z0-9_-]{1,64}$")

# ----------------------------------------------------
# 1. AUTHENTICATION & USERS
# ----------------------------------------------------
@router.post("/auth/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate with username/password and issue JWT token with enforced role."""
    if is_login_locked(req.username):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Account temporarily locked due to excessive failed attempts. Please wait 60 seconds."
        )

    user = db.query(User).filter(
        (User.username == req.username) | (User.email == req.username)
    ).first()
    if not user:
        record_failed_login(req.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password."
        )

    is_valid = verify_password(req.password, user.password_hash)
    if not is_valid and settings.ENV == "development":
        # Allow convenient development fallback passwords
        role_demo_passwords = {
            "ADMIN": ["admin123", settings.ADMIN_PASSWORD, "HSTAldqWJuGrFaH-iKU3lE91dBESYe5x"],
            "SECURITY_ANALYST": ["analyst123", settings.ANALYST_PASSWORD, "lHdCkHKx2qWlruAoc74Gt5yv9AyanfhQ"],
            "VIEWER": ["viewer123", settings.VIEWER_PASSWORD, "Q6xH8SAFkFlWJrAL1BE-rdqSZ09GF8G4"],
        }
        allowed = [p for p in role_demo_passwords.get(user.role, []) if p]
        if req.password in allowed:
            is_valid = True
            user.password_hash = get_password_hash(req.password)
            db.commit()

    if not is_valid:
        record_failed_login(req.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password."
        )

    clear_failed_logins(req.username)
    token = create_access_token({"sub": user.username, "role": user.role})
    
    AuditEngine.record_event(
        db,
        actor=user.username,
        action="USER_LOGIN",
        target=user.id,
        details={"role": user.role}
    )
    return {
        "access_token": token,
        "token_type": "bearer",  # nosec B105
        "user": user.to_dict()
    }

@router.get("/auth/me")
def get_me(user: User = Depends(require_auth)):
    """Retrieve authenticated session profile."""
    return user.to_dict()

@router.get("/auth/demo-users")
def get_demo_users():
    """Return available demo users for UI presets."""
    return [
        {"username": "admin", "email": settings.ADMIN_USER, "role": "ADMIN", "label": "SecOps Administrator (Full Access)"},
        {"username": "analyst", "email": settings.ANALYST_USER, "role": "SECURITY_ANALYST", "label": "Security Analyst (Remediation & Simulation)"},
        {"username": "viewer", "email": settings.VIEWER_USER, "role": "VIEWER", "label": "Auditor / Viewer (Read-Only)"},
    ]

# ----------------------------------------------------
# 2. ENFORCEMENT COMPONENTS
# ----------------------------------------------------
@router.get("/components")
def list_components(db: Session = Depends(get_db), user: User = Depends(require_auth)):
    """List all registered network and security enforcement components."""
    components = db.query(Component).all()
    return [c.to_dict() for c in components]

@router.get("/components/{id}")
def get_component(id: str, db: Session = Depends(get_db), user: User = Depends(require_auth)):
    """Get single component details by ID."""
    if not SAFE_ID_REGEX.match(id):
        raise HTTPException(status_code=400, detail="Invalid component ID format.")
    comp = db.query(Component).filter(Component.id == id).first()
    if not comp:
        raise HTTPException(status_code=404, detail=f"Component '{id}' not found.")
    return comp.to_dict()

@router.post("/components/{id}/recover")
def recover_component(
    id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(["ADMIN", "SECURITY_ANALYST"]))
):
    """Recover a failed component to HEALTHY and re-verify dependent paths."""
    if not SAFE_ID_REGEX.match(id):
        raise HTTPException(status_code=400, detail="Invalid component ID format.")
    result = FailureEngine.recover_component(db, id)
    AuditEngine.record_event(
        db,
        actor=user.username,
        action="COMPONENT_RECOVERED",
        target=id,
        details={"result": result}
    )
    return result

# ----------------------------------------------------
# 3. SECURITY INVARIANTS
# ----------------------------------------------------
@router.get("/invariants")
def list_invariants(db: Session = Depends(get_db), user: User = Depends(require_auth)):
    """List all defined security invariants and required control vectors."""
    invariants = db.query(SecurityInvariant).all()
    return [inv.to_dict() for inv in invariants]

@router.post("/invariants/verify")
def verify_all_invariants(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(["ADMIN", "SECURITY_ANALYST"]))
):
    """Deterministic path-level invariant verification across all active paths."""
    graph_engine = GraphEngine(db)
    summary = InvariantEngine.verify_all_paths(db, graph_engine)
    AuditEngine.record_event(
        db,
        actor=user.username,
        action="INVARIANTS_VERIFIED",
        target="ALL_PATHS",
        details={"guaranteed": summary["guaranteed"], "total": summary["total_paths"]}
    )
    return summary

# ----------------------------------------------------
# 4. TRAFFIC PATHS & SAFE REROUTING
# ----------------------------------------------------
@router.get("/paths")
def list_paths(db: Session = Depends(get_db), user: User = Depends(require_auth)):
    """List all traffic paths and their live invariant verdicts."""
    paths = db.query(TrafficPath).all()
    return [p.to_dict() for p in paths]

@router.get("/paths/affected")
def list_affected_paths(db: Session = Depends(get_db), user: User = Depends(require_auth)):
    """List paths currently in BLOCKED, VIOLATED, REROUTED, or AT_RISK state."""
    paths = db.query(TrafficPath).filter(
        TrafficPath.status.in_(["BLOCKED", "VIOLATED", "REROUTED", "AT_RISK", "NO_POLICY"])
    ).all()
    return [p.to_dict() for p in paths]

@router.post("/reroute")
def reroute_paths(
    req: RerouteRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(["ADMIN", "SECURITY_ANALYST"]))
):
    """
    Attempt invariant-verified safe rerouting.
    Only migrates traffic to candidate routes verified as GUARANTEED.
    """
    if req.path_id:
        result = ReroutingEngine.attempt_reroute_path(db, req.path_id)
    else:
        result = ReroutingEngine.reroute_all_affected(db)

    AuditEngine.record_event(
        db,
        actor=user.username,
        action="SAFE_REROUTE_EXECUTED",
        target=req.path_id or "ALL_AFFECTED_PATHS",
        details={"result": result}
    )
    return result

# ----------------------------------------------------
# 5. FAILURE INJECTION STUDIO
# ----------------------------------------------------
@router.post("/failures/inject")
def inject_failure(
    req: FailureInjectionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(["ADMIN", "SECURITY_ANALYST"]))
):
    """
    Inject targeted component failure and engage Targeted Fail-Safe.
    Isolates ONLY affected unsafe paths while preserving unrelated safe traffic.
    """
    result = FailureEngine.inject_failure(
        db,
        component_ids=req.component_ids,
        failure_type=req.failure_type
    )
    AuditEngine.record_event(
        db,
        actor=user.username,
        action="FAILURE_INJECTED",
        target=",".join(req.component_ids),
        details={"affected_paths": result.get("affected_paths_count", 0)}
    )
    return result

# ----------------------------------------------------
# 6. SIMULATED TRAFFIC & GROUND-TRUTH VERIFIER
# ----------------------------------------------------
@router.post("/traffic/simulate")
def simulate_traffic(
    req: TrafficSimulateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(["ADMIN", "SECURITY_ANALYST"]))
):
    """
    Simulate packet traversal across active paths and dynamically calculate safety metrics.
    Proves that unsafe_traffic_delivered == 0.
    """
    result = TrafficEngine.simulate_traffic(db, packet_count=req.packet_count)
    return result

@router.get("/traffic")
def get_recent_traffic(
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(require_auth)
):
    """Get recent packet logs for packet inspection."""
    packets = db.query(TrafficPacket).order_by(TrafficPacket.timestamp.desc()).limit(limit).all()
    return [p.to_dict() for p in packets]

@router.get("/traffic/stats")
def get_traffic_stats(db: Session = Depends(get_db), user: User = Depends(require_auth)):
    """Get aggregated traffic delivery and safety metrics dynamically computed from DB."""
    return TrafficEngine.get_traffic_stats(db)

# ----------------------------------------------------
# 7. INCIDENTS & AI SECURITY
# ----------------------------------------------------
@router.get("/incidents")
def list_incidents(db: Session = Depends(get_db), user: User = Depends(require_auth)):
    """List recorded security incidents and containment actions."""
    incidents = db.query(Incident).order_by(Incident.created_at.desc()).all()
    return [inc.to_dict() for inc in incidents]

@router.get("/ai/anomalies")
def get_ai_anomalies(
    scenario: str = Query(default="NORMAL", max_length=50),
    db: Session = Depends(get_db),
    user: User = Depends(require_auth)
):
    """
    Advisory Isolation Forest telemetry analysis and composite risk score.
    Strictly advisory — Invariant Engine holds 100% final authority.
    """
    analysis = ml_engine.evaluate_scenario(scenario)
    risk = RiskEngine.calculate_risk(db, anomaly_score=analysis["anomaly_score"])
    return {
        "telemetry_analysis": analysis,
        "risk_assessment": risk
    }

@router.post("/ai/explain")
def explain_decision(
    req: ExplainRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth)
):
    """Generate structured explainability narrative for path decision or incident."""
    if req.path_id:
        risk = RiskEngine.calculate_risk(db)
        return ExplainEngine.explain_path_decision(db, req.path_id, risk_score=risk["risk_score"])
    else:
        failed_comps = [c.id for c in db.query(Component).filter(Component.status != "HEALTHY").all()]
        affected_paths = [p.id for p in db.query(TrafficPath).filter(TrafficPath.status.in_(["BLOCKED", "VIOLATED"])).all()]
        risk = RiskEngine.calculate_risk(db)
        ml_res = ml_engine.evaluate_scenario("BURST_ANOMALY" if len(failed_comps) > 1 else ("SINGLE_FAILURE" if failed_comps else "NORMAL"))
        return ExplainEngine.explain_incident(
            db,
            failed_components=failed_comps,
            affected_paths=affected_paths,
            risk_score=risk["risk_score"],
            anomaly_score=ml_res["anomaly_score"]
        )

# ----------------------------------------------------
# 8. CRYPTOGRAPHIC AUDIT LEDGER
# ----------------------------------------------------
@router.get("/audit")
def get_audit_logs(
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    user: User = Depends(require_auth)
):
    """Retrieve entries from the tamper-evident SHA-256 hash-chained audit ledger."""
    logs = db.query(AuditLog).order_by(AuditLog.id.desc()).limit(limit).all()
    return [l.to_dict() for l in logs]

@router.get("/audit/verify")
@router.post("/audit/verify")
def verify_audit_ledger(db: Session = Depends(get_db), user: User = Depends(require_auth)):
    return AuditEngine.verify_integrity(db)

# ----------------------------------------------------
# 9. JUDGE DEMO MODE
# ----------------------------------------------------
@router.post("/demo/run")
def run_judge_demo(
    packet_count: int = Query(default=1000, ge=10, le=10000),
    db: Session = Depends(get_db),
    user: User = Depends(require_role(["ADMIN", "SECURITY_ANALYST"]))
):
    """Run automated 8-step end-to-end evaluation showcase for hackathon judges."""
    return DemoEngine.run_judge_demo(db, packet_count=packet_count)

@router.post("/demo/reset")
def reset_demo_environment(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(["ADMIN"]))
):
    """Reset topology and security fabric to baseline. Strictly ADMIN only."""
    seed_database(db, reset=True)
    AuditEngine.record_event(
        db,
        actor=user.username,
        action="DEMO_ENVIRONMENT_RESET",
        target="TOPOLOGY",
        details={"status": "HEALTHY"}
    )
    return {"status": "SUCCESS", "message": "Demo topology reset to healthy baseline."}

# ----------------------------------------------------
# 10. NETWORK GRAPH TOPOLOGY
# ----------------------------------------------------
@router.get("/graph/topology")
def get_graph_topology(db: Session = Depends(get_db), user: User = Depends(require_auth)):
    """Get active graph topology structure with zones, nodes, and reachability."""
    graph_engine = GraphEngine(db)
    return graph_engine.get_topology_snapshot()
