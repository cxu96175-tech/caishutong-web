CREATE TABLE IF NOT EXISTS lottery_latest (
  game TEXT PRIMARY KEY,
  issue TEXT NOT NULL,
  record_json TEXT NOT NULL,
  source_json TEXT NOT NULL,
  checked_at TEXT NOT NULL,
  completed_on TEXT NOT NULL DEFAULT ''
);
