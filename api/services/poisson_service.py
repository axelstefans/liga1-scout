import sqlite3
import pandas as pd
import numpy as np
from scipy.stats import poisson
import joblib

# Cache the model so we don't load it on every request
_xg_model = None

def get_xg_model():
    global _xg_model
    if _xg_model is None:
        _xg_model = joblib.load('xg_model_pipeline.pkl')
    return _xg_model

def group_situation(sit):
    if sit == 'fast-break': return 'regular'
    elif sit == 'throw-in-set-piece': return 'set-piece'
    return sit

def get_dynamic_scaling_factor(conn, df_xg: pd.DataFrame) -> float:
    """
    Computes a dynamic scaling factor to compensate for incomplete shot capture in the 
    underlying spatial data (e.g. missing off-target or blocked shots from SofaScore).
    This compares total actual goals scored against total raw xG in matches where both exist.
    This factor self-updates and should be recalculated periodically (e.g. as new matches accumulate)
    to prevent the expected goals from being artificially lower than real match scoring rates.
    """
    if df_xg.empty:
        return 1.0
        
    query = """
        SELECT match_id, home_score, away_score
        FROM matches
        WHERE home_score IS NOT NULL AND away_score IS NOT NULL
    """
    matches_db = pd.read_sql_query(query, conn)
    
    valid_match_ids = df_xg['match_id'].unique()
    matches_db = matches_db[matches_db['match_id'].isin(valid_match_ids)]
    
    if matches_db.empty:
        return 1.0
        
    df_filtered = df_xg[df_xg['match_id'].isin(matches_db['match_id'])]
    
    total_actual_goals = matches_db['home_score'].sum() + matches_db['away_score'].sum()
    total_xg = df_filtered['calculated_xg'].sum()
    
    if total_xg > 0:
        return float(total_actual_goals / total_xg)
    return 1.0

def get_team_match_xg(conn, match_id: int, team_id: int) -> float:
    """Computes team-level expected goals directly from player_shots for a given match."""
    query = """
        SELECT s.is_home, s.distance_m, s.angle_rad, s.body_part, s.situation,
               m.home_team_id, m.away_team_id, s.match_id
        FROM player_shots s
        JOIN matches m ON s.match_id = m.match_id
        WHERE s.match_id = ?
    """
    df = pd.read_sql_query(query, conn, params=(match_id,))
    if df.empty:
        return 0.0
        
    df['team_id'] = df.apply(lambda row: row['home_team_id'] if row['is_home'] == 1 else row['away_team_id'], axis=1)
    team_df = df[df['team_id'] == team_id].copy()
    
    if team_df.empty:
        return 0.0
        
    team_df['situation_grouped'] = team_df['situation'].apply(group_situation)
    team_df['calculated_xg'] = 0.0
    
    non_penalty_mask = team_df['situation'] != 'penalty'
    if non_penalty_mask.any():
        model = get_xg_model()
        X_pred = team_df.loc[non_penalty_mask, ['distance_m', 'angle_rad', 'body_part', 'situation_grouped']]
        team_df.loc[non_penalty_mask, 'calculated_xg'] = model.predict_proba(X_pred)[:, 1]
        
    team_df.loc[~non_penalty_mask, 'calculated_xg'] = 0.79
    
    # We apply the global scaling factor
    # For a single match call, we need all shots to compute scaling correctly, 
    # but pulling all shots here is slow. If this function is needed individually,
    # we should fetch the global factor. For simplicity in this demo function,
    # we'll compute it if needed, or you could cache it.
    query_all = "SELECT s.match_id, s.is_home, s.distance_m, s.angle_rad, s.body_part, s.situation FROM player_shots s"
    df_all = pd.read_sql_query(query_all, conn)
    if not df_all.empty:
        df_all['situation_grouped'] = df_all['situation'].apply(group_situation)
        df_all['calculated_xg'] = 0.0
        nm = df_all['situation'] != 'penalty'
        if nm.any():
            df_all.loc[nm, 'calculated_xg'] = get_xg_model().predict_proba(df_all.loc[nm, ['distance_m', 'angle_rad', 'body_part', 'situation_grouped']])[:, 1]
        df_all.loc[~nm, 'calculated_xg'] = 0.79
        scaling_factor = get_dynamic_scaling_factor(conn, df_all)
        team_df['calculated_xg'] = team_df['calculated_xg'] * scaling_factor
        
    return float(team_df['calculated_xg'].sum())

