-- Migration 017: Create team match metrics table and views for "Equipos y Liga" module

DROP TABLE IF EXISTS team_match_metrics;

CREATE TABLE team_match_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER NOT NULL,
    season_id INTEGER NOT NULL,
    tournament TEXT NOT NULL,
    match_date TEXT NOT NULL,
    round INTEGER NOT NULL,
    team_id INTEGER NOT NULL,
    opponent_team_id INTEGER NOT NULL,
    is_home INTEGER NOT NULL,
    goals_for INTEGER NOT NULL,
    goals_against INTEGER NOT NULL,
    result TEXT NOT NULL,
    points INTEGER NOT NULL,
    shots_for INTEGER NOT NULL,
    shots_against INTEGER NOT NULL,
    shots_on_target_for INTEGER NOT NULL,
    shots_on_target_against INTEGER NOT NULL,
    xg_for REAL NOT NULL,
    xg_against REAL NOT NULL,
    passes_total INTEGER NOT NULL,
    passes_completed INTEGER NOT NULL,
    opp_passes_total INTEGER NOT NULL,
    opp_passes_completed INTEGER NOT NULL,
    final_third_passes_for INTEGER NOT NULL,
    final_third_passes_against INTEGER NOT NULL,
    defensive_actions_high INTEGER NOT NULL,
    opp_passes_own_half INTEGER NOT NULL
);

-- Populate team_match_metrics with all played matches in the current season (88529)
WITH match_sides AS (
    SELECT 
        m.match_id,
        m.season_id,
        CASE WHEN strftime('%m', m.match_date) >= '06' THEN 'Clausura' ELSE 'Apertura' END as tournament,
        m.match_date,
        m.round,
        m.home_team_id as team_id,
        m.away_team_id as opponent_team_id,
        1 as is_home,
        m.home_score as goals_for,
        m.away_score as goals_against,
        CASE WHEN m.home_score > m.away_score THEN 'W' WHEN m.home_score = m.away_score THEN 'D' ELSE 'L' END as result,
        CASE WHEN m.home_score > m.away_score THEN 3 WHEN m.home_score = m.away_score THEN 1 ELSE 0 END as points
    FROM matches m
    WHERE m.season_id = 88529 AND m.status = 'played'
    UNION ALL
    SELECT 
        m.match_id,
        m.season_id,
        CASE WHEN strftime('%m', m.match_date) >= '06' THEN 'Clausura' ELSE 'Apertura' END as tournament,
        m.match_date,
        m.round,
        m.away_team_id as team_id,
        m.home_team_id as opponent_team_id,
        0 as is_home,
        m.away_score as goals_for,
        m.home_score as goals_against,
        CASE WHEN m.away_score > m.home_score THEN 'W' WHEN m.away_score = m.home_score THEN 'D' ELSE 'L' END as result,
        CASE WHEN m.away_score > m.home_score THEN 3 WHEN m.away_score = m.home_score THEN 1 ELSE 0 END as points
    FROM matches m
    WHERE m.season_id = 88529 AND m.status = 'played'
),
shots_agg AS (
    SELECT 
        ps.match_id,
        ps.is_home,
        count(*) as shots,
        sum(case when ps.shot_type IN ('goal', 'save') then 1 else 0 end) as shots_on_target,
        sum(coalesce(psx.calculated_xg, 0.0)) as xg
    FROM player_shots ps
    LEFT JOIN player_shots_xg psx ON ps.shot_id = psx.shot_id
    GROUP BY ps.match_id, ps.is_home
),
passes_agg AS (
    SELECT 
        pp.match_id,
        pms.team_id,
        count(*) as passes_total,
        sum(case when pp.is_successful = 1 then 1 else 0 end) as passes_completed,
        sum(case when pp.x_end >= 66.7 then 1 else 0 end) as final_third_passes,
        sum(case when pp.x_start <= 60.0 then 1 else 0 end) as passes_own_half
    FROM player_passes pp
    JOIN player_match_stats pms ON pp.match_id = pms.match_id AND pp.player_id = pms.player_id
    GROUP BY pp.match_id, pms.team_id
),
def_agg AS (
    SELECT 
        pda.match_id,
        pms.team_id,
        sum(case when pda.x >= 40.0 then 1 else 0 end) as def_actions_high
    FROM player_defensive_actions pda
    JOIN player_match_stats pms ON pda.match_id = pms.match_id AND pda.player_id = pms.player_id
    GROUP BY pda.match_id, pms.team_id
)
INSERT INTO team_match_metrics (
    match_id, season_id, tournament, match_date, round, team_id, opponent_team_id,
    is_home, goals_for, goals_against, result, points,
    shots_for, shots_against, shots_on_target_for, shots_on_target_against,
    xg_for, xg_against,
    passes_total, passes_completed, opp_passes_total, opp_passes_completed,
    final_third_passes_for, final_third_passes_against,
    defensive_actions_high, opp_passes_own_half
)
SELECT 
    ms.match_id, ms.season_id, ms.tournament, ms.match_date, ms.round, ms.team_id, ms.opponent_team_id,
    ms.is_home, ms.goals_for, ms.goals_against, ms.result, ms.points,
    coalesce(s_for.shots, 0), coalesce(s_against.shots, 0),
    coalesce(s_for.shots_on_target, 0), coalesce(s_against.shots_on_target, 0),
    coalesce(s_for.xg, 0.0), coalesce(s_against.xg, 0.0),
    coalesce(p_for.passes_total, 0), coalesce(p_for.passes_completed, 0),
    coalesce(p_against.passes_total, 0), coalesce(p_against.passes_completed, 0),
    coalesce(p_for.final_third_passes, 0), coalesce(p_against.final_third_passes, 0),
    coalesce(d_for.def_actions_high, 0), coalesce(p_against.passes_own_half, 0)
