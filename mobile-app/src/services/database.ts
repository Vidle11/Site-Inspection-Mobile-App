import * as SQLite from 'expo-sqlite';

const DATABASE_NAME = 'site_inspection.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let initialized = false;

const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evidence_items_local (
  id TEXT PRIMARY KEY NOT NULL,
  inspection_id TEXT NOT NULL,
  checklist_item_key TEXT NOT NULL,
  title TEXT NOT NULL,
  note_text TEXT NOT NULL,
  device_timestamp TEXT NOT NULL,
  timezone TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  accuracy_meters REAL,
  metadata_hash TEXT NOT NULL,
  photo_uri TEXT,
  photo_exif_json TEXT,
  photo_metadata_hash TEXT,
  photo_width INTEGER,
  photo_height INTEGER,
  server_evidence_id TEXT,
  server_photo_id TEXT,
  sync_status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_queue_items (
  id TEXT PRIMARY KEY NOT NULL,
  entity_id TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_queue_status_created
  ON sync_queue_items(status, created_at);

CREATE INDEX IF NOT EXISTS idx_queue_entity_created
  ON sync_queue_items(entity_id, created_at);
`;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DATABASE_NAME);
  }
  return dbPromise;
}

export async function initDatabase(): Promise<void> {
  if (initialized) {
    return;
  }

  const db = await getDatabase();
  await db.execAsync(SCHEMA_SQL);
  initialized = true;
}