def _get_all_matches_xg(conn) -> pd.DataFrame:
    query = """
        SELECT s.match_id, s.is_home, s.distance_m, s.angle_rad, s.body_part, s.situation,
               m.home_team_id, m.away_team_id, m.match_date
        FROM player_shots s
        JOIN matches m ON s.match_id = m.match_id
    """
    df = pd.read_sql_query(query, conn)
    if df.empty:
        return pd.DataFrame()
        
    df['situation_grouped'] = df['situation'].apply(group_situation)
    df['calculated_xg'] = 0.0
    
    non_penalty_mask = df['situation'] != 'penalty'
    if non_penalty_mask.any():
        model = get_xg_model()
        X_pred = df.loc[non_penalty_mask, ['distance_m', 'angle_rad', 'body_part', 'situation_grouped']]
        df.loc[non_penalty_mask, 'calculated_xg'] = model.predict_proba(X_pred)[:, 1]
        
    df.loc[~non_penalty_mask, 'calculated_xg'] = 0.79
    
    # Scale before aggregating
    scaling_factor = get_dynamic_scaling_factor(conn, df)
    df['calculated_xg'] = df['calculated_xg'] * scaling_factor
    
    df['team_id'] = df.apply(lambda row: row['home_team_id'] if row['is_home'] == 1 else row['away_team_id'], axis=1)
    
    grouped = df.groupby(['match_id', 'team_id', 'is_home']).agg(
        team_xg=('calculated_xg', 'sum'),
        home_team_id=('home_team_id', 'first'),
        away_team_id=('away_team_id', 'first'),
        match_date=('match_date', 'first')
    ).reset_index()
    
    home_df = grouped[grouped['is_home'] == 1][['match_id', 'match_date', 'team_id', 'team_xg']].rename(
        columns={'team_id': 'home_team_id', 'team_xg': 'home_xg'}
    )
    away_df = grouped[grouped['is_home'] == 0][['match_id', 'team_id', 'team_xg']].rename(
        columns={'team_id': 'away_team_id', 'team_xg': 'away_xg'}
    )
    matches_df = pd.merge(home_df, away_df, on='match_id', how='inner')
    return matches_df

def get_league_baselines(matches_df):
    if matches_df.empty:
        return 1.0, 1.0
    return matches_df['home_xg'].mean(), matches_df['away_xg'].mean()

def get_historical_team_metrics(matches_df, team_id: int):
    home_games = matches_df[matches_df['home_team_id'] == team_id]
    away_games = matches_df[matches_df['away_team_id'] == team_id]
    
    total_matches = len(home_games) + len(away_games)
    if total_matches == 0:
        return {'xGF_home': 0.0, 'xGA_home': 0.0, 'xGF_away': 0.0, 'xGA_away': 0.0, 'overall_xGF': 0.0, 'overall_xGA': 0.0}
        
    overall_xgf = (home_games['home_xg'].sum() + away_games['away_xg'].sum()) / total_matches
    overall_xga = (home_games['away_xg'].sum() + away_games['home_xg'].sum()) / total_matches
    
    return {
        'xGF_home': home_games['home_xg'].mean() if len(home_games) > 0 else overall_xgf,
        'xGA_home': home_games['away_xg'].mean() if len(home_games) > 0 else overall_xga,
        'xGF_away': away_games['away_xg'].mean() if len(away_games) > 0 else overall_xgf,
        'xGA_away': away_games['home_xg'].mean() if len(away_games) > 0 else overall_xga,
        'overall_xGF': overall_xgf,
        'overall_xGA': overall_xga
    }

