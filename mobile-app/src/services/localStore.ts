import * as Crypto from 'expo-crypto';

import { initDatabase, getDatabase } from './database';
import {
  CreateEvidencePayload,
  CreatePhotoPayload,
  EvidenceCaptureInput,
  EvidenceRecord,
  QueueItem,
  QueueSummary,
  SyncStatus
} from '../types/domain';

export const DEFAULT_SYNC_BASE_URL = 'http://127.0.0.1:8000';

const SYNC_STATUS_ORDER: readonly SyncStatus[] = ['REQUIRES_REVIEW', 'FAILED', 'IN_FLIGHT', 'PENDING', 'SYNCED'];
const MAX_ERROR_LENGTH = 400;

interface EvidenceRow {
  id: string;
  inspection_id: string;
  checklist_item_key: string;
  title: string;
  note_text: string;
  device_timestamp: string;
  timezone: string;
  latitude: number | null;
  longitude: number | null;
  accuracy_meters: number | null;
  metadata_hash: string;
  photo_uri: string | null;
  photo_exif_json: string | null;
  photo_metadata_hash: string | null;
  photo_width: number | null;
  photo_height: number | null;
  server_evidence_id: string | null;
  server_photo_id: string | null;
  sync_status: string;
  created_at: string;
  updated_at: string;
}

interface QueueRow {
  id: string;
  entity_id: string;
  operation_type: string;
  payload_json: string;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

interface StatusCountRow {
  status: string;
  count: number;
}

function nowIso(): string {
  return new Date().toISOString();
}

function sanitizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    return DEFAULT_SYNC_BASE_URL;
  }
  return trimmed.replace(/\/+$/, '');
}

function isSyncStatus(value: string): value is SyncStatus {
  return (
    value === 'PENDING' ||
    value === 'IN_FLIGHT' ||
    value === 'SYNCED' ||
    value === 'FAILED' ||
    value === 'REQUIRES_REVIEW'
  );
}

function toSyncStatus(value: string): SyncStatus {
  return isSyncStatus(value) ? value : 'FAILED';
}

function parsePayload(payloadJson: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(payloadJson);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Keep an empty payload if the row is malformed.
  }
  return {};
}

