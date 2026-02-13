from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


class Role(str, Enum):
    INSPECTOR = "INSPECTOR"
    REVIEWER = "REVIEWER"
    ADMIN = "ADMIN"


class SyncStatus(str, Enum):
    PENDING = "PENDING"
    IN_FLIGHT = "IN_FLIGHT"
    SYNCED = "SYNCED"
    FAILED = "FAILED"
    REQUIRES_REVIEW = "REQUIRES_REVIEW"


class BaseEntity(SQLModel):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    version: int = Field(default=1)


class User(BaseEntity, table=True):
    __tablename__ = "users"
    email: str
    full_name: str
    role: Role
    tenant_id: str


class ProjectSite(BaseEntity, table=True):
    __tablename__ = "project_sites"
    tenant_id: str
    name: str
    address: str
    timezone: str


class Inspection(BaseEntity, table=True):
    __tablename__ = "inspections"
    tenant_id: str
    project_site_id: UUID
    inspector_id: UUID
    status: str = "DRAFT"


class EvidenceItem(BaseEntity, table=True):
    __tablename__ = "evidence_items"
    tenant_id: str
    inspection_id: UUID
    checklist_item_key: str
    title: str
    note_text: str = ""
    captured_by: UUID
    device_timestamp: datetime
    server_timestamp: Optional[datetime] = None


class Photo(BaseEntity, table=True):
    __tablename__ = "photos"
    tenant_id: str
    evidence_item_id: UUID
    uri: str
    exif_json: str
    metadata_hash: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    accuracy_meters: Optional[float] = None
    captured_at_device: datetime
    captured_at_server: Optional[datetime] = None


class ClauseReference(BaseEntity, table=True):
    __tablename__ = "clause_references"
    tenant_id: str
    evidence_item_id: UUID
    clause_code: str
    clause_version: str
    clause_snapshot_text: str


class AuditLog(BaseEntity, table=True):
    __tablename__ = "audit_logs"
    tenant_id: str
    actor_user_id: UUID
    actor_role: Role
    entity_type: str
    entity_id: UUID
    action: str
    payload_json: str
    prev_hash: str
    entry_hash: str


class SyncQueueItem(BaseEntity, table=True):
    __tablename__ = "sync_queue"
    tenant_id: str
    operation_type: str
    entity_type: str
    entity_id: UUID
    payload_json: str
    status: SyncStatus = SyncStatus.PENDING
    attempt_count: int = 0
    last_error: Optional[str] = None
