-- Logs every question asked of the Manuals page's chat assistant, so gaps
-- in the manuals can be found and filled. Unmatched questions also trigger
-- a developer email alert (see lib/mailer-adapter.mjs, MANUAL_ALERT_EMAIL).

BEGIN;

CREATE TABLE manual_chat_log (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    question        TEXT NOT NULL,
    matched         BOOLEAN NOT NULL DEFAULT FALSE,
    matched_heading TEXT,
    page            TEXT,
    asked_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_manual_chat_unmatched ON manual_chat_log (matched, asked_at DESC);

COMMIT;
