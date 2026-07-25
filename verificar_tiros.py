import sqlite3

# Nos conectamos a tu base de datos
conn = sqlite3.connect("liga1.db")
cursor = conn.cursor()

# Buscamos todos los partidos de Callejo, sus minutos y cuántos tiros hizo en cada uno
sql = """
SELECT 
    s.match_id,
    s.minutes_played,
    (SELECT COUNT(*) FROM player_shots ps WHERE ps.player_id = s.player_id AND ps.match_id = s.match_id) as cantidad_tiros,
    s.expected_goals
FROM 
    player_match_stats s
JOIN 
    players p ON s.player_id = p.player_id
WHERE 
    p.name LIKE '%Callejo%' AND s.minutes_played > 0
ORDER BY 
    cantidad_tiros ASC, s.minutes_played DESC;
"""

cursor.execute(sql)
resultados = cursor.fetchall()

print("\n" + "="*60)
print(f"{' HISTORIAL DE PARTIDOS DE FACUNDO CALLEJO (2026) ':^60}")
print("="*60)
print(f"{'ID Partido':<12} | {'Minutos':<9} | {'Tiros':<7} | {'xG en Base de Datos'}")
print("-" * 60)

partidos_sin_tiros = 0
minutos_perdidos = 0

for fila in resultados:
    match_id = str(fila[0])
    minutos = fila[1]
    tiros = fila[2]
    xg = str(fila[3]) if fila[3] is not None else "NULL (Vacío)"
    
    if tiros == 0:
        partidos_sin_tiros += 1
        minutos_perdidos += minutos
        print(f"{match_id:<12} | {minutos:<9} | {tiros:<7} | {xg} <-- ¡AQUÍ ESTÁ LA FUGA!")
    else:
        print(f"{match_id:<12} | {minutos:<9} | {tiros:<7} | {xg}")

print("-" * 60)
print(f"RESUMEN:")
print(f"- Partidos sin disparar: {partidos_sin_tiros}")
print(f"- Minutos invisibles por el error NULL: {minutos_perdidos} minutos")
print("="*60 + "\n")

conn.close()