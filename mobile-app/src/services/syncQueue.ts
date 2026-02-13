import {
  getEvidenceById,
  getQueueSummary,
  listQueueForSync,
  markQueueItemFailed,
  markQueueItemInFlight,
  markQueueItemSynced,
  refreshEvidenceSyncStatus,
  setEvidenceServerEvidenceId,
  setEvidenceServerPhotoId
} from './localStore';
import {
  CreateEvidencePayload,
  CreatePhotoPayload,
  QueueItem,
  SyncResult
} from '../types/domain';

interface SyncConfig {
  baseUrl: string;
  tenantId?: string;
  userId?: string;
  userRole?: 'INSPECTOR' | 'REVIEWER' | 'ADMIN';
  batchSize?: number;
}

interface EvidenceApiResponse {
  id: string;
}

interface PhotoApiResponse {
  id: string;
}

const DEFAULT_SYNC_HEADERS = {
  tenantId: 'default',
  userId: '00000000-0000-0000-0000-000000000001',
  userRole: 'INSPECTOR' as const
};

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

function mimeTypeFromUri(uri: string): string {
  const normalized = uri.toLowerCase();
  if (normalized.endsWith('.png')) return 'image/png';
  if (normalized.endsWith('.heic') || normalized.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown sync error';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isCreateEvidencePayload(payload: unknown): payload is CreateEvidencePayload {
  if (!isRecord(payload)) {
    return false;
  }

  return (
    typeof payload.localEvidenceId === 'string' &&
    typeof payload.inspection_id === 'string' &&
    typeof payload.checklist_item_key === 'string' &&
    typeof payload.title === 'string' &&
    typeof payload.note_text === 'string' &&
    typeof payload.device_timestamp === 'string'
  );
}

function isCreatePhotoPayload(payload: unknown): payload is CreatePhotoPayload {
  if (!isRecord(payload)) {
    return false;
  }

  const hasNullableNumber = (value: unknown): boolean => value === null || typeof value === 'number';
  return (
    typeof payload.localEvidenceId === 'string' &&
    typeof payload.uri === 'string' &&
    typeof payload.exif_json === 'string' &&
    hasNullableNumber(payload.latitude) &&
    hasNullableNumber(payload.longitude) &&
    hasNullableNumber(payload.accuracy_meters) &&
    typeof payload.captured_at_device === 'string'
  );
}

async function postJson<TResponse>(
  baseUrl: string,
  path: string,
  body: Record<string, unknown>,
  headers: { tenantId: string; userId: string; userRole: string }
): Promise<TResponse> {
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-ID': headers.tenantId,
      'X-User-ID': headers.userId,
      'X-User-Role': headers.userRole
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${responseText.slice(0, 180)}`);
  }

  return (await response.json()) as TResponse;
}

async function uploadPhoto(
  baseUrl: string,
  headers: { tenantId: string; userId: string; userRole: string },
  payload: CreatePhotoPayload,
  serverEvidenceId: string
): Promise<PhotoApiResponse> {
  const extension = payload.uri.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
  const formData = new FormData();
  formData.append('evidence_item_id', serverEvidenceId);
  formData.append('captured_at_device', payload.captured_at_device);
  formData.append('exif_json', payload.exif_json);
  if (payload.latitude !== null) {
    formData.append('latitude', String(payload.latitude));
  }
  if (payload.longitude !== null) {
    formData.append('longitude', String(payload.longitude));
  }
  if (payload.accuracy_meters !== null) {
    formData.append('accuracy_meters', String(payload.accuracy_meters));
  }
  formData.append(
    'file',
    {
      uri: payload.uri,
      name: `evidence-${payload.localEvidenceId}.${extension}`,
      type: mimeTypeFromUri(payload.uri)
    } as any
  );

  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/api/v1/photos/upload`, {
    method: 'POST',
    headers: {
      'X-Tenant-ID': headers.tenantId,
      'X-User-ID': headers.userId,
      'X-User-Role': headers.userRole
    },
    body: formData
  });

  if (response.status === 404) {
    // Backward-compatible fallback for older backends that only support JSON photo creation.
    return postJson<PhotoApiResponse>(
      baseUrl,
      '/api/v1/photos',
      {
        evidence_item_id: serverEvidenceId,
        uri: payload.uri,
        exif_json: payload.exif_json,
        latitude: payload.latitude,
        longitude: payload.longitude,
        accuracy_meters: payload.accuracy_meters,
        captured_at_device: payload.captured_at_device
      },
      headers
    );
  }

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${responseText.slice(0, 180)}`);
  }

  return (await response.json()) as PhotoApiResponse;
}

async function syncItem(
  item: QueueItem,
  baseUrl: string,
  headers: { tenantId: string; userId: string; userRole: string }
): Promise<void> {
  if (item.operationType === 'CREATE_EVIDENCE') {
    if (!isCreateEvidencePayload(item.payload)) {
      throw new Error(`Queue item ${item.id} has invalid CREATE_EVIDENCE payload.`);
    }

    const response = await postJson<EvidenceApiResponse>(
      baseUrl,
      '/api/v1/evidence',
      {
        inspection_id: item.payload.inspection_id,
        checklist_item_key: item.payload.checklist_item_key,
        title: item.payload.title,
        note_text: item.payload.note_text,
        device_timestamp: item.payload.device_timestamp
      },
      headers
    );

    if (!response.id) {
      throw new Error(`Queue item ${item.id} did not receive an evidence id.`);
    }

    await setEvidenceServerEvidenceId(item.payload.localEvidenceId, response.id);
    return;
  }

  if (item.operationType === 'CREATE_PHOTO') {
    if (!isCreatePhotoPayload(item.payload)) {
      throw new Error(`Queue item ${item.id} has invalid CREATE_PHOTO payload.`);
    }

    const evidence = await getEvidenceById(item.payload.localEvidenceId);
    if (!evidence) {
      throw new Error(`Local evidence ${item.payload.localEvidenceId} not found.`);
    }
    if (!evidence.serverEvidenceId) {
      throw new Error(
        `Local evidence ${item.payload.localEvidenceId} has no server evidence id. Sync evidence item first.`
      );
    }

    const response = await uploadPhoto(baseUrl, headers, item.payload, evidence.serverEvidenceId);

    if (response.id) {
      await setEvidenceServerPhotoId(item.payload.localEvidenceId, response.id);
    }
    return;
  }

  throw new Error(`Unsupported queue operation type: ${item.operationType}`);
}

export async function syncPendingQueue(config: SyncConfig): Promise<SyncResult> {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  if (!baseUrl) {
    throw new Error('Sync base URL is required.');
  }

  const batchSize = config.batchSize ?? 20;
  const queueItems = await listQueueForSync(batchSize);
  if (queueItems.length === 0) {
    const summary = await getQueueSummary();
    return {
      processed: 0,
      synced: 0,
      failed: 0,
      requiresReview: 0,
      pending: summary.pending,
      message: 'No pending queue items.'
    };
  }

  const headers = {
    tenantId: config.tenantId ?? DEFAULT_SYNC_HEADERS.tenantId,
    userId: config.userId ?? DEFAULT_SYNC_HEADERS.userId,
    userRole: config.userRole ?? DEFAULT_SYNC_HEADERS.userRole
  };

  let synced = 0;
  let failed = 0;
  let requiresReview = 0;

  for (const item of queueItems) {
    await markQueueItemInFlight(item.id);
    await refreshEvidenceSyncStatus(item.entityId);

    try {
      await syncItem(item, baseUrl, headers);
      await markQueueItemSynced(item.id);
      synced += 1;
    } catch (error) {
      const status = await markQueueItemFailed(item.id, formatError(error));
      if (status === 'REQUIRES_REVIEW') {
        requiresReview += 1;
      } else {
        failed += 1;
      }
    }

    await refreshEvidenceSyncStatus(item.entityId);
  }

  const summary = await getQueueSummary();
  return {
    processed: queueItems.length,
    synced,
    failed,
    requiresReview,
    pending: summary.pending,
    message: `Processed ${queueItems.length}. Synced ${synced}, failed ${failed}, review ${requiresReview}, pending ${summary.pending}.`
  };
}
