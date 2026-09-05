from sqlalchemy import JSON, Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class Component(Base):
    __tablename__ = "components"

    id = Column(String(64), primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    type = Column(String(32), nullable=False, index=True)  # FIREWALL, ENCRYPTION_GATEWAY, DLP, IDS, WAF, PAM, AUTH_GW
    status = Column(String(32), nullable=False, default="HEALTHY", index=True)  # HEALTHY, FAILED, DEGRADED, RECOVERING
    zone = Column(String(64), nullable=False, index=True)  # INTERNET, DMZ, APPLICATION, DATABASE, PCI
    capabilities = Column(JSON, nullable=False, default=list)
    health_score = Column(Float, nullable=False, default=1.0)
    latency_ms = Column(Float, nullable=False, default=1.5)
    failure_count = Column(Integer, nullable=False, default=0)
    last_failure_at = Column(DateTime, nullable=True)
    meta_info = Column(JSON, nullable=True, default=dict)

    # Relationship to topology node
    node = relationship("TopologyNode", back_populates="component", uselist=False)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type,
            "status": self.status,
            "zone": self.zone,
            "capabilities": self.capabilities or [],
            "health_score": round(self.health_score, 2),
            "latency_ms": round(self.latency_ms, 2),
            "failure_count": self.failure_count,
            "last_failure_at": self.last_failure_at.isoformat() if self.last_failure_at else None,
            "meta_info": self.meta_info or {}
        }

class TopologyNode(Base):
    __tablename__ = "topology_nodes"

    id = Column(String(64), primary_key=True, index=True)
    label = Column(String(128), nullable=False)
    node_type = Column(String(32), nullable=False)  # CLIENT, SECURITY_GATEWAY, SERVER, DATABASE
    zone = Column(String(64), nullable=False, index=True)
    component_id = Column(String(64), ForeignKey("components.id"), nullable=True)
    pos_x = Column(Float, nullable=True)
    pos_y = Column(Float, nullable=True)

    component = relationship("Component", back_populates="node")

    def to_dict(self):
        return {
            "id": self.id,
            "label": self.label,
            "node_type": self.node_type,
            "zone": self.zone,
            "component_id": self.component_id,
            "pos_x": self.pos_x,
            "pos_y": self.pos_y
        }

class TopologyEdge(Base):
    __tablename__ = "topology_edges"

    id = Column(String(128), primary_key=True, index=True)
    source_node = Column(String(64), nullable=False, index=True)
    target_node = Column(String(64), nullable=False, index=True)
    latency_ms = Column(Float, nullable=False, default=1.0)
    bandwidth_mbps = Column(Float, nullable=False, default=1000.0)
    status = Column(String(32), nullable=False, default="UP")  # UP, DOWN
    packet_loss_pct = Column(Float, nullable=False, default=0.0)

    def to_dict(self):
        return {
            "id": self.id,
            "source_node": self.source_node,
            "target_node": self.target_node,
            "latency_ms": self.latency_ms,
            "bandwidth_mbps": self.bandwidth_mbps,
            "status": self.status,
            "packet_loss_pct": self.packet_loss_pct
        }
