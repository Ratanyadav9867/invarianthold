import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Text, JSON, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class SecurityInvariant(Base):
    __tablename__ = "security_invariants"

    id = Column(String(64), primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    description = Column(Text, nullable=False)
    severity = Column(String(32), nullable=False, default="HIGH")  # LOW, MEDIUM, HIGH, CRITICAL
    source_zones = Column(JSON, nullable=False, default=list)
    destination_zones = Column(JSON, nullable=False, default=list)
    required_controls = Column(JSON, nullable=False, default=list)
    forbidden_conditions = Column(JSON, nullable=False, default=list)
    enabled = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    paths = relationship("TrafficPath", back_populates="invariant")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "severity": self.severity,
            "source_zones": self.source_zones or [],
            "destination_zones": self.destination_zones or [],
            "required_controls": self.required_controls or [],
            "forbidden_conditions": self.forbidden_conditions or [],
            "enabled": self.enabled,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class TrafficPath(Base):
    __tablename__ = "traffic_paths"

    id = Column(String(64), primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    source_node = Column(String(64), nullable=False, index=True)
    destination_node = Column(String(64), nullable=False, index=True)
    current_hops = Column(JSON, nullable=False, default=list)
    alternate_hops = Column(JSON, nullable=True, default=list)
    applicable_invariant_id = Column(String(64), ForeignKey("security_invariants.id"), nullable=True)
    status = Column(String(32), nullable=False, default="GUARANTEED", index=True)  # GUARANTEED, AT_RISK, VIOLATED, BLOCKED, REROUTED
    is_active = Column(Boolean, nullable=False, default=True)
    decision_reason = Column(Text, nullable=True)
    last_verified_at = Column(DateTime, nullable=True)

    invariant = relationship("SecurityInvariant", back_populates="paths")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "source_node": self.source_node,
            "destination_node": self.destination_node,
            "current_hops": self.current_hops or [],
            "alternate_hops": self.alternate_hops or [],
            "applicable_invariant_id": self.applicable_invariant_id,
            "status": self.status,
            "is_active": self.is_active,
            "decision_reason": self.decision_reason,
            "last_verified_at": self.last_verified_at.isoformat() if self.last_verified_at else None
        }
