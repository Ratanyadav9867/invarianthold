import datetime
import uuid

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)

from app.database import Base


class TrafficPacket(Base):
    __tablename__ = "traffic_packets"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    path_id = Column(String(64), ForeignKey("traffic_paths.id"), nullable=False, index=True)
    source = Column(String(64), nullable=False)
    destination = Column(String(64), nullable=False)
    protocol = Column(String(16), nullable=False)  # TCP, UDP, HTTPS, HTTP, SSH, DNS
    size_bytes = Column(Integer, nullable=False, default=512)
    status = Column(String(32), nullable=False, index=True)  # DELIVERED, BLOCKED, REROUTED, DROPPED
    is_safe = Column(Boolean, nullable=False, default=True)
    boundary_crossed = Column(String(64), nullable=True)  # e.g., PCI, DATABASE, DMZ
    latency_ms = Column(Float, nullable=False, default=2.0)
    timestamp = Column(DateTime, nullable=False, default=lambda: datetime.datetime.now(datetime.UTC))

    def to_dict(self):
        return {
            "id": self.id,
            "path_id": self.path_id,
            "source": self.source,
            "destination": self.destination,
            "protocol": self.protocol,
            "size_bytes": self.size_bytes,
            "status": self.status,
            "is_safe": self.is_safe,
            "boundary_crossed": self.boundary_crossed,
            "latency_ms": round(self.latency_ms, 2),
            "timestamp": self.timestamp.isoformat() if self.timestamp else None
        }

class Incident(Base):
    __tablename__ = "incidents"

    id = Column(String(64), primary_key=True, default=lambda: f"INC-{uuid.uuid4().hex[:8].upper()}")
    title = Column(String(256), nullable=False)
    severity = Column(String(32), nullable=False, default="HIGH")
    status = Column(String(32), nullable=False, default="OPEN")  # OPEN, MITIGATED, RESOLVED
    affected_components = Column(JSON, nullable=False, default=list)
    affected_paths = Column(JSON, nullable=False, default=list)
    violated_invariants = Column(JSON, nullable=False, default=list)
    risk_score = Column(Float, nullable=False, default=0.0)
    anomaly_score = Column(Float, nullable=False, default=0.0)
    root_cause = Column(Text, nullable=True)
    remediation_summary = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.datetime.now(datetime.UTC))

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "severity": self.severity,
            "status": self.status,
            "affected_components": self.affected_components or [],
            "affected_paths": self.affected_paths or [],
            "violated_invariants": self.violated_invariants or [],
            "risk_score": round(self.risk_score, 1),
            "anomaly_score": round(self.anomaly_score, 2),
            "root_cause": self.root_cause,
            "remediation_summary": self.remediation_summary,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class AnomalyRecord(Base):
    __tablename__ = "anomalies"

    id = Column(String(64), primary_key=True, default=lambda: f"ANOM-{uuid.uuid4().hex[:8].upper()}")
    anomaly_score = Column(Float, nullable=False)
    is_anomaly = Column(Boolean, nullable=False)
    risk_level = Column(String(32), nullable=False)
    features = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.datetime.now(datetime.UTC))

    def to_dict(self):
        return {
            "id": self.id,
            "anomaly_score": round(self.anomaly_score, 2),
            "is_anomaly": self.is_anomaly,
            "risk_level": self.risk_level,
            "features": self.features or {},
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
