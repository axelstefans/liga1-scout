import sqlite3
import pandas as pd
import numpy as np
from scipy.stats import poisson

def obtener_metricas_equipo(conn, team_name, is_home):
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

def calculate_match_odds(db_conn, home_team: str, away_team: str) -> dict:
    """Calculates Match Odds using Poisson Distribution and outputs a structured dictionary."""
    local_stats = obtener_metricas_equipo(db_conn, home_team, is_home=True)
    visita_stats = obtener_metricas_equipo(db_conn, away_team, is_home=False)

    if pd.isna(local_stats['xGF']) or pd.isna(visita_stats['xGF']):
        raise ValueError(f"No se encontraron datos para uno de los equipos: {home_team} o {away_team}.")

    # 2. Calcular los Goles Esperados para este partido específico
    xg_local = (local_stats['xGF'] + visita_stats['xGA']) / 2
    xg_visita = (visita_stats['xGF'] + local_stats['xGA']) / 2

    # 3. Matriz de Poisson (Simulando marcadores del 0 al 5)
    max_goles = 6
    prob_matrix = np.zeros((max_goles, max_goles))
    
    for i in range(max_goles):
        for j in range(max_goles):
            prob_matrix[i][j] = poisson.pmf(i, xg_local) * poisson.pmf(j, xg_visita)

    # 4. Sumar probabilidades para los Mercados
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

    # 5. Convertir a Cuotas Justas (Decimales)
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
