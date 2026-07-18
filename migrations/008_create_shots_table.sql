-- TABLA 1: Hechos Físicos Inmutables (Las coordenadas y cálculos geométricos del tiro)
CREATE TABLE IF NOT EXISTS player_shots (
    shot_id         INTEGER PRIMARY KEY, 
    player_id       INTEGER REFERENCES players(player_id),
    match_id        INTEGER REFERENCES matches(match_id),
    season_id       INTEGER,
    is_home         BOOLEAN,
    shot_type       TEXT,
    situation       TEXT,
    body_part       TEXT,
    coord_x         REAL,    
    coord_y         REAL,    
    distance_m      REAL,
    angle_rad       REAL,
    scraped_at      TEXT NOT NULL
);

-- TABLA 2: Evaluaciones del Modelo (Donde vivirá el Expected Goals - xG)
CREATE TABLE IF NOT EXISTS player_shots_xg (
    shot_id         INTEGER PRIMARY KEY REFERENCES player_shots(shot_id) ON DELETE CASCADE,
    calculated_xg   REAL,
    model_version   TEXT NOT NULL,
    calculated_at   TEXT NOT NULL
);

-- Índices optimizados para consultas rápidas en la base de datos
CREATE INDEX IF NOT EXISTS idx_player_shots_lookup ON player_shots(player_id, season_id);
CREATE INDEX IF NOT EXISTS idx_player_shots_match ON player_shots(match_id);