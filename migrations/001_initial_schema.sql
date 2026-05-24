-- Core reference tables: teams, players, matches.
-- SofaScore IDs are used as primary keys so they map 1:1 with API responses.

CREATE TABLE IF NOT EXISTS teams (
    team_id        INTEGER PRIMARY KEY,  -- SofaScore team ID
    name           TEXT    NOT NULL,
    short_name     TEXT,
    country        TEXT,
    logo_url       TEXT,
    tm_team_id     INTEGER,             -- Transfermarkt team ID (nullable until configured)
    tm_team_name   TEXT,               -- Transfermarkt URL-slug name
    scraped_at     TEXT    NOT NULL    -- ISO 8601
);

CREATE TABLE IF NOT EXISTS players (
    player_id      INTEGER PRIMARY KEY,  -- SofaScore player ID
    team_id        INTEGER REFERENCES teams(team_id),
    name           TEXT    NOT NULL,
    date_of_birth  TEXT,                -- YYYY-MM-DD
    nationality    TEXT,
    position       TEXT,                -- SofaScore raw: F, M, D, G
    position_group TEXT,                -- Derived: Forward | Midfielder | Defender | Goalkeeper
    shirt_number   INTEGER,
    scraped_at     TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS matches (
    match_id       INTEGER PRIMARY KEY,  -- SofaScore event ID
    home_team_id   INTEGER REFERENCES teams(team_id),
    away_team_id   INTEGER REFERENCES teams(team_id),
    match_date     TEXT    NOT NULL,    -- ISO 8601
    round          INTEGER,
    home_score     INTEGER,
    away_score     INTEGER,
    status         TEXT    NOT NULL,   -- played | postponed | cancelled | scheduled
    match_url      TEXT,               -- Full SofaScore URL for LanusStats calls
    season_id      INTEGER NOT NULL,
    scraped_at     TEXT    NOT NULL
);
