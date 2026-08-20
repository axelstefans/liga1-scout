import sqlite3
from typing import Optional, List, Dict, Any
import pandas as pd
import joblib

# Cargar el modelo xG globalmente al iniciar el repositorio
try:
    xg_model = joblib.load('xg_model_pipeline.pkl')
    print("✅ Modelo xG cargado correctamente en el repositorio.")
except Exception as e:
    print(f"⚠️ Advertencia: No se pudo cargar el modelo xG. Error: {e}")
    xg_model = None

def get_player_profile(db: sqlite3.Connection, player_id: int) -> Optional[Dict[str, Any]]:
    """Fetch base player profile including team and market value."""
    query = """
        SELECT
            p.player_id, p.name, p.date_of_birth, p.nationality,
            p.position, p.position_group, p.shirt_number, p.height, p.preferred_foot,
            t.team_id, t.name as team_name, t.short_name as team_short_name, t.logo_url as team_logo_url, t.primary_color as team_primary_color,
            pmv.market_value_eur, pmv.market_value_str
        FROM players p
        LEFT JOIN teams t ON p.team_id = t.team_id
        LEFT JOIN player_market_values pmv ON p.player_id = pmv.player_id
        WHERE p.player_id = ?
    """
    row = db.execute(query, (player_id,)).fetchone()
    if not row:
        return None

    data = dict(row)

    # Restructure into nested team object
    profile = {
        "player_id": data["player_id"],
        "name": data["name"],
        "date_of_birth": data["date_of_birth"],
        "nationality": data["nationality"],
        "position": data["position"],
        "position_group": data["position_group"],
        "shirt_number": data["shirt_number"],
        "height": data["height"],
        "preferred_foot": data["preferred_foot"],
        "market_value_eur": data["market_value_eur"],
        "market_value_str": data["market_value_str"]
    }

    if data["team_id"]:
        profile["team"] = {
            "team_id": data["team_id"],
            "name": data["team_name"],
            "short_name": data["team_short_name"],
            "logo_url": data["team_logo_url"],
            "primary_color": data["team_primary_color"]
        }

    return profile

def search_players(db: sqlite3.Connection, query: str) -> List[Dict[str, Any]]:
    """Search for players by name."""
    sql = """
        SELECT
            p.player_id, p.name, p.position_group,
            t.name as team_name, t.logo_url as team_logo_url
        FROM players p
        LEFT JOIN teams t ON p.team_id = t.team_id
        WHERE p.name LIKE ?
          AND p.team_id IN (
              SELECT home_team_id FROM matches WHERE season_id = (SELECT MAX(season_id) FROM matches)
              UNION
              SELECT away_team_id FROM matches WHERE season_id = (SELECT MAX(season_id) FROM matches)
          )
        ORDER BY p.name ASC
        LIMIT 20
    """
    rows = db.execute(sql, (f"%{query}%",)).fetchall()
    return [dict(row) for row in rows]

def get_player_season_stats(db: sqlite3.Connection, player_id: int) -> Optional[Dict[str, Any]]:
    """Fetch aggregate season stats for a player."""
    query = """
        SELECT *
        FROM player_season_stats
        WHERE player_id = ?
    """
    row = db.execute(query, (player_id,)).fetchone()
    return dict(row) if row else None

