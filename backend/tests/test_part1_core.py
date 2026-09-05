import pytest
from sqlalchemy.orm import Session
from app.models.component import Component
from app.models.invariant import TrafficPath, SecurityInvariant
from app.services.graph_engine import GraphEngine
from app.services.invariant_engine import InvariantEngine
from app.services.failure_engine import FailureEngine
from app.services.rerouting_engine import ReroutingEngine

def test_1_healthy_invariant_guaranteed(db_session: Session):
    """
    Test 1: When all components are HEALTHY, all default invariants
    and all 10 paths evaluate to GUARANTEED.
    """
    graph_engine = GraphEngine(db_session)
    summary = InvariantEngine.verify_all_paths(db_session, graph_engine)

    assert summary["total_paths"] == 10
    assert summary["guaranteed"] == 10
    assert summary["violated"] == 0
    assert summary["blocked"] == 0
    assert summary["safe_path_preservation_pct"] == 100.0

    all_paths = db_session.query(TrafficPath).all()
    for path in all_paths:
        assert path.status == "GUARANTEED"
        assert "guaranteed" in path.decision_reason.lower()


def test_2_encryption_failure_targets_only_pci(db_session: Session):
    """
    Test 2: Failing primary encryption gateway (ENC-01) affects
    ONLY dependent PCI paths.
    """
    result = FailureEngine.inject_failure(db_session, ["ENC-01"])

    assert result["action"] == "FAILURE_INJECTED"
    assert result["failed_components"] == ["ENC-01"]
    assert result["affected_paths_count"] == 3
    assert result["safe_paths_count"] == 7

    affected_ids = {p["id"] for p in result["affected_paths"]}
    expected_affected = {"PATH-PCI-TX-01", "PATH-PCI-TX-02", "PATH-PCI-RECURRING"}
    assert affected_ids == expected_affected

    # Confirm all affected paths are isolated by Targeted Fail-Safe
    for path_dict in result["affected_paths"]:
        assert path_dict["status"] == "BLOCKED"


def test_3_unrelated_paths_preserved(db_session: Session):
    """
    Test 3: Unrelated web and database paths remain operational
    when ENC-01 fails. Dynamic preservation percentage is calculated accurately.
    """
    result = FailureEngine.inject_failure(db_session, ["ENC-01"])

    safe_ids = {p["id"] for p in result["safe_paths"]}
    expected_safe = {
        "PATH-WEB-CATALOG",
        "PATH-WEB-AUTH",
        "PATH-DB-CUSTOMER",
        "PATH-DB-ORDERS",
        "PATH-ADMIN-PCI",
        "PATH-ADMIN-DB",
        "PATH-ADMIN-APP"
    }
    assert safe_ids == expected_safe

    # Dynamic percentage: 7 / 10 * 100 = 70.0%
    expected_pct = round((7 / 10) * 100, 1)
    assert result["safe_path_preservation_pct"] == expected_pct

    # Verify directly in DB that non-PCI paths are GUARANTEED
    web_catalog = db_session.query(TrafficPath).filter(TrafficPath.id == "PATH-WEB-CATALOG").first()
    db_orders = db_session.query(TrafficPath).filter(TrafficPath.id == "PATH-DB-ORDERS").first()
    admin_app = db_session.query(TrafficPath).filter(TrafficPath.id == "PATH-ADMIN-APP").first()

    assert web_catalog.status == "GUARANTEED"
    assert db_orders.status == "GUARANTEED"
    assert admin_app.status == "GUARANTEED"


def test_4_failed_control_verdict_violated(db_session: Session):
    """
    Test 4: Failed control causes affected path to evaluate to VIOLATED
    at the invariant engine level, triggering targeted isolation.
    """
    # 1. Manually set ENC-01 to FAILED
    enc = db_session.query(Component).filter(Component.id == "ENC-01").first()
    enc.status = "FAILED"
    db_session.commit()

    graph_engine = GraphEngine(db_session)
    pci_path = db_session.query(TrafficPath).filter(TrafficPath.id == "PATH-PCI-TX-01").first()

    # 2. Invariant verification must return VIOLATED
    eval_res = InvariantEngine.verify_path(db_session, pci_path, graph_engine)
    assert eval_res["verdict"] == "VIOLATED"
    assert "ENC-01" in eval_res["failed_components"]
    assert "ENCRYPTION_GATEWAY" in eval_res["required_controls"]
    assert "PCI Boundary Protection" in eval_res["reason"]


