-- Turso/SQLite-safe counterpart to 018_manual_chat_log.sql.

CREATE TABLE IF NOT EXISTS manual_chat_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, question TEXT NOT NULL, matched INTEGER NOT NULL DEFAULT 0,
  matched_heading TEXT, page TEXT, asked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_manual_chat_unmatched ON manual_chat_log(matched, asked_at DESC);