def get_player_match_stats(db: sqlite3.Connection, player_id: int) -> List[Dict[str, Any]]:
    """Fetch match-by-match stats for a player, including match details, opponent and W/D/L result."""
    query = """
        SELECT
            pms.match_id,
            m.match_date,
            m.round,
            CASE WHEN strftime('%m', m.match_date) >= '06' THEN 'Clausura' ELSE 'Apertura' END as tournament_name,
            pms.minutes_played,
            pms.position,
            pms.sofascore_rating,
            pms.goals,
            pms.assists,
            pms.shots_on_target,
            pms.key_passes,
            pms.accurate_passes_pct,
            -- Scores needed to compute result
            m.home_score,
            m.away_score,
            -- Determine if player's team was home (1=home, 0=away)
            CASE WHEN m.home_team_id = pms.team_id THEN 1 ELSE 0 END as is_home,
            -- Opponent name: whoever is NOT the player's team
            CASE WHEN m.home_team_id = pms.team_id THEN away_t.name     ELSE home_t.name     END as opponent_name,
            -- Opponent logo: same logic
            CASE WHEN m.home_team_id = pms.team_id THEN away_t.logo_url ELSE home_t.logo_url END as opponent_logo_url
        FROM player_match_stats pms
        JOIN matches m ON pms.match_id = m.match_id
        JOIN teams home_t ON m.home_team_id = home_t.team_id
        JOIN teams away_t ON m.away_team_id = away_t.team_id
        WHERE pms.player_id = ?
        ORDER BY m.match_date DESC
    """

    rows = db.execute(query, (player_id,)).fetchall()

    results = []
    for row in rows:
        d = dict(row)
        is_home = bool(d['is_home'])
        d['is_home'] = is_home

        # Compute W/D/L result from match scores
        home_score = d.pop('home_score', None)
        away_score = d.pop('away_score', None)

        if home_score is not None and away_score is not None:
            if is_home:
                player_goals = home_score
                opponent_goals = away_score
            else:
                player_goals = away_score
                opponent_goals = home_score

            if player_goals > opponent_goals:
                d['result'] = 'W'
            elif player_goals == opponent_goals:
                d['result'] = 'D'
            else:
                d['result'] = 'L'

            # Also store the score string for display e.g. "2-1"
            if is_home:
                d['score'] = f"{home_score}-{away_score}"
            else:
                d['score'] = f"{away_score}-{home_score}"
        else:
            d['result'] = None
            d['score'] = None

        results.append(d)

    return results

