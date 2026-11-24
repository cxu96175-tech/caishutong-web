ALTER TABLE analytics_events ADD COLUMN user_id TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_analytics_user_created ON analytics_events(user_id, created_at);
