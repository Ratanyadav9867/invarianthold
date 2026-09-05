import datetime
import json
import hashlib
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.models.audit import AuditLog

GENESIS_HASH = "0" * 64

class AuditEngine:
    """
    Tamper-Evident SHA-256 Hash-Chained Audit Ledger Engine.
    Employs SHA-256 cryptographic hash-chaining to ensure a tamper-evident,
    verifiable audit trail of all security decisions and administrative actions.
    """

    @classmethod
    def record_event(
        cls,
        db: Session,
        actor: str,
        action: str,
        target: str,
        details: Optional[Dict[str, Any]] = None
    ) -> AuditLog:
        """
        Append a new cryptographic audit record linked to the previous record's hash.
        """
        if details is None:
            details = {}
        last_log = db.query(AuditLog).order_by(AuditLog.id.desc()).first()
        prev_hash = last_log.current_hash if last_log else GENESIS_HASH

        now = datetime.datetime.now(datetime.timezone.utc)
        now_str = now.strftime("%Y-%m-%dT%H:%M:%SZ")

        current_hash = AuditLog.compute_hash(
            previous_hash=prev_hash,
            timestamp_str=now_str,
            actor=actor,
            action=action,
            target=target,
            details=details
        )

        log_entry = AuditLog(
            timestamp=now,
            actor=actor,
            action=action,
            target=target,
            details=details,
            previous_hash=prev_hash,
            current_hash=current_hash
        )

        db.add(log_entry)
        db.commit()
        db.refresh(log_entry)
        return log_entry

    @classmethod
    def verify_integrity(cls, db: Session) -> Dict[str, Any]:
        """
        Audit the entire tamper-evident SHA-256 hash-chained ledger from genesis to head.
        Detects any tampering, deletion, or modification of historical records.
        """
        logs = db.query(AuditLog).order_by(AuditLog.id.asc()).all()
        total_records = len(logs)

        if total_records == 0:
            return {
                "valid": True,
                "total_records": 0,
                "status": "EMPTY_LEDGER",
                "message": "Audit ledger is empty; integrity verified."
            }

        expected_prev_hash = GENESIS_HASH

        for i, log in enumerate(logs):
            # 1. Verify link to previous record
            if log.previous_hash != expected_prev_hash:
                return {
                    "valid": False,
                    "status": "COMPROMISED",
                    "total_records": total_records,
                    "tampered_record_id": log.id,
                    "error_type": "CHAIN_LINK_BROKEN",
                    "expected_previous_hash": expected_prev_hash,
                    "actual_previous_hash": log.previous_hash,
                    "message": f"Tampering detected at record #{log.id}: previous hash mismatch."
                }

            # 2. Re-compute and verify cryptographic hash of record contents
            timestamp_str = log.timestamp.strftime("%Y-%m-%dT%H:%M:%SZ") if log.timestamp else ""
            recomputed = AuditLog.compute_hash(
                previous_hash=log.previous_hash,
                timestamp_str=timestamp_str,
                actor=log.actor,
                action=log.action,
                target=log.target,
                details=log.details or {}
            )

            if recomputed != log.current_hash:
                return {
                    "valid": False,
                    "status": "COMPROMISED",
                    "total_records": total_records,
                    "tampered_record_id": log.id,
                    "error_type": "PAYLOAD_ALTERED",
                    "expected_hash": recomputed,
                    "stored_hash": log.current_hash,
                    "message": f"Tampering detected at record #{log.id}: content hash mismatch."
                }

            expected_prev_hash = log.current_hash

        return {
            "valid": True,
            "total_records": total_records,
            "status": "VERIFIED",
            "chain_head_hash": logs[-1].current_hash,
            "message": f"Ledger integrity 100% verified across {total_records} cryptographic blocks."
        }