function mapEvidence(row: EvidenceRow): EvidenceRecord {
  return {
    id: row.id,
    inspectionId: row.inspection_id,
    checklistItemKey: row.checklist_item_key,
    title: row.title,
    noteText: row.note_text,
    deviceTimestamp: row.device_timestamp,
    timezone: row.timezone,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    accuracyMeters: row.accuracy_meters ?? undefined,
    metadataHash: row.metadata_hash,
    photoUri: row.photo_uri ?? undefined,
    photoExifJson: row.photo_exif_json ?? undefined,
    photoMetadataHash: row.photo_metadata_hash ?? undefined,
    photoWidth: row.photo_width ?? undefined,
    photoHeight: row.photo_height ?? undefined,
    serverEvidenceId: row.server_evidence_id ?? undefined,
    serverPhotoId: row.server_photo_id ?? undefined,
    syncStatus: toSyncStatus(row.sync_status),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapQueue(row: QueueRow): QueueItem {
  return {
    id: row.id,
    entityId: row.entity_id,
    operationType: row.operation_type as QueueItem['operationType'],
    payload: parsePayload(row.payload_json),
    status: toSyncStatus(row.status),
    attempts: row.attempts,
    lastError: row.last_error ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toDbNumber(value: number | undefined): number | null {
  return typeof value === 'number' ? value : null;
}

function compactError(message: string): string {
  return message.slice(0, MAX_ERROR_LENGTH);
}

function deriveEvidenceStatus(queueStatuses: SyncStatus[]): SyncStatus {
  if (queueStatuses.length === 0) {
    return 'SYNCED';
  }
  for (const candidate of SYNC_STATUS_ORDER) {
    if (queueStatuses.includes(candidate)) {
      return candidate;
    }
  }
  return 'FAILED';
}

export async function getSetting(key: string): Promise<string | null> {
  await initDatabase();
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', [key]);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await initDatabase();
  const db = await getDatabase();
  await db.runAsync(
    `
    INSERT INTO app_settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `,
    [key, value]
  );
}

export async function getSyncBaseUrl(): Promise<string> {
  const stored = await getSetting('sync_base_url');
  return sanitizeUrl(stored ?? DEFAULT_SYNC_BASE_URL);
}

export async function setSyncBaseUrl(url: string): Promise<string> {
  const normalized = sanitizeUrl(url);
  await setSetting('sync_base_url', normalized);
  return normalized;
}

export async function createEvidenceCapture(input: EvidenceCaptureInput): Promise<EvidenceRecord> {
  await initDatabase();
  const db = await getDatabase();
  const createdAt = nowIso();
  const evidenceId = Crypto.randomUUID();

  const latitude = input.gps.available ? input.gps.latitude : null;
  const longitude = input.gps.available ? input.gps.longitude : null;
  const accuracyMeters = input.gps.available ? toDbNumber(input.gps.accuracyMeters) : null;

  const createEvidencePayload: CreateEvidencePayload = {
    localEvidenceId: evidenceId,
    inspection_id: input.inspectionId,
    checklist_item_key: input.checklistItemKey,
    title: input.title,
    note_text: input.noteText,
    device_timestamp: input.deviceTimestamp
  };

  const createPhotoPayload: CreatePhotoPayload | null = input.photo
    ? {
        localEvidenceId: evidenceId,
        uri: input.photo.uri,
        exif_json: input.photo.exifJson,
        latitude,
        longitude,
        accuracy_meters: accuracyMeters,
        captured_at_device: input.deviceTimestamp
      }
    : null;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `
      INSERT INTO evidence_items_local (
        id,
        inspection_id,
        checklist_item_key,
        title,
        note_text,
        device_timestamp,
        timezone,
        latitude,
        longitude,
        accuracy_meters,
        metadata_hash,
        photo_uri,
        photo_exif_json,
        photo_metadata_hash,
        photo_width,
        photo_height,
        server_evidence_id,
        server_photo_id,
        sync_status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        evidenceId,
        input.inspectionId,
        input.checklistItemKey,
        input.title,
        input.noteText,
        input.deviceTimestamp,
        input.timezone,
        latitude,
        longitude,
        accuracyMeters,
        input.metadataHash,
        input.photo?.uri ?? null,
        input.photo?.exifJson ?? null,
        input.photo ? input.metadataHash : null,
        input.photo?.width ?? null,
        input.photo?.height ?? null,
        null,
        null,
        'PENDING',
        createdAt,
        createdAt
      ]
    );

    await db.runAsync(
      `
      INSERT INTO sync_queue_items (
        id,
        entity_id,
        operation_type,
        payload_json,
        status,
        attempts,
        last_error,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        Crypto.randomUUID(),
        evidenceId,
        'CREATE_EVIDENCE',
        JSON.stringify(createEvidencePayload),
        'PENDING',
        0,
        null,
        createdAt,
        createdAt
      ]
    );

    if (createPhotoPayload) {
      await db.runAsync(
        `
        INSERT INTO sync_queue_items (
          id,
          entity_id,
          operation_type,
          payload_json,
          status,
          attempts,
          last_error,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          Crypto.randomUUID(),
          evidenceId,
          'CREATE_PHOTO',
          JSON.stringify(createPhotoPayload),
          'PENDING',
          0,
          null,
          createdAt,
          createdAt
        ]
      );
    }
  });

  const saved = await getEvidenceById(evidenceId);
  if (!saved) {
    throw new Error('Evidence capture was not saved.');
  }
  return saved;
}

export async function getEvidenceById(evidenceId: string): Promise<EvidenceRecord | null> {
  await initDatabase();
  const db = await getDatabase();
  const row = await db.getFirstAsync<EvidenceRow>(
    `
    SELECT
      id,
      inspection_id,
      checklist_item_key,
      title,
      note_text,
      device_timestamp,
      timezone,
      latitude,
      longitude,
      accuracy_meters,
      metadata_hash,
      photo_uri,
      photo_exif_json,
      photo_metadata_hash,
      photo_width,
      photo_height,
      server_evidence_id,
      server_photo_id,
      sync_status,
      created_at,
      updated_at
    FROM evidence_items_local
    WHERE id = ?
    `,
    [evidenceId]
  );

  return row ? mapEvidence(row) : null;
}

export async function listRecentEvidence(limit = 20): Promise<EvidenceRecord[]> {
  await initDatabase();
  const db = await getDatabase();
  const rows = await db.getAllAsync<EvidenceRow>(
    `
    SELECT
      id,
      inspection_id,
      checklist_item_key,
      title,
      note_text,
      device_timestamp,
      timezone,
      latitude,
      longitude,
      accuracy_meters,
      metadata_hash,
      photo_uri,
      photo_exif_json,
      photo_metadata_hash,
      photo_width,
      photo_height,
      server_evidence_id,
      server_photo_id,
      sync_status,
      created_at,
      updated_at
    FROM evidence_items_local
    ORDER BY created_at DESC
    LIMIT ?
    `,
    [limit]
  );
  return rows.map(mapEvidence);
}

export async function listQueue(limit = 100): Promise<QueueItem[]> {
  await initDatabase();
  const db = await getDatabase();
  const rows = await db.getAllAsync<QueueRow>(
    `
    SELECT
      id,
      entity_id,
      operation_type,
      payload_json,
      status,
      attempts,
      last_error,
      created_at,
      updated_at
    FROM sync_queue_items
    ORDER BY created_at ASC
    LIMIT ?
    `,
    [limit]
  );
  return rows.map(mapQueue);
}

export async function listQueueForSync(limit = 20): Promise<QueueItem[]> {
  await initDatabase();
  const db = await getDatabase();
  const rows = await db.getAllAsync<QueueRow>(
    `
    SELECT
      id,
      entity_id,
      operation_type,
      payload_json,
      status,
      attempts,
      last_error,
      created_at,
      updated_at
    FROM sync_queue_items
    WHERE status IN ('PENDING', 'FAILED')
    ORDER BY created_at ASC
    LIMIT ?
    `,
    [limit]
  );
  return rows.map(mapQueue);
}

export async function getQueueSummary(): Promise<QueueSummary> {
  await initDatabase();
  const db = await getDatabase();
  const rows = await db.getAllAsync<StatusCountRow>(
    `
    SELECT status, COUNT(*) AS count
    FROM sync_queue_items
    GROUP BY status
    `
  );

  const summary: QueueSummary = {
    pending: 0,
    inFlight: 0,
    failed: 0,
    requiresReview: 0,
    synced: 0,
    total: 0
  };

  for (const row of rows) {
    const status = toSyncStatus(row.status);
    if (status === 'PENDING') {
      summary.pending = row.count;
    } else if (status === 'IN_FLIGHT') {
      summary.inFlight = row.count;
    } else if (status === 'FAILED') {
      summary.failed = row.count;
    } else if (status === 'REQUIRES_REVIEW') {
      summary.requiresReview = row.count;
    } else if (status === 'SYNCED') {
      summary.synced = row.count;
    }
  }

  summary.total = summary.pending + summary.inFlight + summary.failed + summary.requiresReview + summary.synced;
  return summary;
}

export async function markQueueItemInFlight(queueId: string): Promise<void> {
  await initDatabase();
  const db = await getDatabase();
  await db.runAsync(
    `
    UPDATE sync_queue_items
    SET status = ?, last_error = NULL, updated_at = ?
    WHERE id = ?
    `,
    ['IN_FLIGHT', nowIso(), queueId]
  );
}

export async function markQueueItemSynced(queueId: string): Promise<void> {
  await initDatabase();
  const db = await getDatabase();
  await db.runAsync(
    `
    UPDATE sync_queue_items
    SET status = ?, last_error = NULL, updated_at = ?
    WHERE id = ?
    `,
    ['SYNCED', nowIso(), queueId]
  );
}

export async function markQueueItemFailed(queueId: string, errorMessage: string): Promise<SyncStatus> {
  await initDatabase();
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ attempts: number }>('SELECT attempts FROM sync_queue_items WHERE id = ?', [queueId]);
  const nextAttempts = (row?.attempts ?? 0) + 1;
  const status: SyncStatus = nextAttempts >= 3 ? 'REQUIRES_REVIEW' : 'FAILED';

  await db.runAsync(
    `
    UPDATE sync_queue_items
    SET status = ?, attempts = ?, last_error = ?, updated_at = ?
    WHERE id = ?
    `,
    [status, nextAttempts, compactError(errorMessage), nowIso(), queueId]
  );

  return status;
}

export async function setEvidenceServerEvidenceId(localEvidenceId: string, serverEvidenceId: string): Promise<void> {
  await initDatabase();
  const db = await getDatabase();
  await db.runAsync(
    `
    UPDATE evidence_items_local
    SET server_evidence_id = ?, updated_at = ?
    WHERE id = ?
    `,
    [serverEvidenceId, nowIso(), localEvidenceId]
  );
}

export async function setEvidenceServerPhotoId(localEvidenceId: string, serverPhotoId: string): Promise<void> {
  await initDatabase();
  const db = await getDatabase();
  await db.runAsync(
    `
    UPDATE evidence_items_local
    SET server_photo_id = ?, updated_at = ?
    WHERE id = ?
    `,
    [serverPhotoId, nowIso(), localEvidenceId]
  );
}

export async function refreshEvidenceSyncStatus(localEvidenceId: string): Promise<SyncStatus> {
  await initDatabase();
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ status: string }>('SELECT status FROM sync_queue_items WHERE entity_id = ?', [localEvidenceId]);
  const status = deriveEvidenceStatus(rows.map((row) => toSyncStatus(row.status)));

  await db.runAsync(
    `
    UPDATE evidence_items_local
    SET sync_status = ?, updated_at = ?
    WHERE id = ?
    `,
    [status, nowIso(), localEvidenceId]
  );

  return status;
}
