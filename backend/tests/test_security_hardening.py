import datetime
import pytest
from datetime import timedelta
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient
import jwt

from app.main import app
from app.config import settings
from app.database import get_db
from app.models.component import Component
from app.models.invariant import TrafficPath, SecurityInvariant
from app.models.audit import AuditLog
from app.core.security import create_access_token, get_password_hash, record_failed_login, clear_failed_logins
from app.services.graph_engine import GraphEngine
from app.services.invariant_engine import InvariantEngine
from app.services.failure_engine import FailureEngine
from app.services.rerouting_engine import ReroutingEngine
from app.services.traffic_engine import TrafficEngine
from app.services.audit_engine import AuditEngine

client = TestClient(app)


# =====================================================================
# 1. AUTHENTICATION & JWT SECURITY TESTS
# =====================================================================

def test_unauthenticated_requests_rejected(db_session: Session):
    """Protected endpoints must reject unauthenticated requests with 401."""
    def override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = override_get_db
    try:
        endpoints = [
            ("GET", "/api/components"),
            ("GET", "/api/invariants"),
            ("GET", "/api/paths"),
            ("POST", "/api/traffic/simulate", {"packet_count": 100}),
            ("POST", "/api/failures/inject", {"component_ids": ["ENC-01"]}),
            ("POST", "/api/reroute", {}),
            ("POST", "/api/demo/reset", {}),
            ("POST", "/api/audit/verify", {}),
        ]
        for method, path, *body in endpoints:
            if method == "GET":
                r = client.get(path)
            else:
                data = body[0] if body else {}
                r = client.post(path, json=data)
            assert r.status_code == 401, f"Expected 401 for {method} {path}, got {r.status_code}"
    finally:
        app.dependency_overrides.clear()


def test_invalid_and_malformed_jwt(db_session: Session):
    """Invalid, forged, or malformed JWT tokens must be rejected with 401."""
    def override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = override_get_db
    try:
        # 1. Completely bogus string
        r = client.get("/api/components", headers={"Authorization": "Bearer not-a-valid-token"})
        assert r.status_code == 401

        # 2. Token signed with wrong key
        forged_token = jwt.encode(
            {"sub": "admin", "role": "ADMIN", "exp": datetime.datetime.now(datetime.timezone.utc) + timedelta(hours=1)},
            "WRONG_SECRET_KEY_1234567890123456",
            algorithm="HS256"
        )
        r = client.get("/api/components", headers={"Authorization": f"Bearer {forged_token}"})
        assert r.status_code == 401

        # 3. Expired token
        expired_token = jwt.encode(
            {"sub": "admin", "role": "ADMIN", "exp": datetime.datetime.now(datetime.timezone.utc) - timedelta(hours=2)},
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM
        )
        r = client.get("/api/components", headers={"Authorization": f"Bearer {expired_token}"})
        assert r.status_code == 401

        # 4. Token without required sub
        no_sub_token = jwt.encode(
            {"role": "ADMIN", "exp": datetime.datetime.now(datetime.timezone.utc) + timedelta(hours=1)},
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM
        )
        r = client.get("/api/components", headers={"Authorization": f"Bearer {no_sub_token}"})
        assert r.status_code == 401
    finally:
        app.dependency_overrides.clear()


def test_failed_login_rate_limiting():
    """Consecutive failed login attempts must trigger rate limit 429."""
    username = "ratelimit_test_user"
    clear_failed_logins(username)
    for _ in range(5):
        record_failed_login(username)

    r = client.post("/api/auth/login", json={"username": username, "password": "WrongPassword123!"})
    assert r.status_code == 429
    assert "locked" in r.json()["detail"].lower()
    clear_failed_logins(username)


# =====================================================================
# 2. SERVER-SIDE ROLE-BASED ACCESS CONTROL (RBAC) TESTS
# =====================================================================

