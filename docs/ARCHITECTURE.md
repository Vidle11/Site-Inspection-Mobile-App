# Architecture Notes

## High-level components

1. **Mobile Client (React Native/Expo)**
   - Camera + GPS + speech-to-text capture pipeline.
   - Offline encrypted SQLite store.
   - Sync engine with queue and retry/backoff.

2. **API Service (FastAPI)**
   - Authn/authz middleware (JWT/OAuth-ready).
   - Evidence ingestion endpoints.
   - Append-only audit log service with chain hashing.

3. **Database (PostgreSQL)**
   - Relational entities with UUID primary keys.
   - Timestamp/version columns on mutable entities.
   - Audit and sync tracking tables.

4. **Object Storage**
   - Media storage (photos, report exports).
   - Hash verification metadata.

## Data integrity strategy

- `photo.metadata_hash` computed client-side and server-validated.
- `audit_logs.entry_hash = sha256(prev_hash + canonical_payload)`.
- DB constraints enforce required provenance fields (`created_by`, timestamps, site references).

## Offline-first strategy

- Local writes are **authoritative for capture**.
- Server becomes **authoritative for resolved state** after sync.
- Queue item lifecycle:
  - `PENDING` → `IN_FLIGHT` → `SYNCED` or `FAILED` or `REQUIRES_REVIEW`.

## Conflict resolution

- Immutable entities: always append.
- Mutable entities:
  - compare `updated_at` + `version`.
  - perform deterministic merge for note text and tags.
  - if semantically conflicting, mark for manual resolution.

## Security model

- JWT access tokens with short TTL + refresh rotation.
- RBAC roles: `INSPECTOR`, `REVIEWER`, `ADMIN`.
- Transport: TLS 1.2+.
- Local encryption keys obtained from secure enclave/keystore.

## Performance targets

- Evidence capture interaction in <= 3 taps.
- Offline view load under 1 second for cached inspection.
- Background sync incremental batches of 20 operations.


## Configuration model

- Runtime config is environment-driven (`DATABASE_URL`, `JWT_SECRET_KEY`, token settings).
- Default local DB uses SQLite for fast local bootstrap and tests.
- Production deployment should point `DATABASE_URL` to PostgreSQL and set a strong `JWT_SECRET_KEY`.
