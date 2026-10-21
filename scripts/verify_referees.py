import sqlite3
import pandas as pd

conn = sqlite3.connect("liga1.db")

# 1. Total referees
total_refs = conn.execute("SELECT COUNT(*) FROM referees").fetchone()[0]

# 2. Percentage of 2026 matches assigned
total_2026 = conn.execute("SELECT COUNT(*) FROM matches WHERE season_id = 88529 AND status = 'played'").fetchone()[0]
assigned_2026 = conn.execute("SELECT COUNT(*) FROM matches WHERE season_id = 88529 AND status = 'played' AND referee_id IS NOT NULL").fetchone()[0]
pct_2026 = (assigned_2026 / total_2026 * 100) if total_2026 else 0

print("=== AUDITORIA FASE 1: MONITOR ARBITRAL ===")
print(f"Total arbitros registrados en referees: {total_refs}")
print(f"Partidos 2026 jugados con arbitro asignado: {assigned_2026}/{total_2026} ({pct_2026:.1f}%)\n")

# 3. Top referees ordered by matches directed, showing local disciplinary stats
query = """
WITH match_penalties AS (
    SELECT match_id, COUNT(*) AS penalties_awarded
    FROM player_shots
    WHERE situation = 'penalty'
    GROUP BY match_id
),
match_cards AS (
    SELECT 
        match_id,
        SUM(COALESCE(yellow_cards, 0)) AS yellows,
        SUM(COALESCE(red_cards, 0)) AS reds,
        SUM(COALESCE(fouls, 0)) AS fouls
    FROM match_period_stats
    WHERE period = 'ALL'
    GROUP BY match_id
)
SELECT 
    r.referee_id,
    r.name AS referee,
    COUNT(m.match_id) AS matches_directed,
    COALESCE(SUM(mc.yellows), 0) AS total_yellows,
    ROUND(CAST(COALESCE(SUM(mc.yellows), 0) AS FLOAT) / COUNT(m.match_id), 2) AS yellows_p90,
    COALESCE(SUM(mc.reds), 0) AS total_reds,
    ROUND(CAST(COALESCE(SUM(mc.reds), 0) AS FLOAT) / COUNT(m.match_id), 2) AS reds_p90,
    COALESCE(SUM(mp.penalties_awarded), 0) AS total_penalties,
    ROUND(CAST(COALESCE(SUM(mp.penalties_awarded), 0) AS FLOAT) / COUNT(m.match_id), 2) AS pens_p90,
    ROUND(CAST(COALESCE(SUM(mc.fouls), 0) AS FLOAT) / COUNT(m.match_id), 2) AS fouls_p90
FROM referees r
JOIN matches m ON r.referee_id = m.referee_id
LEFT JOIN match_cards mc ON m.match_id = mc.match_id
LEFT JOIN match_penalties mp ON m.match_id = mp.match_id
WHERE m.season_id = 88529
GROUP BY r.referee_id, r.name
ORDER BY matches_directed DESC, total_yellows DESC
LIMIT 10;
"""

df = pd.read_sql_query(query, conn)
print(df.to_string(index=False))
