CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  page_name TEXT NOT NULL DEFAULT '',
  game_name TEXT NOT NULL DEFAULT '',
  device_type TEXT NOT NULL DEFAULT 'unknown',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_event_created ON analytics_events(event_name, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_visitor_created ON analytics_events(visitor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_page_created ON analytics_events(page_name, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_game_created ON analytics_events(game_name, created_at);
