import datetime
from sqlalchemy.orm import Session
from app.database import Base, engine
from app.models.component import Component, TopologyNode, TopologyEdge
from app.models.invariant import SecurityInvariant, TrafficPath
from app.models.traffic import TrafficPacket, Incident, AnomalyRecord
from app.models.audit import AuditLog
from app.models.auth import User
from app.core.security import get_password_hash
from app.config import settings

def seed_database(db: Session, reset: bool = False):
    """Seed the database with the default Fintech topology, invariants, and initial users."""
    if reset:
        db.query(TrafficPacket).delete()
        db.query(Incident).delete()
        db.query(AnomalyRecord).delete()
        db.query(AuditLog).delete()
        db.query(TrafficPath).delete()
        db.query(SecurityInvariant).delete()
        db.query(TopologyEdge).delete()
        db.query(TopologyNode).delete()
        db.query(Component).delete()
        db.query(User).delete()
        db.commit()

    # Check if already seeded
    if db.query(Component).count() > 0:
        return

    # 1. Seed Users
    users_data = [
        User(
            id="usr-admin-01",
            username="admin",
            email=settings.ADMIN_USER,
            password_hash=get_password_hash(settings.ADMIN_PASSWORD),
            role="ADMIN"
        ),
        User(
            id="usr-analyst-01",
            username="analyst",
            email=settings.ANALYST_USER,
            password_hash=get_password_hash(settings.ANALYST_PASSWORD),
            role="SECURITY_ANALYST"
        ),
        User(
            id="usr-viewer-01",
            username="viewer",
            email=settings.VIEWER_USER,
            password_hash=get_password_hash(settings.VIEWER_PASSWORD),
            role="VIEWER"
        )
    ]
    db.add_all(users_data)

    # 2. Seed Enforcement Components (8 components)
    components_data = [
        Component(
            id="FW-01",
            name="Stateful Edge Firewall",
            type="FIREWALL",
            status="HEALTHY",
            zone="DMZ",
            capabilities=["STATEFUL_FILTERING", "ZONE_ISOLATION", "TCP_SYN_FLOOD_DEFENSE"],
            health_score=1.0,
            latency_ms=1.2,
            meta_info={"vendor": "PaloAlto-Sim", "ruleset_version": "v12.4.1"}
        ),
        Component(
            id="WAF-01",
            name="Cloud Application WAF",
            type="WAF",
            status="HEALTHY",
            zone="DMZ",
            capabilities=["SQLI_DETECTION", "XSS_FILTERING", "OWASP_TOP_10"],
            health_score=1.0,
            latency_ms=2.5,
            meta_info={"vendor": "Cloudflare-Sim", "tls_termination": True}
        ),
        Component(
            id="AUTH-01",
            name="Identity & Access Gateway",
            type="AUTH_GW",
            status="HEALTHY",
            zone="DMZ",
            capabilities=["JWT_VERIFICATION", "OAUTH2_TOKEN_VALIDATION"],
            health_score=1.0,
            latency_ms=1.8,
            meta_info={"protocol": "OpenID-Connect"}
        ),
        Component(
            id="ENC-01",
            name="PCI HSM Encryption Gateway (Primary)",
            type="ENCRYPTION_GATEWAY",
            status="HEALTHY",
            zone="PCI",
            capabilities=["AES_256_GCM", "PCI_DATA_ENCRYPTION", "KEY_ROTATION"],
            health_score=1.0,
            latency_ms=3.1,
            meta_info={"role": "PRIMARY", "hsm_id": "HSM-PCI-01"}
        ),
        Component(
            id="ENC-02",
            name="PCI HSM Encryption Gateway (Secondary / Failover)",
            type="ENCRYPTION_GATEWAY",
            status="HEALTHY",
            zone="PCI",
            capabilities=["AES_256_GCM", "PCI_DATA_ENCRYPTION", "KEY_ROTATION"],
            health_score=1.0,
            latency_ms=3.4,
            meta_info={"role": "SECONDARY", "hsm_id": "HSM-PCI-02"}
        ),
        Component(
            id="DLP-01",
            name="Credit Card Data Loss Prevention",
            type="DLP",
            status="HEALTHY",
            zone="PCI",
            capabilities=["PAN_TOKENIZATION_CHECK", "CVV_SANITY_CHECK", "DATA_MASKING"],
            health_score=1.0,
            latency_ms=2.0,
            meta_info={"standards": ["PCI_DSS_V4"]}
        ),
        Component(
            id="IDS-01",
            name="Network Intrusion Detection System",
            type="IDS",
            status="HEALTHY",
            zone="APPLICATION",
            capabilities=["ANOMALOUS_QUERY_DETECTION", "SIGNATURE_MATCHING", "ZERO_DAY_PATTERNS"],
            health_score=1.0,
            latency_ms=1.4,
            meta_info={"engine": "Suricata-Sim"}
        ),
        Component(
            id="PAM-01",
            name="Privileged Access Management Proxy",
            type="PAM",
            status="HEALTHY",
            zone="DMZ",
            capabilities=["SSH_BASTION", "SESSION_RECORDING", "PRIVILEGE_ELEVATION"],
            health_score=1.0,
            latency_ms=2.2,
            meta_info={"session_logging": True}
        )
    ]
    db.add_all(components_data)
    db.flush()

    # 3. Seed Topology Nodes (Coordinates for visual layout in React Flow)
    nodes_data = [
        # Clients & Internet
        TopologyNode(id="Client-Internet", label="Public Internet Client", node_type="CLIENT", zone="INTERNET", pos_x=50, pos_y=150),
        TopologyNode(id="Admin-Workstation", label="SecOps Admin Workstation", node_type="CLIENT", zone="INTERNET", pos_x=50, pos_y=450),
        
        # DMZ Nodes
        TopologyNode(id="WAF-01", label="WAF (WAF-01)", node_type="SECURITY_GATEWAY", zone="DMZ", component_id="WAF-01", pos_x=260, pos_y=100),
        TopologyNode(id="AUTH-01", label="Auth Gateway (AUTH-01)", node_type="SECURITY_GATEWAY", zone="DMZ", component_id="AUTH-01", pos_x=260, pos_y=240),
        TopologyNode(id="PAM-01", label="Privileged Access Proxy (PAM-01)", node_type="SECURITY_GATEWAY", zone="DMZ", component_id="PAM-01", pos_x=260, pos_y=450),
        TopologyNode(id="FW-01", label="Core Firewall (FW-01)", node_type="SECURITY_GATEWAY", zone="DMZ", component_id="FW-01", pos_x=470, pos_y=270),
        
        # Application Tier
        TopologyNode(id="App-Server", label="Fintech App Services", node_type="SERVER", zone="APPLICATION", pos_x=680, pos_y=270),
        TopologyNode(id="IDS-01", label="Intrusion Detection (IDS-01)", node_type="SECURITY_GATEWAY", zone="APPLICATION", component_id="IDS-01", pos_x=890, pos_y=420),
        
        # Database Tier
        TopologyNode(id="DB-Primary", label="PostgreSQL Primary Database", node_type="DATABASE", zone="DATABASE", pos_x=1100, pos_y=420),
        
        # PCI Secure Enclave
        TopologyNode(id="ENC-01", label="Encryption Primary (ENC-01)", node_type="SECURITY_GATEWAY", zone="PCI", component_id="ENC-01", pos_x=890, pos_y=160),
        TopologyNode(id="ENC-02", label="Encryption Backup (ENC-02)", node_type="SECURITY_GATEWAY", zone="PCI", component_id="ENC-02", pos_x=890, pos_y=260),
        TopologyNode(id="DLP-01", label="PCI DLP Gateway (DLP-01)", node_type="SECURITY_GATEWAY", zone="PCI", component_id="DLP-01", pos_x=1080, pos_y=210),
        TopologyNode(id="PCI-Vault", label="Cardholder Data Vault (PCI)", node_type="SERVER", zone="PCI", pos_x=1270, pos_y=210)
    ]
    db.add_all(nodes_data)
    db.flush()

    # 4. Seed Topology Edges
    edges_data = [
        # Ingress
        TopologyEdge(id="e-client-waf", source_node="Client-Internet", target_node="WAF-01", latency_ms=5.0),
        TopologyEdge(id="e-waf-fw", source_node="WAF-01", target_node="FW-01", latency_ms=1.5),
        TopologyEdge(id="e-waf-auth", source_node="WAF-01", target_node="AUTH-01", latency_ms=1.2),
        TopologyEdge(id="e-auth-fw", source_node="AUTH-01", target_node="FW-01", latency_ms=1.2),
        
        # Admin ingress
        TopologyEdge(id="e-admin-pam", source_node="Admin-Workstation", target_node="PAM-01", latency_ms=4.0),
        TopologyEdge(id="e-pam-fw", source_node="PAM-01", target_node="FW-01", latency_ms=1.5),

        # Core Firewall to Application & Services
        TopologyEdge(id="e-fw-app", source_node="FW-01", target_node="App-Server", latency_ms=1.0),
        
        # Application to Database
        TopologyEdge(id="e-app-ids", source_node="App-Server", target_node="IDS-01", latency_ms=1.0),
        TopologyEdge(id="e-ids-db", source_node="IDS-01", target_node="DB-Primary", latency_ms=1.5),

        # Application to PCI Enclave (Both primary and backup encryption paths)
        TopologyEdge(id="e-app-enc1", source_node="App-Server", target_node="ENC-01", latency_ms=2.0),
        TopologyEdge(id="e-app-enc2", source_node="App-Server", target_node="ENC-02", latency_ms=2.2),
        TopologyEdge(id="e-enc1-dlp", source_node="ENC-01", target_node="DLP-01", latency_ms=1.0),
        TopologyEdge(id="e-enc2-dlp", source_node="ENC-02", target_node="DLP-01", latency_ms=1.0),
        TopologyEdge(id="e-dlp-pcivault", source_node="DLP-01", target_node="PCI-Vault", latency_ms=1.2),

        # Admin direct management links (must pass FW)
        TopologyEdge(id="e-fw-db", source_node="FW-01", target_node="DB-Primary", latency_ms=2.0),
        TopologyEdge(id="e-fw-pcivault", source_node="FW-01", target_node="PCI-Vault", latency_ms=2.5)
    ]
    db.add_all(edges_data)
    db.flush()

    # 5. Seed Security Invariants (4 default invariants)
    invariants_data = [
        SecurityInvariant(
            id="INV-PCI-01",
            name="PCI Boundary Protection",
            description="No unencrypted traffic may cross PCI boundary; requires Encryption Gateway, Firewall, and DLP.",
            severity="CRITICAL",
            source_zones=["INTERNET", "DMZ", "APPLICATION"],
            destination_zones=["PCI"],
            required_controls=["FIREWALL", "ENCRYPTION_GATEWAY", "DLP"],
            forbidden_conditions=["UNENCRYPTED_CROSSING", "BYPASS_DLP"],
            enabled=True
        ),
        SecurityInvariant(
            id="INV-ADMIN-02",
            name="Admin Privilege Enforcement",
            description="Privileged administrative traffic to critical servers must transit PAM and Firewall.",
            severity="HIGH",
            source_zones=["INTERNET"],
            destination_zones=["PCI", "DATABASE", "APPLICATION"],
            required_controls=["PAM", "FIREWALL"],
            forbidden_conditions=["DIRECT_ROOT_ACCESS", "BYPASS_PAM"],
            enabled=True
        ),
        SecurityInvariant(
            id="INV-WEB-03",
            name="Public Web Ingress Protection",
            description="Internet traffic entering internal services must pass through WAF and Firewall.",
            severity="MEDIUM",
            source_zones=["INTERNET"],
            destination_zones=["APPLICATION"],
            required_controls=["WAF", "FIREWALL"],
            forbidden_conditions=["BYPASS_WAF", "DIRECT_APP_EXPOSURE"],
            enabled=True
        ),
        SecurityInvariant(
            id="INV-DB-04",
            name="Database Security Invariant",
            description="Application database queries must pass through Firewall or IDS.",
            severity="HIGH",
            source_zones=["APPLICATION", "DMZ"],
            destination_zones=["DATABASE"],
            required_controls=["FIREWALL", "IDS"],
            forbidden_conditions=["UNINSPECTED_DB_ACCESS"],
            enabled=True
        )
    ]
    db.add_all(invariants_data)
    db.flush()

    # 6. Seed 10 Primary Traffic Paths
    # Note: For INV-DB-04, we route App-Server -> FW-01 -> IDS-01 -> DB-Primary, or for web ingress Client -> WAF -> FW -> App -> IDS -> DB
    # Let's ensure edge FW-01 -> IDS-01 exists so App -> FW -> IDS is supported if needed, or Client-Internet -> WAF-01 -> FW-01 -> App-Server -> IDS-01 -> DB-Primary
    # Let's add edge FW-01 -> IDS-01:
    db.add(TopologyEdge(id="e-fw-ids", source_node="FW-01", target_node="IDS-01", latency_ms=1.2))
    db.flush()

    paths_data = [
        # 1. PCI Primary Purchase Stream
        TrafficPath(
            id="PATH-PCI-TX-01",
            name="Online Card Checkout Flow",
            source_node="Client-Internet",
            destination_node="PCI-Vault",
            current_hops=["Client-Internet", "WAF-01", "FW-01", "App-Server", "ENC-01", "DLP-01", "PCI-Vault"],
            alternate_hops=["Client-Internet", "WAF-01", "FW-01", "App-Server", "ENC-02", "DLP-01", "PCI-Vault"],
            applicable_invariant_id="INV-PCI-01",
            status="GUARANTEED",
            is_active=True,
            decision_reason="All required controls [FIREWALL, ENCRYPTION_GATEWAY, DLP] operational along primary route."
        ),
        # 2. PCI Recurring Card Processing
        TrafficPath(
            id="PATH-PCI-TX-02",
            name="Recurring Subscription Payment Flow",
            source_node="Client-Internet",
            destination_node="PCI-Vault",
            current_hops=["Client-Internet", "WAF-01", "FW-01", "App-Server", "ENC-01", "DLP-01", "PCI-Vault"],
            alternate_hops=["Client-Internet", "WAF-01", "FW-01", "App-Server", "ENC-02", "DLP-01", "PCI-Vault"],
            applicable_invariant_id="INV-PCI-01",
            status="GUARANTEED",
            is_active=True,
            decision_reason="All required controls [FIREWALL, ENCRYPTION_GATEWAY, DLP] operational along primary route."
        ),
        # 3. PCI Mobile Payment Stream
        TrafficPath(
            id="PATH-PCI-RECURRING",
            name="Mobile Wallet Tokenization Flow",
            source_node="Client-Internet",
            destination_node="PCI-Vault",
            current_hops=["Client-Internet", "WAF-01", "FW-01", "App-Server", "ENC-01", "DLP-01", "PCI-Vault"],
            alternate_hops=["Client-Internet", "WAF-01", "FW-01", "App-Server", "ENC-02", "DLP-01", "PCI-Vault"],
            applicable_invariant_id="INV-PCI-01",
            status="GUARANTEED",
            is_active=True,
            decision_reason="All required controls [FIREWALL, ENCRYPTION_GATEWAY, DLP] operational along primary route."
        ),
        # 4. Web Product Catalog Flow
        TrafficPath(
            id="PATH-WEB-CATALOG",
            name="Product Catalog Browse Flow",
            source_node="Client-Internet",
            destination_node="App-Server",
            current_hops=["Client-Internet", "WAF-01", "FW-01", "App-Server"],
            alternate_hops=[],
            applicable_invariant_id="INV-WEB-03",
            status="GUARANTEED",
            is_active=True,
            decision_reason="All required controls [WAF, FIREWALL] operational along primary route."
        ),
        # 5. Web Customer Login Flow
        TrafficPath(
            id="PATH-WEB-AUTH",
            name="Customer Sign-In & Auth Flow",
            source_node="Client-Internet",
            destination_node="App-Server",
            current_hops=["Client-Internet", "WAF-01", "AUTH-01", "FW-01", "App-Server"],
            alternate_hops=[],
            applicable_invariant_id="INV-WEB-03",
            status="GUARANTEED",
            is_active=True,
            decision_reason="All required controls [WAF, FIREWALL] operational along primary route."
        ),
        # 6. Database Customer Profile Query
        TrafficPath(
            id="PATH-DB-CUSTOMER",
            name="Customer Profile Lookup Query",
            source_node="Client-Internet",
            destination_node="DB-Primary",
            current_hops=["Client-Internet", "WAF-01", "FW-01", "App-Server", "IDS-01", "DB-Primary"],
            alternate_hops=[],
            applicable_invariant_id="INV-DB-04",
            status="GUARANTEED",
            is_active=True,
            decision_reason="All required controls [FIREWALL, IDS] operational along primary route."
        ),
        # 7. Database Order History Query
        TrafficPath(
            id="PATH-DB-ORDERS",
            name="Order History Relational Query",
            source_node="Client-Internet",
            destination_node="DB-Primary",
            current_hops=["Client-Internet", "WAF-01", "FW-01", "App-Server", "IDS-01", "DB-Primary"],
            alternate_hops=[],
            applicable_invariant_id="INV-DB-04",
            status="GUARANTEED",
            is_active=True,
            decision_reason="All required controls [FIREWALL, IDS] operational along primary route."
        ),
        # 8. SecOps Admin PCI Vault Maintenance
        TrafficPath(
            id="PATH-ADMIN-PCI",
            name="SecOps PCI HSM Audit Session",
            source_node="Admin-Workstation",
            destination_node="PCI-Vault",
            current_hops=["Admin-Workstation", "PAM-01", "FW-01", "PCI-Vault"],
            alternate_hops=[],
            applicable_invariant_id="INV-ADMIN-02",
            status="GUARANTEED",
            is_active=True,
            decision_reason="All required controls [PAM, FIREWALL] operational along primary route."
        ),
        # 9. SecOps Database Maintenance
        TrafficPath(
            id="PATH-ADMIN-DB",
            name="DBA Backup & Schema Session",
            source_node="Admin-Workstation",
            destination_node="DB-Primary",
            current_hops=["Admin-Workstation", "PAM-01", "FW-01", "DB-Primary"],
            alternate_hops=[],
            applicable_invariant_id="INV-ADMIN-02",
            status="GUARANTEED",
            is_active=True,
            decision_reason="All required controls [PAM, FIREWALL] operational along primary route."
        ),
        # 10. DevOps App Deployment Session
        TrafficPath(
            id="PATH-ADMIN-APP",
            name="DevOps Cluster Deployment Session",
            source_node="Admin-Workstation",
            destination_node="App-Server",
            current_hops=["Admin-Workstation", "PAM-01", "FW-01", "App-Server"],
            alternate_hops=[],
            applicable_invariant_id="INV-ADMIN-02",
            status="GUARANTEED",
            is_active=True,
            decision_reason="All required controls [PAM, FIREWALL] operational along primary route."
        )
    ]
    db.add_all(paths_data)
    db.commit()

def init_db():
    Base.metadata.create_all(bind=engine)
