from app.config import settings
from app.core.security import verify_password
from app.core.topology_seed import seed_database
from app.models.component import Component
from app.models.invariant import SecurityInvariant, TrafficPath
from app.models.traffic import Incident
from app.services.audit_engine import AuditEngine
from app.services.explain_engine import ExplainEngine
from app.services.failure_engine import FailureEngine
from app.services.graph_engine import GraphEngine
from app.services.invariant_engine import InvariantEngine
from app.services.ml_engine import ml_engine
from app.services.rerouting_engine import ReroutingEngine
from app.services.traffic_engine import TrafficEngine
from sqlalchemy.orm import Session


def test_full_23_step_acceptance_scenario(db_session: Session):
    """
    SECTION 44 — FINAL ACCEPTANCE TEST
    Systematically executes and asserts the exact 23-step lifecycle.
    """
    # -------------------------------------------------------------
    # Step 1: Start clean environment
    # -------------------------------------------------------------
    seed_database(db_session, reset=True)
    assert db_session.query(Component).count() == 8
    assert db_session.query(TrafficPath).count() == 10
    assert db_session.query(SecurityInvariant).count() == 4

    # -------------------------------------------------------------
    # Step 2: Login as security analyst
    # -------------------------------------------------------------
    from app.models.auth import User
    analyst = db_session.query(User).filter(User.username == "analyst").first()
    assert analyst is not None
    assert analyst.role == "SECURITY_ANALYST"
    assert verify_password(settings.ANALYST_PASSWORD, analyst.password_hash) is True

    # -------------------------------------------------------------
    # Step 3: Load fintech demo topology
    # -------------------------------------------------------------
    graph_engine = GraphEngine(db_session)
    assert graph_engine.graph.number_of_nodes() == 13
    assert graph_engine.graph.number_of_edges() >= 15

    # -------------------------------------------------------------
    # Step 4: Verify all invariants
    # -------------------------------------------------------------
    inv_summary = InvariantEngine.verify_all_paths(db_session, graph_engine)
    assert inv_summary["total_paths"] == 10
    assert inv_summary["guaranteed"] == 10
    assert inv_summary["violated"] == 0
    assert inv_summary["blocked"] == 0

    # -------------------------------------------------------------
    # Step 5: Generate 1000 packets
    # -------------------------------------------------------------
    t1 = TrafficEngine.simulate_traffic(db_session, packet_count=1000)
    assert t1["total_packets"] == 1000

    # -------------------------------------------------------------
    # Step 6: Confirm safe traffic delivered
    # -------------------------------------------------------------
    assert t1["packets_delivered"] == 1000
    assert t1["unsafe_traffic_delivered"] == 0
    assert t1["safe_traffic_preserved_pct"] == 100.0

    # -------------------------------------------------------------
    # Step 7: Fail encryption gateway (ENC-01)
    # -------------------------------------------------------------
    fail_res = FailureEngine.inject_failure(db_session, ["ENC-01"], failure_type="PRIMARY_ENCRYPTION_FAIL")
    assert fail_res["action"] == "FAILURE_INJECTED"
    enc = db_session.query(Component).filter(Component.id == "ENC-01").first()
    assert enc.status == "FAILED"

    # -------------------------------------------------------------
    # Step 8: Recalculate affected paths
    # -------------------------------------------------------------
    affected_ids = [p["id"] for p in fail_res["affected_paths"]]
    assert len(affected_ids) == 3
    assert "PATH-PCI-TX-01" in affected_ids
    assert "PATH-PCI-TX-02" in affected_ids
    assert "PATH-PCI-RECURRING" in affected_ids

    # -------------------------------------------------------------
    # Step 9: Block only affected unsafe paths
    # -------------------------------------------------------------
    for p_dict in fail_res["affected_paths"]:
        assert p_dict["status"] == "BLOCKED"

    # -------------------------------------------------------------
    # Step 10: Confirm safe paths remain operational
    # -------------------------------------------------------------
    assert fail_res["safe_paths_count"] == 7
    assert fail_res["safe_path_preservation_pct"] == 70.0
    web_catalog = db_session.query(TrafficPath).filter(TrafficPath.id == "PATH-WEB-CATALOG").first()
    assert web_catalog.status == "GUARANTEED"

    # -------------------------------------------------------------
    # Step 11: Search alternate route
    # -------------------------------------------------------------
    pci_path = db_session.query(TrafficPath).filter(TrafficPath.id == "PATH-PCI-TX-01").first()
    candidates = graph_engine.find_candidate_alternate_paths(db_session, pci_path)
    assert len(candidates) > 0
    has_enc02 = any("ENC-02" in hops for hops in candidates)
    assert has_enc02 is True

    # -------------------------------------------------------------
    # Step 12: Reroute when possible
    # -------------------------------------------------------------
    batch_reroute = ReroutingEngine.reroute_all_affected(db_session)
    assert batch_reroute["rerouted_count"] == 3
    assert batch_reroute["still_blocked_count"] == 0

    # -------------------------------------------------------------
    # Step 13: Generate traffic again
    # -------------------------------------------------------------
    t2 = TrafficEngine.simulate_traffic(db_session, packet_count=1000)

    # -------------------------------------------------------------
    # Step 14: Confirm unsafe delivered packets = 0
    # -------------------------------------------------------------
    assert t2["unsafe_traffic_delivered"] == 0
    assert t2["safe_packets_delivered"] == 1000
    assert t2["safe_traffic_preserved_pct"] == 100.0

    # -------------------------------------------------------------
    # Step 15: Confirm invariant restored
    # -------------------------------------------------------------
    db_session.refresh(pci_path)
    assert pci_path.status == "REROUTED"
    assert "ENC-02" in pci_path.current_hops

    # -------------------------------------------------------------
    # Step 16: Trigger anomalous failure burst
    # -------------------------------------------------------------
    burst_features = {
        "failure_frequency": 0.85,
        "failed_component_count": 4,
        "packet_rate": 270.0,
        "average_latency": 9.2,
        "packet_loss": 7.5,
        "invariant_violation_count": 5,
        "path_change_frequency": 0.8,
        "recovery_frequency": 0.0
    }

    # -------------------------------------------------------------
    # Step 17: Confirm ML detects anomaly
    # -------------------------------------------------------------
    ml_res = ml_engine.analyze_telemetry(burst_features)
    assert ml_res["is_anomaly"] is True
    assert ml_res["anomaly_score"] >= 0.65
    assert ml_res["risk_level"] in ["HIGH", "CRITICAL"]

    # -------------------------------------------------------------
    # Step 18: Create incident
    # -------------------------------------------------------------
    incident = Incident(
        title="Cascading Multi-Node Telemetry Anomaly",
        severity="CRITICAL",
        status="OPEN",
        affected_components=["ENC-01", "DLP-01"],
        affected_paths=["PATH-PCI-TX-01"],
        violated_invariants=["INV-PCI-01"],
        risk_score=78.5,
        anomaly_score=ml_res["anomaly_score"] * 100.0,
        root_cause="Multi-component failure burst flagged by Isolation Forest.",
        remediation_summary="Maintain alternate reroutes; inspect primary hardware."
    )
    db_session.add(incident)
    db_session.commit()
    assert incident.id.startswith("INC-")

    # -------------------------------------------------------------
    # Step 19: Generate explanation
    # -------------------------------------------------------------
    explanation = ExplainEngine.explain_incident(
        db_session,
        failed_components=["ENC-01"],
        affected_paths=["PATH-PCI-TX-01"],
        risk_score=78.5,
        anomaly_score=ml_res["anomaly_score"]
    )
    assert len(explanation["root_cause"]) > 10
    assert len(explanation["recommended_remediation"]) >= 3

    # -------------------------------------------------------------
    # Step 20: Verify audit chain
    # -------------------------------------------------------------
    AuditEngine.record_event(
        db_session,
        actor="ANALYST",
        action="VERIFY_INCIDENT",
        target=incident.id,
        details={"risk_score": 78.5}
    )
    audit_res = AuditEngine.verify_integrity(db_session)
    assert audit_res["valid"] is True
    assert audit_res["status"] == "VERIFIED"

    # -------------------------------------------------------------
    # Step 21: Recover failed component
    # -------------------------------------------------------------
    rec_res = FailureEngine.recover_component(db_session, "ENC-01")
    assert rec_res["action"] == "COMPONENT_RECOVERED"
    assert enc.status == "HEALTHY"

    # -------------------------------------------------------------
    # Step 22: Re-evaluate paths
    # -------------------------------------------------------------
    graph_engine = GraphEngine(db_session)
    final_summary = InvariantEngine.verify_all_paths(db_session, graph_engine)

    # -------------------------------------------------------------
    # Step 23: Confirm system returns to healthy state
    # -------------------------------------------------------------
    assert final_summary["guaranteed"] == 10
    assert final_summary["violated"] == 0
    assert final_summary["blocked"] == 0
    assert final_summary["safe_path_preservation_pct"] == 100.0
