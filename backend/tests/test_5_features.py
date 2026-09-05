"""
Test suite covering the 5 upgrade capabilities in InvariantHold:
1. Predictive Invariant Failure
2. Digital Twin + What-If Simulation
3. Autonomous Safe Recovery
4. Blast Radius + Attack Path Analysis
5. Chaos Security Testing
"""

from app.config import settings
from app.main import app
from app.services.blast_radius_engine import BlastRadiusEngine
from app.services.chaos_engine import ChaosEngine
from app.services.prediction_engine import PredictionEngine
from app.services.recovery_engine import RecoveryEngine, get_recovery_mode, set_recovery_mode
from app.services.simulation_engine import SimulationEngine
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


def test_predictive_invariant_failure_service(db_session: Session):
    """Test telemetry-based degradation prediction and advisory early warnings."""
    result = PredictionEngine.predict_all(db_session)
    assert "predictions" in result
    assert result["total_components"] == 8
    assert len(result["predictions"]) == 8

    for p in result["predictions"]:
        assert "component_id" in p
        assert 0.0 <= p["failure_probability"] <= 100.0
        assert p["risk_level"] in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
        assert "contributing_features" in p
        assert "advisory_note" in p
        assert "explanation" in p


def test_digital_twin_what_if_isolation(db_session: Session):
    """Test Digital Twin creates in-memory clone and leaves live database unmodified."""
    twin = SimulationEngine.create_twin(db_session, label="Test Clone")
    sim_id = twin["simulation_id"]
    assert len(sim_id) > 0
    assert twin["status"] == "READY"

    scenario = {
        "type": "COMPONENT_FAILURE",
        "targets": ["ENC-01"],
        "parameters": {},
    }
    applied = SimulationEngine.apply_scenario(sim_id, scenario)
    assert applied["simulation_id"] == sim_id
    assert applied["status"] == "SCENARIO_APPLIED"

    verification = SimulationEngine.run_verification(sim_id)
    assert verification["simulation_id"] == sim_id
    assert verification["live_state_modified"] is False
    assert "summary" in verification
    assert "path_results" in verification


def test_autonomous_safe_recovery_modes(db_session: Session):
    """Test MONITOR, RECOMMEND, and AUTO modes with safety guarantee enforcement."""
    # Check default mode
    mode = get_recovery_mode()
    assert mode in ["MONITOR", "RECOMMEND", "AUTO"]

    # Switch to RECOMMEND mode
    updated = set_recovery_mode("RECOMMEND")
    assert updated == "RECOMMEND"
    assert get_recovery_mode() == "RECOMMEND"

    # Assess recovery posture
    assessment = RecoveryEngine.assess(db_session)
    assert "path_assessments" in assessment
    assert "mode" in assessment
    assert "affected_paths_count" in assessment

    # Switch to AUTO mode and execute recovery
    set_recovery_mode("AUTO")
    exec_res = RecoveryEngine.execute_recovery(db_session, actor="AUTO_TEST_RUNNER")
    assert "unsafe_traffic_delivered" in exec_res
    assert exec_res["unsafe_traffic_delivered"] == 0
    assert exec_res["safety_guarantee"] == "PASS"


def test_blast_radius_and_attack_path_analysis(db_session: Session):
    """Test transitive blast radius cascade and multi-hop attack path discovery."""
    # Blast radius of core authentication/encryption component
    blast = BlastRadiusEngine.calculate(db_session, component_ids=["AUTH-01"])
    assert blast["analysis_type"] == "BLAST_RADIUS"
    assert blast["failed_components"] == ["AUTH-01"]
    assert "affected_paths" in blast
    assert "affected_paths_count" in blast
    assert "affected_invariants" in blast

    # Attack paths originating from DMZ ingress (FW-01)
    attack_data = BlastRadiusEngine.analyze_attack_paths(db_session, entry_component_id="FW-01")
    assert attack_data["entry_component"] == "FW-01"
    assert "attack_paths" in attack_data
    assert "total_paths_analyzed" in attack_data
    assert "exploitable_paths" in attack_data


def test_chaos_security_testing_engine(db_session: Session):
    """Test controlled chaos injection on sandbox with 0 live database modification."""
    # Single scenario
    scenario = ChaosEngine.run_scenario(
        db_session,
        chaos_type="ENCRYPTION_FAILURE",
        components=["ENC-01"],
        label="Test Chaos",
        intensity=1.0
    )
    assert scenario["chaos_type"] == "ENCRYPTION_FAILURE"
    assert scenario["live_state_modified"] is False
    assert scenario["unsafe_traffic_delivered"] == 0
    assert scenario["result"] == "PASS"

    # Batch suite
    batch = ChaosEngine.run_batch(db_session, test_type="SINGLE")
    assert "batch_id" in batch
    assert "report" in batch
    assert batch["report"]["passed"] >= 0

    # Resilience report
    report = ChaosEngine.generate_report(batch.get("results", []))
    assert "security_guarantee" in report
    assert report["unsafe_traffic_delivered"] == 0


def test_api_routes_5_features(db_session: Session):
    """Test REST endpoints for all 5 features with authentication."""
    with TestClient(app) as client:
        login_res = client.post(
            "/api/auth/login",
            json={"username": settings.ADMIN_USER, "password": settings.ADMIN_PASSWORD}
        )
        assert login_res.status_code == 200
        headers = {"Authorization": f"Bearer {login_res.json()['access_token']}"}

        # 1. Predictions endpoint
        r = client.get("/api/predictions", headers=headers)
        assert r.status_code == 200
        res_json = r.json()
        assert "predictions" in res_json
        assert len(res_json["predictions"]) == 8

        # 2. Digital Twin What-If endpoint
        r = client.post(
            "/api/simulation/what-if",
            json={
                "scenario_type": "COMPONENT_FAILURE",
                "target_nodes": ["ENC-01"],
                "parameters": {"packet_count": 500}
            },
            headers=headers
        )
        assert r.status_code == 200
        assert r.json()["live_state_modified"] is False

        # 3. Autonomous Recovery Mode & Plan
        r = client.get("/api/recovery/mode", headers=headers)
        assert r.status_code == 200
        assert "mode" in r.json()

        r = client.get("/api/recovery/plan", headers=headers)
        assert r.status_code == 200
        assert "path_assessments" in r.json()

        # 4. Blast Radius endpoint
        r = client.post(
            "/api/blast-radius",
            json={"component_ids": ["AUTH-01"]},
            headers=headers
        )
        assert r.status_code == 200
        assert r.json()["analysis_type"] == "BLAST_RADIUS"

        # 5. Chaos Security Testing
        r = client.post(
            "/api/chaos/run",
            json={"chaos_type": "FIREWALL_FAILURE", "intensity": 0.5},
            headers=headers
        )
        assert r.status_code == 200
        assert r.json()["live_state_modified"] is False
        assert r.json()["unsafe_traffic_delivered"] == 0

        # Chaos Report endpoint
        r = client.get("/api/chaos/report", headers=headers)
        assert r.status_code == 200
        assert "security_guarantee" in r.json()
