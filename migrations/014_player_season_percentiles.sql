CREATE TABLE IF NOT EXISTS player_season_percentiles (
    player_id INTEGER PRIMARY KEY REFERENCES players(player_id),
    goals_pct REAL,
    assists_pct REAL,
    key_passes_pct REAL,
    successful_dribbles_pct REAL,
    tackles_pct REAL,
    interceptions_pct REAL,
    rating_pct REAL,
    minutes_played_pct REAL,
    accurate_passes_percentage_pct REAL,
    ground_duels_won_percentage_pct REAL,
    saves_pct REAL,
    clean_sheets_pct REAL
);
