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
            ps.coord_y as y
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