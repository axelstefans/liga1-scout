import sqlite3
import pandas as pd

def main():
    conn = sqlite3.connect('liga1.db')

    # Consulta SQL Inteligente: Elimina clones y destruye la explosión cartesiana
    query = """
    WITH CleanStats AS (
        -- 1. Limpiamos datos duplicados causados por reinicios del scraper
        SELECT match_id, player_id, MAX(COALESCE(expected_goals, 0)) AS xG
        FROM player_match_stats
        GROUP BY match_id, player_id
    ),
    PlayerCounts AS (
        -- 2. Contamos cuántos jugadores aportó cada equipo al partido
        SELECT c.match_id, p.team_id, COUNT(c.player_id) as num_players
        FROM CleanStats c
        JOIN players p ON c.player_id = p.player_id
        GROUP BY c.match_id, p.team_id
    ),
    ValidMatchTeams AS (
        -- 3. FILTRO MAESTRO: Un equipo real usa al menos 10 jugadores. 
        -- Esto aniquila a los "equipos fantasma" de jugadores transferidos.
        SELECT match_id, team_id
        FROM PlayerCounts
        WHERE num_players >= 10
    ),
    MatchTeam_xG AS (
        -- 4. Sumamos el xG agrupando estrictamente a los 2 equipos reales
        SELECT 
            v.match_id,
            v.team_id,
            SUM(c.xG) AS team_xg
        FROM ValidMatchTeams v
        JOIN players p ON v.team_id = p.team_id
        JOIN CleanStats c ON p.player_id = c.player_id AND v.match_id = c.match_id
        GROUP BY v.match_id, v.team_id
    ),
    MatchRivals AS (
        -- 5. Cruzamos Fuerza Ofensiva (xGF) vs Fuerza Defensiva (xGA) sin multiplicarse
        SELECT 
            t1.match_id,
            t1.team_id,
            t1.team_xg AS xGF,
            t2.team_xg AS xGA
        FROM MatchTeam_xG t1
        JOIN MatchTeam_xG t2 ON t1.match_id = t2.match_id AND t1.team_id != t2.team_id
    )
    SELECT 
        t.name AS Equipo,
        COUNT(mr.match_id) AS Partidos,
        ROUND(SUM(mr.xGF) / COUNT(mr.match_id), 2) AS xGF90,
        ROUND(SUM(mr.xGA) / COUNT(mr.match_id), 2) AS xGA90,
        ROUND((SUM(mr.xGF) - SUM(mr.xGA)) / COUNT(mr.match_id), 2) AS Diferencia_xG
    FROM MatchRivals mr
    JOIN teams t ON mr.team_id = t.team_id
    GROUP BY t.team_id, t.name
    ORDER BY Diferencia_xG DESC;
    """

    df = pd.read_sql_query(query, conn)
    
    print("\n" + "="*80)
    print("   RANKING DE PODER (xG A FAVOR vs xG EN CONTRA) - LIGA 1 (2026)")
    print("="*80)
    print(df.to_string(index=False))
    print("="*80 + "\n")
    print("* xGF90 = Goles Esperados a Favor por partido (Poder Ofensivo)")
    print("* xGA90 = Goles Esperados en Contra por partido (Fragilidad Defensiva)\n")

    conn.close()

if __name__ == '__main__':
    main()