def get_output_calibration_factor(conn, matches_df) -> float:
    """
    Computes an output-level calibration factor to correct for the structural upward bias 
    introduced by the multiplicative attack x defense formula.
    Distinct from the shot-volume correction (which fixes input data), this factor ensures 
    the final projected total goals (lambda_home + lambda_away) average out to the real 
    average total goals per match for the current season.
    Should be recalculated periodically as data accumulates.
    """
    query = """
        SELECT home_team_id, away_team_id, home_score, away_score
        FROM matches
        WHERE season_id = 88529 AND home_score IS NOT NULL AND away_score IS NOT NULL
    """
    real_matches = pd.read_sql_query(query, conn)
    if real_matches.empty:
        return 1.0
        
    real_avg_goals = (real_matches['home_score'].sum() + real_matches['away_score'].sum()) / len(real_matches)
    
    league_avg_home_xg, league_avg_away_xg = get_league_baselines(matches_df)
    league_avg_overall = (league_avg_home_xg + league_avg_away_xg) / 2
    if league_avg_overall == 0:
        return 1.0
        
    team_metrics = {}
    for team_id in pd.concat([real_matches['home_team_id'], real_matches['away_team_id']]).unique():
        team_metrics[team_id] = get_historical_team_metrics(matches_df, team_id)
        
    model_total_goals = 0
    for _, row in real_matches.iterrows():
        h_stats = team_metrics[row['home_team_id']]
        a_stats = team_metrics[row['away_team_id']]
        
        atk_home = h_stats['overall_xGF'] / league_avg_overall
        def_home = h_stats['overall_xGA'] / league_avg_overall
        atk_away = a_stats['overall_xGF'] / league_avg_overall
        def_away = a_stats['overall_xGA'] / league_avg_overall
        
        lambda_home = atk_home * def_away * league_avg_home_xg
        lambda_away = atk_away * def_home * league_avg_away_xg
        
        model_total_goals += (lambda_home + lambda_away)
        
    model_avg_goals = model_total_goals / len(real_matches)
    
    if model_avg_goals > 0:
        return float(real_avg_goals / model_avg_goals)
    return 1.0

def _legacy_obtener_metricas_equipo(conn, team_name, is_home):
    """Extrae las métricas del equipo desde la base de datos (Local o Visitante)"""
    columna_xGF = "home_xGF" if is_home else "away_xGF"
    columna_xGA = "away_xGF" if is_home else "home_xGF"
    team_id_col = "home_team_id" if is_home else "away_team_id"
    
    query = f"""
    WITH CleanStats AS (
        SELECT match_id, player_id, MAX(COALESCE(expected_goals, 0)) AS xG
        FROM player_match_stats GROUP BY match_id, player_id
    ),
    PlayerCounts AS (
        SELECT c.match_id, p.team_id, COUNT(c.player_id) as num_players
        FROM CleanStats c JOIN players p ON c.player_id = p.player_id GROUP BY c.match_id, p.team_id
    ),
    ValidMatchTeams AS (
        SELECT match_id, team_id FROM PlayerCounts WHERE num_players >= 10
    ),
    MatchTeam_xG AS (
        SELECT v.match_id, v.team_id, SUM(c.xG) AS team_xg
        FROM ValidMatchTeams v JOIN players p ON v.team_id = p.team_id
        JOIN CleanStats c ON p.player_id = c.player_id AND v.match_id = c.match_id
        GROUP BY v.match_id, v.team_id
    )
    SELECT 
        AVG(t1.team_xg) AS xGF,
        AVG(t2.team_xg) AS xGA
    FROM matches m
    JOIN MatchTeam_xG t1 ON m.match_id = t1.match_id AND m.{team_id_col} = t1.team_id
    JOIN MatchTeam_xG t2 ON m.match_id = t2.match_id AND m.{'away_team_id' if is_home else 'home_team_id'} = t2.team_id
    JOIN teams t ON t1.team_id = t.team_id
    WHERE t.name LIKE '%{team_name}%'
    """
    return pd.read_sql_query(query, conn).iloc[0]