FROM match_sides ms
LEFT JOIN shots_agg s_for ON ms.match_id = s_for.match_id AND ms.is_home = s_for.is_home
LEFT JOIN shots_agg s_against ON ms.match_id = s_against.match_id AND ms.is_home != s_against.is_home
LEFT JOIN passes_agg p_for ON ms.match_id = p_for.match_id AND ms.team_id = p_for.team_id
LEFT JOIN passes_agg p_against ON ms.match_id = p_against.match_id AND ms.opponent_team_id = p_against.team_id
LEFT JOIN def_agg d_for ON ms.match_id = d_for.match_id AND ms.team_id = d_for.team_id;

CREATE INDEX IF NOT EXISTS idx_tmm_team_tourn ON team_match_metrics(team_id, tournament);
CREATE INDEX IF NOT EXISTS idx_tmm_season ON team_match_metrics(season_id);
CREATE INDEX IF NOT EXISTS idx_tmm_match ON team_match_metrics(match_id);

-- Master View: Aggregated Team Metrics across the season
DROP VIEW IF EXISTS vw_team_metrics;

CREATE VIEW vw_team_metrics AS
SELECT 
    t.team_id,
    t.name,
    t.short_name,
    t.primary_color,
    t.logo_url,
    COUNT(tmm.match_id) as matches_played,
    SUM(CASE WHEN tmm.result = 'W' THEN 1 ELSE 0 END) as wins,
    SUM(CASE WHEN tmm.result = 'D' THEN 1 ELSE 0 END) as draws,
    SUM(CASE WHEN tmm.result = 'L' THEN 1 ELSE 0 END) as losses,
    SUM(tmm.points) as points,
    ROUND(CAST(SUM(tmm.points) AS FLOAT) / COUNT(tmm.match_id), 2) as points_per_match,
    SUM(tmm.goals_for) as goals_scored,
    SUM(tmm.goals_against) as goals_conceded,
    SUM(tmm.goals_for) - SUM(tmm.goals_against) as goal_difference,
    SUM(tmm.shots_for) as total_shots,
    SUM(tmm.shots_on_target_for) as shots_on_target,
    ROUND(SUM(tmm.xg_for), 2) as xg,
    ROUND(SUM(tmm.xg_for) / CAST(SUM(tmm.shots_for) AS FLOAT), 3) as xg_per_shot,
    ROUND(SUM(tmm.xg_against), 2) as xga,
    ROUND(SUM(tmm.xg_for) - SUM(tmm.xg_against), 2) as xgd,
    ROUND(SUM(tmm.xg_for) / COUNT(tmm.match_id), 2) as xg_per_match,
    ROUND(SUM(tmm.xg_against) / COUNT(tmm.match_id), 2) as xga_per_match,
    SUM(tmm.passes_completed) as passes_completed,
    SUM(tmm.passes_total) as passes_total,
    ROUND((CAST(SUM(tmm.passes_completed) AS FLOAT) / NULLIF(SUM(tmm.passes_total), 0)) * 100, 1) as pass_accuracy_pct,
    ROUND((CAST(SUM(tmm.passes_completed) AS FLOAT) / NULLIF(SUM(tmm.passes_completed) + SUM(tmm.opp_passes_completed), 0)) * 100, 1) as possession_pct,
    ROUND((CAST(SUM(tmm.final_third_passes_for) AS FLOAT) / NULLIF(SUM(tmm.final_third_passes_for) + SUM(tmm.final_third_passes_against), 0)) * 100, 1) as field_tilt_pct,
    ROUND(CAST(SUM(tmm.opp_passes_own_half) AS FLOAT) / NULLIF(SUM(tmm.defensive_actions_high), 0), 2) as ppda,
    ROUND(CAST(SUM(tmm.shots_against) AS FLOAT) / NULLIF(SUM(tmm.goals_against), 0), 2) as defensive_resistance_ratio,
    ROUND(CAST(SUM(tmm.shots_for) AS FLOAT) / NULLIF(SUM(tmm.goals_for), 0), 2) as conversion_ratio
FROM teams t
JOIN team_match_metrics tmm ON t.team_id = tmm.team_id
GROUP BY t.team_id, t.name, t.short_name, t.primary_color, t.logo_url
ORDER BY points DESC, goal_difference DESC;
