from app.config import settings
from app.core.security import (
    create_access_token,
    decode_access_token,
    get_password_hash,
    verify_password,
)
from app.main import app
from app.services.audit_engine import AuditEngine
from app.services.explain_engine import ExplainEngine
from app.services.failure_engine import FailureEngine
from app.services.ml_engine import ml_engine
from app.services.rerouting_engine import ReroutingEngine
from app.services.risk_engine import RiskEngine
from app.services.traffic_engine import TrafficEngine
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

def test_traffic_safety_property(db_session: Session):
    """
    CENTRAL SAFETY ASSERTION:
    Under baseline, single failure, and rerouting, unsafe_traffic_delivered MUST BE 0.
    """
    # 1. Baseline: 1000 packets -> all delivered safe
    res1 = TrafficEngine.simulate_traffic(db_session, packet_count=1000)
    assert res1["unsafe_traffic_delivered"] == 0
    assert res1["packets_delivered"] == 1000
    assert res1["safety_guarantee_verified"] is True

    # 2. Failure of ENC-01: Targeted Fail-Safe isolates 3 PCI paths
    FailureEngine.inject_failure(db_session, ["ENC-01"])
    res2 = TrafficEngine.simulate_traffic(db_session, packet_count=1000)
    assert res2["unsafe_traffic_delivered"] == 0
    assert res2["packets_blocked"] == 300
    assert res2["safe_packets_delivered"] == 700
    assert res2["safe_traffic_preserved_pct"] == 70.0
    assert res2["safety_guarantee_verified"] is True

    # 3. Reroute via ENC-02: All 10 paths become operational again
    ReroutingEngine.reroute_all_affected(db_session)
    res3 = TrafficEngine.simulate_traffic(db_session, packet_count=1000)
    assert res3["unsafe_traffic_delivered"] == 0
    assert res3["safe_packets_delivered"] == 1000
    assert res3["safe_traffic_preserved_pct"] == 100.0
    assert res3["safety_guarantee_verified"] is True


def test_deterministic_risk_scoring(db_session: Session):
    """Test normalized 0-100 risk score and factor breakdown."""
    # Healthy baseline -> risk is 0
    baseline_risk = RiskEngine.calculate_risk(db_session, anomaly_score=0.0)
    assert baseline_risk["risk_score"] == 0.0
    assert baseline_risk["risk_level"] == "LOW"

    # Inject critical failure (ENC-01)
    FailureEngine.inject_failure(db_session, ["ENC-01"])
    risk = RiskEngine.calculate_risk(db_session, anomaly_score=0.75)
    assert 50.0 <= risk["risk_score"] <= 100.0
    assert risk["risk_level"] in ["HIGH", "CRITICAL"]
    assert "severity_score" in risk["factors"]
    assert "blast_radius" in risk["factors"]
    assert "anomaly_score" in risk["factors"]
    assert "cascading_risk" in risk["factors"]


def test_ml_anomaly_detection():
    """Test Isolation Forest anomaly detection on normal vs burst telemetry."""
    normal_res = ml_engine.evaluate_scenario("NORMAL")
    assert normal_res["is_anomaly"] is False
    assert normal_res["anomaly_score"] < 0.65

    burst_res = ml_engine.evaluate_scenario("BURST_ANOMALY")
    assert burst_res["is_anomaly"] is True
    assert burst_res["anomaly_score"] >= 0.65
    assert len(burst_res["contributing_metrics"]) > 0


def test_audit_hash_chain_and_tamper_detection(db_session: Session):
    """Test SHA-256 blockchain-style hash chaining and detection of altered records."""
    # 1. Record 3 audit events
    log1 = AuditEngine.record_event(db_session, "admin", "TEST_ACTION_1", "SYS", {"k": 1})
    log2 = AuditEngine.record_event(db_session, "analyst", "TEST_ACTION_2", "ENC-01", {"k": 2})
    log3 = AuditEngine.record_event(db_session, "system", "TEST_ACTION_3", "DLP-01", {"k": 3})

    assert log2.previous_hash == log1.current_hash
    assert log3.previous_hash == log2.current_hash

    # 2. Verify ledger integrity passes
    verify_res = AuditEngine.verify_integrity(db_session)
    assert verify_res["valid"] is True

    # 3. Simulate malicious tampering with record #2 payload
    log2.details = {"malicious_tamper": True}
    db_session.commit()

    # 4. Integrity check MUST detect tampering
    tampered_res = AuditEngine.verify_integrity(db_session)
    assert tampered_res["valid"] is False
    assert tampered_res["tampered_record_id"] == log2.id
    assert tampered_res["error_type"] == "PAYLOAD_ALTERED"


def test_path_decision_explainability(db_session: Session):
    """Test structured explanation format for blocked and guaranteed paths."""
    FailureEngine.inject_failure(db_session, ["ENC-01"])
    explanation = ExplainEngine.explain_path_decision(db_session, "PATH-PCI-TX-01", risk_score=82.5)

    assert explanation["path_id"] == "PATH-PCI-TX-01"
    assert explanation["decision"] == "BLOCKED"
    assert "PCI Boundary Protection" in explanation["broken_invariant"]
    assert "ENCRYPTION_GATEWAY" in explanation["required_controls"]
    assert "ENC-01" in explanation["compromised_enforcement_points"]
    assert len(explanation["narrative"]) > 20


def test_auth_and_rbac():
    """Test password hashing and JWT token issuance."""
    pwd = "SecOpsSecret2026!"
    hashed = get_password_hash(pwd)
    assert verify_password(pwd, hashed) is True
    assert verify_password("WrongPassword", hashed) is False

    token = create_access_token({"sub": "analyst", "role": "SECURITY_ANALYST"})
    payload = decode_access_token(token)
    assert payload["sub"] == "analyst"
    assert payload["role"] == "SECURITY_ANALYST"


def test_api_endpoints_live():
    """Test primary REST API endpoints with authentication and RBAC."""
    with TestClient(app) as client:
        # Health endpoint
        r = client.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] == "HEALTHY"
        assert "subsystems" in r.json()

        # Login as analyst to obtain bearer token
        login_res = client.post(
            "/api/auth/login",
            json={"username": settings.ANALYST_USER, "password": settings.ANALYST_PASSWORD}
        )
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # List components
        r = client.get("/api/components", headers=headers)
        assert r.status_code == 200
        assert len(r.json()) == 8

        # List invariants
        r = client.get("/api/invariants", headers=headers)
        assert r.status_code == 200
        assert len(r.json()) == 4

        # List paths
        r = client.get("/api/paths", headers=headers)
        assert r.status_code == 200
        assert len(r.json()) == 10

        # Traffic simulation (requires auth)
        r = client.post("/api/traffic/simulate", json={"packet_count": 500}, headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert data["total_packets"] == 500
        assert data["unsafe_traffic_delivered"] == 0

        # Full Judge Demo (requires auth)
        r = client.post("/api/demo/run?packet_count=100", headers=headers)
        assert r.status_code == 200
        demo_data = r.json()
        assert demo_data["demo_status"] == "SUCCESS"
        assert demo_data["scorecard"]["unsafe_traffic_delivered"] == 0
        assert len(demo_data["timeline"]) == 8