def test_5_safe_alternate_discovery(db_session: Session):
    """
    Test 5: Safe alternate path through redundant ENC-02 is discovered
    by the GraphEngine.
    """
    graph_engine = GraphEngine(db_session)
    pci_path = db_session.query(TrafficPath).filter(TrafficPath.id == "PATH-PCI-TX-01").first()

    candidates = graph_engine.find_candidate_alternate_paths(db_session, pci_path)
    assert len(candidates) > 0

    # Ensure at least one candidate contains ENC-02 and does NOT contain ENC-01
    has_enc02_path = any("ENC-02" in hops and "ENC-01" not in hops for hops in candidates)
    assert has_enc02_path is True


def test_6_reroute_requires_invariant_guaranteed(db_session: Session):
    """
    Test 6: Safe rerouting is accepted ONLY when the candidate alternate path
    is mathematically GUARANTEED by the Invariant Engine, and REJECTED if degraded.
    """
    # 1. Fail primary ENC-01
    FailureEngine.inject_failure(db_session, ["ENC-01"])

    # 2. Reroute when ENC-02 is healthy -> Must SUCCEED
    reroute_res = ReroutingEngine.attempt_reroute_path(db_session, "PATH-PCI-TX-01")
    assert reroute_res["rerouted"] is True
    assert reroute_res["status"] == "REROUTED"
    assert "ENC-02" in reroute_res["new_hops"]
    assert reroute_res["invariant_guaranteed"] is True

    # 3. Now simulate failure of DLP-01 (a required control for PCI invariant)
    FailureEngine.inject_failure(db_session, ["DLP-01"])

    # 4. Attempt reroute for another blocked path PATH-PCI-TX-02
    # Even though ENC-02 is healthy, DLP-01 is broken, so the alternate path MUST BE REJECTED
    rejected_reroute = ReroutingEngine.attempt_reroute_path(db_session, "PATH-PCI-TX-02")
    assert rejected_reroute["rerouted"] is False
    assert rejected_reroute["status"] == "BLOCKED"
    assert "rejections" in rejected_reroute
    assert len(rejected_reroute["rejections"]) > 0

    # Verify path remains BLOCKED in database
    pci_tx_02 = db_session.query(TrafficPath).filter(TrafficPath.id == "PATH-PCI-TX-02").first()
    assert pci_tx_02.status == "BLOCKED"


def test_7_no_safe_route_blocks_without_spillover(db_session: Session):
    """
    Test 7: When no compliant path exists (both ENC-01 and ENC-02 down),
    only affected traffic is BLOCKED. Safe traffic remains operational without spillover.
    """
    FailureEngine.inject_failure(db_session, ["ENC-01", "ENC-02"])

    # Try to reroute PCI path
    reroute_res = ReroutingEngine.attempt_reroute_path(db_session, "PATH-PCI-TX-01")
    assert reroute_res["rerouted"] is False
    assert reroute_res["status"] == "BLOCKED"

    # Verify no spillover to unrelated services: Web and Database are intact
    web_auth = db_session.query(TrafficPath).filter(TrafficPath.id == "PATH-WEB-AUTH").first()
    db_cust = db_session.query(TrafficPath).filter(TrafficPath.id == "PATH-DB-CUSTOMER").first()

    assert web_auth.status == "GUARANTEED"
    assert db_cust.status == "GUARANTEED"


def test_8_recovery_restores_only_after_verification(db_session: Session):
    """
    Test 8: Component recovery restores traffic ONLY after deterministic
    invariant verification confirms all required controls are healthy.
    """
    # 1. Fail ENC-01
    FailureEngine.inject_failure(db_session, ["ENC-01"])
    pci_path = db_session.query(TrafficPath).filter(TrafficPath.id == "PATH-PCI-TX-01").first()
    assert pci_path.status == "BLOCKED"

    # 2. Recover ENC-01
    rec_res = FailureEngine.recover_component(db_session, "ENC-01")
    assert rec_res["action"] == "COMPONENT_RECOVERED"
    assert "PATH-PCI-TX-01" in rec_res["recovered_paths"]

    # 3. Path in DB must now be verified GUARANTEED
    db_session.refresh(pci_path)
    assert pci_path.status == "GUARANTEED"
    assert "guaranteed" in pci_path.decision_reason.lower()
