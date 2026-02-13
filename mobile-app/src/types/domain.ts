export type SyncStatus = 'PENDING' | 'IN_FLIGHT' | 'SYNCED' | 'FAILED' | 'REQUIRES_REVIEW';

export interface CapturePayload {
  inspectionId: string;
  checklistItemKey: string;
  title: string;
  noteText: string;
  deviceTimestamp: string;
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  timezone: string;
}

export interface QueueItem {
  id: string;
  operationType: 'CREATE_EVIDENCE' | 'CREATE_PHOTO' | 'APPEND_AUDIT';
  payload: Record<string, unknown>;
  status: SyncStatus;
  attempts: number;
}
