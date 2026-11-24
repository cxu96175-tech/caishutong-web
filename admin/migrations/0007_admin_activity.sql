CREATE TABLE IF NOT EXISTS admin_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_email TEXT NOT NULL,
  device_id TEXT NOT NULL DEFAULT '',
  session_id TEXT NOT NULL DEFAULT '',
  event_name TEXT NOT NULL,
  page_name TEXT NOT NULL DEFAULT '',
  target_name TEXT NOT NULL DEFAULT '',
  device_type TEXT NOT NULL DEFAULT 'unknown',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_activity_created ON admin_activity(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_activity_event_created ON admin_activity(event_name,created_at);
CREATE INDEX IF NOT EXISTS idx_admin_activity_device_created ON admin_activity(device_id,created_at);