def calculate_match_odds(db_conn, home_team: str, away_team: str, home_custom_xg: float = None, away_custom_xg: float = None, target_date: str = None) -> dict:
    """Calculates Match Odds using Poisson Distribution and outputs a structured dictionary."""
    
    # 1. Resolve team IDs
    h_row = db_conn.execute("SELECT team_id FROM teams WHERE name LIKE ?", ('%' + home_team + '%',)).fetchone()
    a_row = db_conn.execute("SELECT team_id FROM teams WHERE name LIKE ?", ('%' + away_team + '%',)).fetchone()
    if not h_row or not a_row:
        raise ValueError(f"No se encontraron datos para uno de los equipos: {home_team} o {away_team}.")
    
    home_team_id = h_row[0]
    away_team_id = a_row[0]

    # 2. Get baseline metrics using bypass method
    matches_df = _get_all_matches_xg(db_conn)
    if target_date is not None:
        matches_df = matches_df[matches_df['match_date'] < target_date]
        
    league_avg_home_xg, league_avg_away_xg = get_league_baselines(matches_df)
    league_avg_overall = (league_avg_home_xg + league_avg_away_xg) / 2
    if league_avg_overall == 0: league_avg_overall = 1.0

    h_stats = get_historical_team_metrics(matches_df, home_team_id)
    a_stats = get_historical_team_metrics(matches_df, away_team_id)

    # 3. Calculate multiplicative lambdas
    # Using overall attack/defense strength fallback to avoid small sample size issues
    atk_home = h_stats['overall_xGF'] / league_avg_overall
    def_home = h_stats['overall_xGA'] / league_avg_overall
    
    atk_away = a_stats['overall_xGF'] / league_avg_overall
    def_away = a_stats['overall_xGA'] / league_avg_overall
    
    db_xg_local = atk_home * def_away * league_avg_home_xg
    db_xg_visita = atk_away * def_home * league_avg_away_xg

    TACTICAL_NORMALIZATION = 0.60

    # Custom override logic (preserved from legacy)
    if home_custom_xg is not None:
        normalized_home_xg = home_custom_xg * TACTICAL_NORMALIZATION
        xg_local = normalized_home_xg * h_stats['overall_xGA'] * h_stats['overall_xGF']
    else:
        xg_local = db_xg_local

    if away_custom_xg is not None:
        normalized_away_xg = away_custom_xg * TACTICAL_NORMALIZATION
        xg_visita = normalized_away_xg * h_stats['overall_xGA']
    else:
        xg_visita = db_xg_visita

    # Apply output calibration factor to final lambdas
    # (Disabled: Backtest showed this flat output multiplier harms Brier score. 
    # V4 validation scored 0.2222 on Home Win without it. Kept for reference only.)
    # output_calibration = get_output_calibration_factor(db_conn, matches_df)
    # xg_local *= output_calibration
    # xg_visita *= output_calibration

    # 4. Poisson Matrix
    max_goles = 6
    prob_matrix = np.zeros((max_goles, max_goles))
    
    for i in range(max_goles):
        for j in range(max_goles):
            prob_matrix[i][j] = poisson.pmf(i, xg_local) * poisson.pmf(j, xg_visita)

    prob_local = np.sum(np.tril(prob_matrix, -1))
    prob_empate = np.sum(np.diag(prob_matrix))
    prob_visita = np.sum(np.triu(prob_matrix, 1))
    
    prob_over_25 = 0
    prob_under_25 = 0
    for i in range(max_goles):
        for j in range(max_goles):
            if (i + j) > 2.5:
                prob_over_25 += prob_matrix[i][j]
            else:
                prob_under_25 += prob_matrix[i][j]

    # 5. Convert to Decimal Odds
    cuota_local = 1 / prob_local if prob_local > 0 else 0
    cuota_empate = 1 / prob_empate if prob_empate > 0 else 0
    cuota_visita = 1 / prob_visita if prob_visita > 0 else 0
    cuota_over = 1 / prob_over_25 if prob_over_25 > 0 else 0
    cuota_under = 1 / prob_under_25 if prob_under_25 > 0 else 0

    return {
        "projected_goals": {
            "home": round(float(xg_local), 2),
            "away": round(float(xg_visita), 2)
        },
        "match_winner_odds": {
            "home": round(float(cuota_local), 2),
            "draw": round(float(cuota_empate), 2),
            "away": round(float(cuota_visita), 2)
        },
        "over_under_25_odds": {
            "over": round(float(cuota_over), 2),
            "under": round(float(cuota_under), 2)
        },
        "probabilities_percent": {
            "home": round(float(prob_local * 100), 1),
            "draw": round(float(prob_empate * 100), 1),
            "away": round(float(prob_visita * 100), 1),
            "over_25": round(float(prob_over_25 * 100), 1),
            "under_25": round(float(prob_under_25 * 100), 1)
        }
    }

def get_team_prediction_roster(db_conn, team_name: str) -> list[dict]:
    query = """
        SELECT 
            MAX(p.player_id) AS player_id,
            p.name AS player_name,
            MAX(p.position) AS position,
            MAX(COALESCE(v.total_minutes, 0)) AS total_minutes,
            MAX(COALESCE(v.total_xg, 0.0)) AS total_xg,
            CASE 
                WHEN MAX(COALESCE(v.total_minutes, 0)) < 180 AND MAX(COALESCE(v.xG90, 0.0)) > 0.25 
                THEN 0.25 
                ELSE MAX(COALESCE(v.xG90, 0.0)) 
            END AS xg90
        FROM players p
        JOIN teams t ON p.team_id = t.team_id
        LEFT JOIN vw_fuerza_ataque_xg90 v ON p.name = v.player_name AND t.name = v.team_name
        WHERE t.name = ?
        GROUP BY p.name
        ORDER BY total_minutes DESC
    """
    rows = db_conn.execute(query, (team_name,)).fetchall()
    return [dict(row) for row in rows]
