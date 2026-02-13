import json
from datetime import datetime, timezone
from uuid import uuid4

from sqlmodel import Session, SQLModel, create_engine, select

from app.models.entities import AuditLog, Role
from app.services.audit_service import AuditService


def test_append_log_creates_chain_and_canonical_payload():
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)

    actor_id = uuid4()
    entity_id = uuid4()

    with Session(engine) as session:
        first = AuditService.append_log(
            session=session,
            tenant_id="tenant-a",
            actor_user_id=actor_id,
            actor_role=Role.INSPECTOR,
            entity_type="EvidenceItem",
            entity_id=entity_id,
            action="CREATE",
            payload={"b": 2, "a": 1},
        )
        second = AuditService.append_log(
            session=session,
            tenant_id="tenant-a",
            actor_user_id=actor_id,
            actor_role=Role.INSPECTOR,
            entity_type="EvidenceItem",
            entity_id=entity_id,
            action="UPDATE",
            payload={"note": "updated", "at": datetime.now(timezone.utc).isoformat()},
        )

    assert first.prev_hash == "GENESIS"
    assert second.prev_hash == first.entry_hash
    assert json.loads(first.payload_json) == {"a": 1, "b": 2}

    with Session(engine) as session:
        logs = session.exec(select(AuditLog)).all()
        assert len(logs) == 2
