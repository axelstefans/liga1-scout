import sqlite3

# 1. Configura el nombre de tu base de datos
db_name = "liga1.db" # <-- ¡Reemplaza esto!

try:
    # Nos conectamos a la base de datos
    conn = sqlite3.connect(db_name)
    cursor = conn.cursor()

    # 2. Borramos la vista si ya existe (para evitar errores si corres el script varias veces)
    cursor.execute("DROP VIEW IF EXISTS vw_fuerza_ataque_xg90;")

    # 3. Creamos la Vista SQL de Fuerza de Ataque
# 3. Creamos la Vista SQL de Fuerza de Ataque
    sql_crear_vista = """
    CREATE VIEW vw_fuerza_ataque_xg90 AS
    SELECT 
        p.name AS player_name,
        t.name AS team_name,
        SUM(s.minutes_played) AS total_minutes,
        ROUND(SUM(COALESCE(s.expected_goals, 0.0)), 2) AS total_xg,
        ROUND((SUM(COALESCE(s.expected_goals, 0.0)) / CAST(SUM(s.minutes_played) AS FLOAT)) * 90, 2) AS xG90
    FROM 
        player_match_stats s
    JOIN 
        players p ON s.player_id = p.player_id
    JOIN 
        teams t ON p.team_id = t.team_id
    WHERE 
        s.minutes_played > 0
    GROUP BY 
        p.player_id, 
        p.name, 
        t.name
    HAVING 
        SUM(s.minutes_played) >= 270
    ORDER BY 
        xG90 DESC;
    """

    cursor.execute(sql_crear_vista)
    conn.commit()

    # 4. Consultamos el Top 15 de jugadores
    cursor.execute("SELECT * FROM vw_fuerza_ataque_xg90 LIMIT 15;")
    resultados = cursor.fetchall()

    # 5. Imprimimos los resultados en una tabla bonita en tu consola
    print("\n" + "="*80)
    print(f"{' TOP 15: FUERZA DE ATAQUE (xG90) - LIGA 1 ':^80}")
    print("="*80)
    print(f"{'Jugador':<28} | {'Equipo':<20} | {'Minutos':<7} | {'Total xG':<8} | {'xG90':<5}")
    print("-" * 80)
    
    for fila in resultados:
        # fila[0]=Nombre, fila[1]=Equipo, fila[2]=Minutos, fila[3]=Total xG, fila[4]=xG90
        print(f"{fila[0]:<28} | {fila[1]:<20} | {fila[2]:<7} | {fila[3]:<8} | {fila[4]:<5}")
    
    print("="*80 + "\n")

except sqlite3.Error as e:
    print(f"Error al conectar con la base de datos: {e}")
finally:
    if conn:
        conn.close()