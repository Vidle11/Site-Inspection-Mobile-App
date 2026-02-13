# Site Inspection Mobile App (Evidence Capture)

Production-ready scaffold for a legally defensible, offline-first site inspection platform.

## What is included

- **Mobile app scaffold (React Native + Expo + TypeScript)** focused on 3-tap evidence capture.
- **Backend API scaffold (FastAPI + SQLModel)** with multi-tenant-ready data model.
- **Immutable audit architecture** using canonical JSON SHA-256 hash chaining.
- **Offline sync queue design** with conflict-resolution strategy.
- **Security baseline** (JWT-ready auth hooks, role-aware audit logging, tenant-aware request context).
- **Dockerized local deployment** and CI workflow.

## Repository structure

```text
mobile-app/                 # React Native (Expo) client
backend/                    # FastAPI server
infra/                      # SQL + infrastructure artifacts
docs/                       # Architecture and workflow documentation
.github/workflows/          # CI pipelines
```

## Quick start

### 1) Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL="sqlite:///./site_inspection.db"  # or postgres://...
uvicorn app.main:app --reload
```

### 2) Mobile app

```bash
cd mobile-app
npm install
npm run start
```

### Expo Go compatibility (iPhone)

This mobile app uses Expo SDK 54-compatible dependencies so it can open in current Expo Go builds on iOS without SDK mismatch errors.

If you previously installed dependencies for an older SDK, clean and reinstall:

```bash
cd mobile-app
rm -rf node_modules package-lock.json
npm install
npm run start
```


### 3) Local platform via Docker

```bash
docker compose -f infra/docker-compose.yml up --build
```

## Request context headers (current scaffold)

Until full JWT verification middleware is wired, API routes accept identity context via headers:

- `X-Tenant-ID`
- `X-User-ID`
- `X-User-Role` (`INSPECTOR|REVIEWER|ADMIN`)

This avoids hardcoded actor IDs and keeps audit records tenant-aware.

## Key legal-defensibility controls

- Each photo record stores:
  - EXIF payload (raw JSON)
  - Device timestamp and timezone
  - GPS + accuracy radius
  - SHA-256 metadata hash
- Audit log entries are immutable and chain-hashed (`entry_hash`, `prev_hash`).
- Clause references persist a **snapshot text + version** used at time of inspection.
- Sync records preserve both **device-created-at** and **server-received-at** timestamps.

## Sync model (offline-first)

- Writes are stored locally in encrypted SQLite.
- Each write emits a `SyncQueueItem` with deterministic operation IDs.
- Background sync posts queued ops in order.
- On conflict:
  - `audit_logs` and `photos` are append-only; no overwrite.
  - `inspection_items` use field-level merge where possible.
  - unresolved conflicts create a `REQUIRES_REVIEW` sync event.

See:
- `docs/ARCHITECTURE.md`
- `docs/EXAMPLE_WORKFLOW.md`

## Security notes

- JWT/OAuth hooks included in API dependency layer.
- Sensitive local data is intended for platform secure keystore + SQLCipher.
- No plaintext credentials should be persisted.
- TLS required for production sync endpoints.

## Deployment notes

- Cloud agnostic: API + Postgres + object store adapter abstraction.
- GitHub Actions workflow runs backend checks, tests, and validates project structure.



## Clean PR / merge checklist

Before opening or merging a PR, run:

```bash
# ensure no unresolved merge markers
rg -n "^(<<<<<<<|=======|>>>>>>>)" -S .

# ensure repo is clean
git status --short
```

If conflict markers are found, resolve them before committing.

