-- Migration 021: Add flashscore_id column to teams table and create index

ALTER TABLE teams ADD COLUMN flashscore_id TEXT;
CREATE INDEX IF NOT EXISTS idx_teams_flashscore_id ON teams(flashscore_id);
