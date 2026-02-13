from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class PhotoCreate(BaseModel):
    evidence_item_id: UUID
    uri: str
    exif_json: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    accuracy_meters: Optional[float] = None
    captured_at_device: datetime


class EvidenceCreate(BaseModel):
    inspection_id: UUID
    checklist_item_key: str
    title: str
    note_text: str = ""
    device_timestamp: datetime


class AuditWrite(BaseModel):
    entity_type: str
    entity_id: UUID
    action: str
    payload: dict
