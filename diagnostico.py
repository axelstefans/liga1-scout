import sqlite3

# Conectamos a la base de datos
conn = sqlite3.connect("liga1.db")
cursor = conn.cursor()

print("\n" + "="*50)
print("   DIAGNÓSTICO DEL PARTIDO 16281113")
print("="*50)

# 1. ¿Existe el partido en la lista general?
cursor.execute("SELECT status FROM matches WHERE match_id = 16281113;")
partido = cursor.fetchone()
if partido:
    print(f"[1] Partido en BD: SÍ (Estado: {partido[0]})")
else:
    print("[1] Partido en BD: NO EXISTE")

# 2. ¿Se descargaron las estadísticas de los jugadores?
cursor.execute("SELECT COUNT(*) FROM player_match_stats WHERE match_id = 16281113;")
stats = cursor.fetchone()[0]
if stats > 0:
    print(f"[2] Estadísticas (minutos) descargadas: SÍ ({stats} jugadores)")
else:
    print("[2] Estadísticas (minutos) descargadas: NO (Cero registros)")

# 3. ¿Se descargaron los tiros de este partido?
cursor.execute("SELECT COUNT(*) FROM player_shots WHERE match_id = 16281113;")
tiros = cursor.fetchone()[0]
if tiros > 0:
    print(f"[3] Tiros descargados: SÍ ({tiros} tiros en total)")
else:
    print("[3] Tiros descargados: NO")

# 4. ¿Qué datos hay de Facundo Callejo en este partido?
cursor.execute("""
    SELECT p.name, s.minutes_played, s.expected_goals 
    FROM player_match_stats s
    JOIN players p ON s.player_id = p.player_id
    WHERE s.match_id = 16281113 AND p.name LIKE '%Callejo%'
""")
callejo_stats = cursor.fetchone()

print("-" * 50)
if callejo_stats:
    print(f"Datos de {callejo_stats[0]} en este partido:")
    print(f" -> Minutos jugados: {callejo_stats[1]}")
    print(f" -> Goles esperados (xG): {callejo_stats[2]}")
else:
    print("ALERTA: Facundo Callejo NO tiene registro en este partido.")

print("="*50 + "\n")
conn.close()