from datetime import datetime, timezone
from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app


def _headers(tenant: str) -> dict[str, str]:
    return {
        "X-Tenant-ID": tenant,
        "X-User-ID": str(uuid4()),
        "X-User-Role": "INSPECTOR",
    }


def test_evidence_endpoint_requires_auth_headers():
    payload = {
        "inspection_id": str(uuid4()),
        "checklist_item_key": "check-1",
        "title": "Missing headers",
        "note_text": "",
        "device_timestamp": datetime.now(timezone.utc).isoformat(),
    }

    with TestClient(app) as client:
        response = client.post("/api/v1/evidence", json=payload)

    assert response.status_code == 422


def test_photo_creation_rejects_cross_tenant_evidence_attachment():
    evidence_payload = {
        "inspection_id": str(uuid4()),
        "checklist_item_key": "check-2",
        "title": "Tenant A evidence",
        "note_text": "",
        "device_timestamp": datetime.now(timezone.utc).isoformat(),
    }

    with TestClient(app) as client:
        create_evidence = client.post(
            "/api/v1/evidence",
            json=evidence_payload,
            headers=_headers("tenant-a"),
        )
        assert create_evidence.status_code == 200
        evidence_id = create_evidence.json()["id"]

        photo_payload = {
            "evidence_item_id": evidence_id,
            "uri": "s3://bucket/photo.jpg",
            "exif_json": "{}",
            "latitude": 1.0,
            "longitude": 2.0,
            "accuracy_meters": 3.0,
            "captured_at_device": datetime.now(timezone.utc).isoformat(),
        }
        create_photo = client.post(
            "/api/v1/photos",
            json=photo_payload,
            headers=_headers("tenant-b"),
        )

    assert create_photo.status_code == 404
    assert create_photo.json()["detail"] == "Evidence item not found"