def test_viewer_role_cannot_perform_mutations(db_session: Session):
    """VIEWER role must receive 403 Forbidden on all state-mutating endpoints."""
    def override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = override_get_db
    try:
        viewer_token = create_access_token({"sub": "viewer", "role": "VIEWER"})
        viewer_headers = {"Authorization": f"Bearer {viewer_token}"}

        # VIEWER can read
        r = client.get("/api/components", headers=viewer_headers)
        assert r.status_code == 200

        # VIEWER cannot inject failures
        r = client.post("/api/failures/inject", json={"component_ids": ["ENC-01"]}, headers=viewer_headers)
        assert r.status_code == 403

        # VIEWER cannot reroute
        r = client.post("/api/reroute", json={}, headers=viewer_headers)
        assert r.status_code == 403

        # VIEWER cannot recover components
        r = client.post("/api/components/ENC-01/recover", headers=viewer_headers)
        assert r.status_code == 403

        # VIEWER cannot simulate traffic
        r = client.post("/api/traffic/simulate", json={"packet_count": 100}, headers=viewer_headers)
        assert r.status_code == 403

        # VIEWER cannot reset demo
        r = client.post("/api/demo/reset", headers=viewer_headers)
        assert r.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_security_analyst_permissions(db_session: Session):
    """SECURITY_ANALYST can inject, reroute, recover, simulate, but CANNOT reset."""
    def override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = override_get_db
    try:
        analyst_token = create_access_token({"sub": "analyst", "role": "SECURITY_ANALYST"})
        analyst_headers = {"Authorization": f"Bearer {analyst_token}"}

        # Analyst can inject failure
        r = client.post("/api/failures/inject", json={"component_ids": ["ENC-01"]}, headers=analyst_headers)
        assert r.status_code == 200

        # Analyst can reroute
        r = client.post("/api/reroute", json={}, headers=analyst_headers)
        assert r.status_code == 200

        # Analyst can recover
        r = client.post("/api/components/ENC-01/recover", headers=analyst_headers)
        assert r.status_code == 200

        # Analyst can simulate traffic
        r = client.post("/api/traffic/simulate", json={"packet_count": 100}, headers=analyst_headers)
        assert r.status_code == 200

        # Analyst CANNOT reset demo (ADMIN only)
        r = client.post("/api/demo/reset", headers=analyst_headers)
        assert r.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_admin_permissions(db_session: Session):
    """ADMIN role has full access including demo reset."""
    def override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = override_get_db
    try:
        admin_token = create_access_token({"sub": "admin", "role": "ADMIN"})
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        r = client.post("/api/demo/reset", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["status"] == "SUCCESS"
    finally:
        app.dependency_overrides.clear()


# =====================================================================
# 3. INVARIANT SEMANTICS & NO_POLICY VERIFICATION
# =====================================================================

def test_unconfigured_path_returns_no_policy_not_guaranteed(db_session: Session):
    """An unassigned or unconfigured path must return NO_POLICY and NEVER GUARANTEED."""
    graph_engine = GraphEngine(db_session)
    
    # Create an arbitrary unassigned path
    unassigned_path = TrafficPath(
        id="PATH-TEST-UNCONFIGURED",
        name="Arbitrary Test Path",
        source_node="NODE-INTERNET",
        destination_node="NODE-DB",
        current_hops=["FW-01", "APP-01"],
        status="ACTIVE",
        applicable_invariant_id=None
    )
    db_session.add(unassigned_path)
    db_session.commit()

    verdict_info = InvariantEngine.verify_path(db_session, unassigned_path, graph_engine)
    assert verdict_info["verdict"] == "NO_POLICY"
    assert verdict_info["verdict"] != "GUARANTEED"
    assert "No security invariant assigned" in verdict_info["reason"]

    # Rerouting engine requires GUARANTEED verdict, so unassigned path cannot be rerouted
    reroute_res = ReroutingEngine.attempt_reroute_path(db_session, unassigned_path.id)
    assert reroute_res["rerouted"] is False


# =====================================================================
# 4. REROUTING ENGINE COMPLIANCE & PRESERVATION
# =====================================================================

def test_rerouting_engine_enforces_guaranteed_routes_only(db_session: Session):
    """Rerouting engine strictly accepts candidate routes ONLY when verdict == GUARANTEED."""
    # Fail ENC-01 to affect PCI paths
    FailureEngine.inject_failure(db_session, ["ENC-01"])
    pci_path = db_session.query(TrafficPath).filter(TrafficPath.id == "PATH-PCI-TX-01").first()
    assert pci_path.status == "BLOCKED"

    reroute_res = ReroutingEngine.attempt_reroute_path(db_session, pci_path.id)
    assert reroute_res["rerouted"] is True
    assert reroute_res["invariant_guaranteed"] is True
    assert reroute_res["structured_explanation"]["verification"] == "GUARANTEED"
    assert "ENC-02" in reroute_res["new_hops"]
    assert "ENC-01" not in reroute_res["new_hops"]


# =====================================================================
# 5. TRAFFIC SAFETY & DYNAMIC UNSAFE TRAFFIC CALCULATION
# =====================================================================

def test_unsafe_traffic_strictly_zero_and_dynamically_computed(db_session: Session):
    """Under all conditions, unsafe_traffic_delivered must be dynamically computed as 0."""
    # Baseline
    t1 = TrafficEngine.simulate_traffic(db_session, packet_count=500)
    assert t1["unsafe_traffic_delivered"] == 0
    assert t1["packets_delivered"] == 500

    # Under Failure
    FailureEngine.inject_failure(db_session, ["ENC-01"])
    t2 = TrafficEngine.simulate_traffic(db_session, packet_count=500)
    assert t2["unsafe_traffic_delivered"] == 0
    assert t2["packets_blocked"] > 0
    assert t2["safe_packets_delivered"] + t2["packets_blocked"] == 500

    # Traffic stats endpoint dynamic verification
    stats = TrafficEngine.get_traffic_stats(db_session)
    assert stats["unsafe_traffic_delivered"] == 0
    assert stats["safety_invariant_holds"] is True


# =====================================================================
# 6. TAMPER-EVIDENT SHA-256 HASH CHAIN AUDIT TESTS
# =====================================================================

def test_audit_hash_chain_tamper_detection(db_session: Session):
    """Audit ledger must detect payload tampering and previous_hash alteration."""
    # Record events
    AuditEngine.record_event(db_session, actor="admin", action="TEST_ACTION_1", target="T1")
    AuditEngine.record_event(db_session, actor="admin", action="TEST_ACTION_2", target="T2")
    AuditEngine.record_event(db_session, actor="admin", action="TEST_ACTION_3", target="T3")

    # Initial state should be verified
    verification = AuditEngine.verify_integrity(db_session)
    assert verification["valid"] is True
    assert verification["status"] == "VERIFIED"

    # TAMPER CASE 1: Modify payload of the second log entry
    logs = db_session.query(AuditLog).order_by(AuditLog.id.asc()).all()
    assert len(logs) >= 3
    tampered_log = logs[-2]
    original_action = tampered_log.action
    tampered_log.action = "TAMPERED_ACTION_FORGED"
    db_session.commit()

    tamper_check = AuditEngine.verify_integrity(db_session)
    assert tamper_check["valid"] is False
    assert tamper_check["status"] == "COMPROMISED"
    assert "Tampering detected" in tamper_check["message"]

    # Revert modification
    tampered_log.action = original_action
    db_session.commit()

    reverted_check = AuditEngine.verify_integrity(db_session)
    assert reverted_check["valid"] is True

    # TAMPER CASE 2: Modify previous_hash link
    tampered_log.previous_hash = "0000000000000000000000000000000000000000000000000000000000000000"
    db_session.commit()

    tamper_check_2 = AuditEngine.verify_integrity(db_session)
    assert tamper_check_2["valid"] is False
    assert tamper_check_2["status"] == "COMPROMISED"


# =====================================================================
# 7. INPUT VALIDATION TESTS
# =====================================================================

def test_input_validation_boundaries(db_session: Session):
    """Endpoints must reject invalid payload bounds and path traversal attempts."""
    def override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = override_get_db
    try:
        admin_token = create_access_token({"sub": "admin", "role": "ADMIN"})
        headers = {"Authorization": f"Bearer {admin_token}"}

        # Packet count out of bounds (< 1)
        r = client.post("/api/traffic/simulate", json={"packet_count": 0}, headers=headers)
        assert r.status_code == 422

        # Packet count out of bounds (> 50,000)
        r = client.post("/api/traffic/simulate", json={"packet_count": 50001}, headers=headers)
        assert r.status_code == 422

        # Malicious component ID with path traversal rejected by Pydantic validator
        r = client.post(
            "/api/failures/inject",
            json={"component_ids": ["../../etc/passwd"]},
            headers=headers
        )
        assert r.status_code == 422

        # Malicious component ID with SQL/Command injection characters rejected by regex
        r = client.get("/api/components/COMP-01;DROP", headers=headers)
        assert r.status_code == 400

        # Invalid failure type in injection
        r = client.post(
            "/api/failures/inject",
            json={"component_ids": ["ENC-01"], "failure_type": "DROP_TABLE_USERS"},
            headers=headers
        )
        assert r.status_code == 422
    finally:
        app.dependency_overrides.clear()



# =====================================================================
# 8. SECURITY HEADERS TESTS
# =====================================================================

def test_security_headers_present():
    """All HTTP responses must include defense-in-depth security headers."""
    r = client.get("/health")
    assert r.status_code == 200
    # Basic hardening headers
    assert r.headers.get("X-Content-Type-Options") == "nosniff"
    assert r.headers.get("X-Frame-Options") == "DENY"
    assert r.headers.get("Referrer-Policy") == "no-referrer"
    assert "X-XSS-Protection" in r.headers
    # Content-Security-Policy: must be present and restrict to self
    csp = r.headers.get("Content-Security-Policy", "")
    assert "default-src 'self'" in csp, f"CSP missing or weak: {csp}"
    assert "frame-ancestors 'none'" in csp, f"CSP must block framing: {csp}"
    # HSTS: must be present (honoured by browsers once deployed over HTTPS)
    hsts = r.headers.get("Strict-Transport-Security", "")
    assert "max-age=" in hsts, f"HSTS header missing: {hsts}"
    # Permissions-Policy: must disable dangerous browser features
    pp = r.headers.get("Permissions-Policy", "")
    assert "geolocation=()" in pp, f"Permissions-Policy missing geolocation restriction: {pp}"


def test_csrf_protection_on_post_endpoints():
    """State-changing endpoints must reject POSTs without a valid CSRF token."""
    import os
    # Temporarily disable TESTING bypass so CSRF middleware actually enforces
    original = os.environ.get("TESTING", "true")
    os.environ["TESTING"] = "false"
    try:
        # POST without CSRF token or cookie should get 403 (CSRF check runs before auth)
        r = client.post("/api/audit/verify", json={})
        assert r.status_code == 403, f"Expected CSRF 403, got {r.status_code}: {r.text}"
        assert "CSRF" in r.json().get("detail", ""), f"Expected CSRF message, got: {r.json()}"

        # POST with matching CSRF cookie + header should pass CSRF check
        csrf_val = "test_csrf_token_abc123secure"
        client.cookies.set("csrf_token", csrf_val)
        r2 = client.post(
            "/api/audit/verify",
            json={},
            headers={"X-CSRF-Token": csrf_val}
        )
        # CSRF passes — now auth check kicks in (401), not CSRF block (403)
        assert r2.status_code in (200, 401, 422), (
            f"CSRF-valid request should not be CSRF-blocked, got {r2.status_code}: {r2.text}"
        )
        # Mismatched token must still be rejected
        r3 = client.post(
            "/api/audit/verify",
            json={},
            headers={"X-CSRF-Token": "wrong_token"}
        )
        assert r3.status_code == 403
        assert "mismatch" in r3.json().get("detail", "").lower()
    finally:
        os.environ["TESTING"] = original
        client.cookies.clear()

