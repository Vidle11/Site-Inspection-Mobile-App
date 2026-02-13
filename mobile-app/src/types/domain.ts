export type SyncStatus = 'PENDING' | 'IN_FLIGHT' | 'SYNCED' | 'FAILED' | 'REQUIRES_REVIEW';

export type QueueOperationType = 'CREATE_EVIDENCE' | 'CREATE_PHOTO' | 'APPEND_AUDIT';

export interface GpsUnavailable {
  available: false;
}

export interface GpsAvailable {
  available: true;
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
}

export type GpsFix = GpsAvailable | GpsUnavailable;

export interface CapturedPhotoInput {
  uri: string;
  width: number;
  height: number;
  exifJson: string;
}

export interface EvidenceCaptureInput {
  inspectionId: string;
  checklistItemKey: string;
  title: string;
  noteText: string;
  deviceTimestamp: string;
  timezone: string;
  gps: GpsFix;
  metadataHash: string;
  photo?: CapturedPhotoInput;
}

export interface EvidenceRecord {
  id: string;
  inspectionId: string;
  checklistItemKey: string;
  title: string;
  noteText: string;
  deviceTimestamp: string;
  timezone: string;
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  metadataHash: string;
  photoUri?: string;
  photoExifJson?: string;
  photoMetadataHash?: string;
  photoWidth?: number;
  photoHeight?: number;
  serverEvidenceId?: string;
  serverPhotoId?: string;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEvidencePayload {
  localEvidenceId: string;
  inspection_id: string;
  checklist_item_key: string;
  title: string;
  note_text: string;
  device_timestamp: string;
}

export interface CreatePhotoPayload {
  localEvidenceId: string;
  uri: string;
  exif_json: string;
  latitude: number | null;
  longitude: number | null;
  accuracy_meters: number | null;
  captured_at_device: string;
}

export interface QueueItem {
  id: string;
  entityId: string;
  operationType: QueueOperationType;
  payload: Record<string, unknown>;
  status: SyncStatus;
  attempts: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QueueSummary {
  pending: number;
  inFlight: number;
  failed: number;
  requiresReview: number;
  synced: number;
  total: number;
}

export interface SyncResult {
  processed: number;
  synced: number;
  failed: number;
  requiresReview: number;
  pending: number;
  message: string;
}
