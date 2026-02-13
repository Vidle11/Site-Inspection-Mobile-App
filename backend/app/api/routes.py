from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.core.auth import AuthContext, get_auth_context
from app.db.session import get_session
from app.models.entities import EvidenceItem, Photo
from app.schemas.evidence import AuditWrite, EvidenceCreate, PhotoCreate
from app.services.audit_service import AuditService
from app.services.hash_service import canonical_json_hash

router = APIRouter(prefix="/api/v1")


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}


@router.post("/evidence")
def create_evidence(
    payload: EvidenceCreate,
    session: Session = Depends(get_session),
    auth: AuthContext = Depends(get_auth_context),
):
    evidence = EvidenceItem(
        tenant_id=auth.tenant_id,
        inspection_id=payload.inspection_id,
        checklist_item_key=payload.checklist_item_key,
        title=payload.title,
        note_text=payload.note_text,
        captured_by=auth.user_id,
        device_timestamp=payload.device_timestamp,
        server_timestamp=datetime.now(timezone.utc),
    )
    session.add(evidence)
    session.commit()
    session.refresh(evidence)
    return evidence


@router.post("/photos")
def create_photo(
    payload: PhotoCreate,
    session: Session = Depends(get_session),
    auth: AuthContext = Depends(get_auth_context),
):
    evidence = session.get(EvidenceItem, payload.evidence_item_id)
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence item not found")

    photo = Photo(
        tenant_id=auth.tenant_id,
        evidence_item_id=payload.evidence_item_id,
        uri=payload.uri,
        exif_json=payload.exif_json,
        metadata_hash=canonical_json_hash(
            {
                "uri": payload.uri,
                "exif_json": payload.exif_json,
                "latitude": payload.latitude,
                "longitude": payload.longitude,
                "accuracy_meters": payload.accuracy_meters,
                "captured_at_device": payload.captured_at_device.isoformat(),
            }
        ),
        latitude=payload.latitude,
        longitude=payload.longitude,
        accuracy_meters=payload.accuracy_meters,
        captured_at_device=payload.captured_at_device,
        captured_at_server=datetime.now(timezone.utc),
    )
    session.add(photo)
    session.commit()
    session.refresh(photo)
    return photo


@router.post("/audit")
def append_audit(
    payload: AuditWrite,
    session: Session = Depends(get_session),
    auth: AuthContext = Depends(get_auth_context),
):
    audit = AuditService.append_log(
        session=session,
        tenant_id=auth.tenant_id,
        actor_user_id=auth.user_id,
        actor_role=auth.role,
        entity_type=payload.entity_type,
        entity_id=payload.entity_id,
        action=payload.action,
        payload=payload.payload,
    )
    return audit