def get_player_shotmap(db: sqlite3.Connection, player_id: int, season_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """Fetch all shots for a player and calculate xG dynamically with AI."""
    
    if season_id is None:
        # Default to the player's most recent season in the shots table
        row = db.execute("SELECT MAX(season_id) as max_season FROM player_shots WHERE player_id = ?", (player_id,)).fetchone()
        if row and row['max_season']:
            season_id = row['max_season']

    # 1. Obtenemos los tiros crudos de la base de datos excluyendo penales
    query = """
        SELECT
            ps.shot_id,
            ps.match_id,
            ps.season_id,
            ps.shot_type,
            ps.situation,
            ps.body_part,
            ps.distance_m,
            ps.angle_rad,
            ps.coord_x as x,
            ps.coord_y as y,
            ps.goal_mouth_x,
            ps.goal_mouth_y,
            ps.goal_mouth_z,
            ps.goal_mouth_location
        FROM player_shots ps
        WHERE ps.player_id = ? AND ps.situation != 'penalty'
    """
    params = [player_id]

    if season_id:
        query += " AND ps.season_id = ?"
        params.append(season_id)

    query += " ORDER BY ps.shot_id DESC"

    rows = db.execute(query, tuple(params)).fetchall()
    
    if not rows:
        return []
        
    # 2. Convertimos a DataFrame para procesarlo con nuestro modelo XGBoost
    df = pd.DataFrame([dict(row) for row in rows])
    
    # 3. Aplicamos la Inteligencia Artificial si el modelo se cargó correctamente
    if xg_model is not None:
        # Replicamos la limpieza exacta que usamos en el entrenamiento
        def group_situation(sit):
            if sit == 'fast-break': return 'regular'
            elif sit == 'throw-in-set-piece': return 'set-piece'
            return sit
        
        df['situation_grouped'] = df['situation'].apply(group_situation)
        
        # Le damos los datos al modelo para predecir
        X_pred = df[['distance_m', 'angle_rad', 'body_part', 'situation_grouped']]
        df['calculated_xg'] = xg_model.predict_proba(X_pred)[:, 1]
        
        # Redondeamos a 3 decimales para la interfaz visual
        df['calculated_xg'] = df['calculated_xg'].round(3)
        
        # Limpiamos las columnas temporales que no necesita el Frontend
        df = df.drop(columns=['situation_grouped'])
    else:
        # Fallback de seguridad en caso de que el modelo no esté disponible
        df['calculated_xg'] = 0.0
        
    # 4. Convertimos de vuelta a formato lista de diccionarios para enviar como JSON
    return df.to_dict(orient='records')

def get_player_passes(db: sqlite3.Connection, player_id: int, match_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """Fetch passes for a specific player."""
    season_id = None
    if match_id is None:
        # Default to the player's most recent season in the passes table
        row = db.execute(
            "SELECT MAX(m.season_id) as max_season "
            "FROM matches m "
            "JOIN player_passes pp ON m.match_id = pp.match_id "
            "WHERE pp.player_id = ?", 
            (player_id,)
        ).fetchone()
        if row and row['max_season']:
            season_id = row['max_season']

    query = """
        SELECT 
            pp.id, pp.match_id, pp.player_id, pp.x_start, pp.y_start, pp.x_end, pp.y_end, pp.is_successful, pp.created_at
        FROM player_passes pp
    """
    if season_id is not None:
        query += " JOIN matches m ON pp.match_id = m.match_id"

    query += " WHERE pp.player_id = ?"
    params = [player_id]

    if match_id is not None:
        query += " AND pp.match_id = ?"
        params.append(match_id)

    if season_id is not None:
        query += " AND m.season_id = ?"
        params.append(season_id)

    query += " ORDER BY pp.id ASC"

    rows = db.execute(query, tuple(params)).fetchall()
    
    # Convert bool mapping
    results = []
    for row in rows:
        d = dict(row)
        d['is_successful'] = bool(d['is_successful'])
        results.append(d)
        
    return results

def get_player_defending_stats(db: sqlite3.Connection, player_id: int, season_id: Optional[int] = None) -> Dict[str, Any]:
    """Fetch defensive actions and dribbles for a specific player."""
    
    if season_id is None:
        # Default to the player's most recent season with defending data
        row = db.execute("""
            SELECT MAX(m.season_id) as max_season
            FROM matches m
            WHERE m.match_id IN (
                SELECT match_id FROM player_defensive_actions WHERE player_id = ?
                UNION
                SELECT match_id FROM player_dribbles WHERE player_id = ?
            )
        """, (player_id, player_id)).fetchone()
        
        if row and row['max_season']:
            season_id = row['max_season']
        else:
            season_id = db.execute("SELECT MAX(season_id) FROM matches").fetchone()[0]
        
    # 1. Fetch defensive actions
    def_query = """
        SELECT a.id, a.match_id, a.player_id, a.x, a.y, a.action_type, a.end_x, a.end_y, a.is_home, a.created_at
        FROM player_defensive_actions a
        JOIN matches m ON a.match_id = m.match_id
        WHERE a.player_id = ? AND m.season_id = ?
    """
    def_rows = db.execute(def_query, (player_id, season_id)).fetchall()
    
    defensive_actions = []
    for row in def_rows:
        d = dict(row)
        d['is_home'] = bool(d['is_home']) if d['is_home'] is not None else None
        defensive_actions.append(d)
    
    # 2. Fetch dribbles
    dribbles_query = """
        SELECT d.id, d.match_id, d.player_id, d.x, d.y, d.is_successful, d.created_at
        FROM player_dribbles d
        JOIN matches m ON d.match_id = m.match_id
        WHERE d.player_id = ? AND m.season_id = ?
    """
    dribbles_rows = db.execute(dribbles_query, (player_id, season_id)).fetchall()
    
    dribbles = []
    for row in dribbles_rows:
        d = dict(row)
        d['is_successful'] = bool(d['is_successful'])
        dribbles.append(d)
        
    # 3. Fetch ball carries
    bc_query = """
        SELECT bc.id, bc.match_id, bc.player_id, bc.x_start, bc.y_start, bc.x_end, bc.y_end, bc.is_home, bc.created_at
        FROM player_ball_carries bc
        JOIN matches m ON bc.match_id = m.match_id
        WHERE bc.player_id = ? AND m.season_id = ?
    """
    bc_rows = db.execute(bc_query, (player_id, season_id)).fetchall()
    
    ball_carries = []
    for row in bc_rows:
        bc = dict(row)
        bc['is_home'] = bool(bc['is_home'])
        ball_carries.append(bc)
        
    return {
        "defensive_actions": defensive_actions,
        "dribbles": dribbles,
        "ball_carries": ball_carries
    }