CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  nickname TEXT NOT NULL DEFAULT '彩友',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_members_last_login ON members(last_login_at);
