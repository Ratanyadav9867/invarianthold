import datetime
import hashlib
import json

from sqlalchemy import JSON, Column, DateTime, Integer, String

from app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, nullable=False, default=lambda: datetime.datetime.now(datetime.UTC))
    actor = Column(String(64), nullable=False)
    action = Column(String(64), nullable=False, index=True)
    target = Column(String(128), nullable=False)
    details = Column(JSON, nullable=False, default=dict)
    previous_hash = Column(String(64), nullable=False)
    current_hash = Column(String(64), nullable=False)

    @staticmethod
    def compute_hash(previous_hash: str, timestamp_str: str, actor: str, action: str, target: str, details: dict) -> str:
        canonical_details = json.dumps(details, sort_keys=True)
        payload = f"{previous_hash}|{timestamp_str}|{actor}|{action}|{target}|{canonical_details}"
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    def to_dict(self):
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "actor": self.actor,
            "action": self.action,
            "target": self.target,
            "details": self.details or {},
            "previous_hash": self.previous_hash,
            "current_hash": self.current_hash
        }
