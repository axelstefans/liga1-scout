-- Migration 024: Add disciplinary and friction data (fouls, cards and substitutions)

-- 1. Añadir columnas de faltas a player_match_stats
ALTER TABLE player_match_stats ADD COLUMN fouls INTEGER DEFAULT 0;
ALTER TABLE player_match_stats ADD COLUMN was_fouled INTEGER DEFAULT 0;

-- 2. Crear tabla match_card_incidents
CREATE TABLE IF NOT EXISTS match_card_incidents (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id     INTEGER NOT NULL,
    team_id      INTEGER NOT NULL,
    player_id    INTEGER NOT NULL,
    player_name  TEXT,
    minute       INTEGER NOT NULL,
    extra_minute INTEGER DEFAULT 0,
    card_type    TEXT NOT NULL,
    reason       TEXT,
    rescinded    BOOLEAN DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_mci_match  ON match_card_incidents(match_id);
CREATE INDEX IF NOT EXISTS idx_mci_player ON match_card_incidents(player_id);

-- 3. Crear tabla match_substitution_incidents
CREATE TABLE IF NOT EXISTS match_substitution_incidents (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id         INTEGER NOT NULL,
    team_id          INTEGER NOT NULL,
    player_in_id     INTEGER NOT NULL,
    player_in_name   TEXT,
    player_out_id    INTEGER NOT NULL,
    player_out_name  TEXT,
    minute           INTEGER NOT NULL,
    extra_minute     INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_msi_match      ON match_substitution_incidents(match_id);
CREATE INDEX IF NOT EXISTS idx_msi_player_in  ON match_substitution_incidents(player_in_id);
CREATE INDEX IF NOT EXISTS idx_msi_player_out ON match_substitution_incidents(player_out_id);
