import sqlite3
import pandas as pd

def main():
    conn = sqlite3.connect('liga1.db')

    # CTE Base: Limpieza de datos y cálculo de xG por equipo en cada partido
    base_sql = """
    WITH CleanStats AS (
        SELECT match_id, player_id, MAX(COALESCE(expected_goals, 0)) AS xG
        FROM player_match_stats
        GROUP BY match_id, player_id
    ),
    PlayerCounts AS (
        SELECT c.match_id, p.team_id, COUNT(c.player_id) as num_players
        FROM CleanStats c
        JOIN players p ON c.player_id = p.player_id
        GROUP BY c.match_id, p.team_id
    ),
    ValidMatchTeams AS (
        SELECT match_id, team_id
        FROM PlayerCounts
        WHERE num_players >= 10
    ),
    MatchTeam_xG AS (
        SELECT v.match_id, v.team_id, SUM(c.xG) AS team_xg
        FROM ValidMatchTeams v
        JOIN players p ON v.team_id = p.team_id
        JOIN CleanStats c ON p.player_id = c.player_id AND v.match_id = c.match_id
        GROUP BY v.match_id, v.team_id
    ),
    MatchContext AS (
        SELECT 
            m.match_id, m.match_date, m.home_team_id, m.away_team_id,
            th.team_xg AS home_xGF, ta.team_xg AS away_xGF
        FROM matches m
        JOIN MatchTeam_xG th ON m.match_id = th.match_id AND m.home_team_id = th.team_id
        JOIN MatchTeam_xG ta ON m.match_id = ta.match_id AND m.away_team_id = ta.team_id
    )
    """

    # 1. Fuerza de Local
    sql_local = base_sql + """
    SELECT 
        t.name AS Equipo,
        COUNT(mc.match_id) AS Partidos_Local,
        ROUND(AVG(mc.home_xGF), 2) AS xGF90,
        ROUND(AVG(mc.away_xGF), 2) AS xGA90,
        ROUND(AVG(mc.home_xGF) - AVG(mc.away_xGF), 2) AS Diferencia
    FROM MatchContext mc
    JOIN teams t ON mc.home_team_id = t.team_id
    GROUP BY t.team_id, t.name
    ORDER BY Diferencia DESC;
    """

    # 2. Fuerza de Visitante
    sql_visita = base_sql + """
    SELECT 
        t.name AS Equipo,
        COUNT(mc.match_id) AS Partidos_Visita,
        ROUND(AVG(mc.away_xGF), 2) AS xGF90,
        ROUND(AVG(mc.home_xGF), 2) AS xGA90,
        ROUND(AVG(mc.away_xGF) - AVG(mc.home_xGF), 2) AS Diferencia
    FROM MatchContext mc
    JOIN teams t ON mc.away_team_id = t.team_id
    GROUP BY t.team_id, t.name
    ORDER BY Diferencia DESC;
    """

    # 3. Termómetro de Forma (Últimos 5 partidos)
    sql_racha = base_sql + """
    , TeamMatches AS (
        SELECT home_team_id AS team_id, match_date, home_xGF AS xGF, away_xGF AS xGA
        FROM MatchContext
        UNION ALL
        SELECT away_team_id AS team_id, match_date, away_xGF AS xGF, home_xGF AS xGA
        FROM MatchContext
    ),
    RankedMatches AS (
        SELECT 
            team_id, xGF, xGA,
            ROW_NUMBER() OVER(PARTITION BY team_id ORDER BY match_date DESC) as rn
        FROM TeamMatches
    )
    SELECT 
        t.name AS Equipo,
        ROUND(AVG(rm.xGF), 2) AS xGF90_Racha,
        ROUND(AVG(rm.xGA), 2) AS xGA90_Racha,
        ROUND(AVG(rm.xGF) - AVG(rm.xGA), 2) AS Diferencia
    FROM RankedMatches rm
    JOIN teams t ON rm.team_id = t.team_id
    WHERE rm.rn <= 5
    GROUP BY t.team_id, t.name
    ORDER BY Diferencia DESC;
    """

    print("\n" + "="*70)
    print("  FORTALEZA DE LOCAL (xG en su Estadio)")
    print("="*70)
    print(pd.read_sql_query(sql_local, conn).to_string(index=False))

    print("\n" + "="*70)
    print("  FORTALEZA DE VISITANTE (xG Fuera de Casa)")
    print("="*70)
    print(pd.read_sql_query(sql_visita, conn).to_string(index=False))

    print("\n" + "="*70)
    print("  TERMÓMETRO DE FORMA (Últimos 5 Partidos Jugados)")
    print("="*70)
    print(pd.read_sql_query(sql_racha, conn).to_string(index=False))
    print("="*70 + "\n")

    conn.close()

if __name__ == '__main__':
    main()