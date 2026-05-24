-- Audit trail: every attempted HTTP/browser fetch.

CREATE TABLE IF NOT EXISTS scrape_log (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_type        TEXT    NOT NULL,  -- teams|squads|season_stats|matches|match_stats|transfermarkt
    resource_key         TEXT    NOT NULL,  -- team_id, match_id, or URL
    scraped_at           TEXT    NOT NULL,  -- ISO 8601
    status               TEXT    NOT NULL,  -- success | failed | skipped
    http_status_code     INTEGER,
    error_message        TEXT,
    response_size_bytes  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_scrape_log_resource ON scrape_log(resource_type, resource_key);
CREATE INDEX IF NOT EXISTS idx_scrape_log_status   ON scrape_log(status);
