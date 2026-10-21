-- Migration 022: Add Referees Table and link to Matches
-- Phase 1 of Monitor Arbitral

CREATE TABLE IF NOT EXISTS referees (
    referee_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT,
    country TEXT DEFAULT 'Peru',
    total_games_sofa INTEGER,
    total_yellows_sofa INTEGER,
    total_reds_sofa INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Add referee_id to matches if it does not already exist
ALTER TABLE matches ADD COLUMN referee_id INTEGER REFERENCES referees(referee_id);

CREATE INDEX IF NOT EXISTS idx_matches_referee_id ON matches(referee_id);
