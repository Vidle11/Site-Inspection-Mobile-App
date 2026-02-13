import json
from datetime import datetime, timezone
from uuid import UUID

from sqlmodel import Session, select

from app.models.entities import AuditLog, Role
from app.services.hash_service import chained_audit_hash


class AuditService:
    @staticmethod
    def append_log(
        session: Session,
        tenant_id: str,
        actor_user_id: UUID,
        actor_role: Role,
        entity_type: str,
        entity_id: UUID,
        action: str,
        payload: dict,
    ) -> AuditLog:
        latest = session.exec(
            select(AuditLog)
            .where(AuditLog.tenant_id == tenant_id)
            .order_by(AuditLog.created_at.desc())
        ).first()
        prev_hash = latest.entry_hash if latest else "GENESIS"
        entry_hash = chained_audit_hash(prev_hash, payload)

        now = datetime.now(timezone.utc)
        log = AuditLog(
            tenant_id=tenant_id,
            actor_user_id=actor_user_id,
            actor_role=actor_role,
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            payload_json=json.dumps(payload, separators=(",", ":"), sort_keys=True),
            prev_hash=prev_hash,
            entry_hash=entry_hash,
            created_at=now,
            updated_at=now,
        )
        session.add(log)
        session.commit()
        session.refresh(log)
        return log
