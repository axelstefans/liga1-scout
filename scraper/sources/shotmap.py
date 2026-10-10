import logging
import math
from datetime import datetime
from ..db import is_cached, log_scrape
from .. import config

logger = logging.getLogger(__name__)

def calculate_shot_features(x_raw: float, y_raw: float, is_home: bool):
    """
    Convierte las coordenadas 0-100 de Sofascore a metros reales (105x68m)
    y calcula la distancia y el ángulo hacia el arco.
    El arco objetivo en el shotmap de Sofascore SIEMPRE está en X=0.
    """
    # Ya no invertimos nada con is_home, Sofascore ya lo entrega normalizado.
    x_m = (x_raw / 100) * 105
    y_m = (y_raw / 100) * 68
    
    # La portería objetivo está en X=0, Y=34 (centro exacto)
    distance_m = math.sqrt((0 - x_m)**2 + (34 - y_m)**2)
    
    # Fórmula de ángulo hacia X=0
    try:
        angle_rad = math.atan2(7.32 * x_m, x_m**2 + (34 - y_m)**2 - (7.32/2)**2)
        if angle_rad < 0:
            angle_rad += math.pi
    except ZeroDivisionError:
        angle_rad = 0
        
    return distance_m, angle_rad

def scrape_and_store_shotmaps(conn, api_client, test_mode=True) -> int:
    """Fetch shotmaps for matches. If test_mode is True, only runs 1 match."""
    resource_type = "shotmap"
    
    # Cargar todos los IDs de jugadores válidos en memoria para máxima velocidad
    valid_players = {row['player_id'] for row in conn.execute("SELECT player_id FROM players").fetchall()}
    
    matches = conn.execute("SELECT match_id, season_id, status FROM matches").fetchall()
    
    # MODO PRUEBA: Si está activo, solo probamos con 1 partido para no bloquear la IP
    if test_mode:
        logger.info("⚠️ TEST MODE ACTIVO: Solo se procesará el primer partido para verificar cálculos.")
        matches = matches[:1]
        
    total_inserted = 0
    now = datetime.utcnow().isoformat()
    
    for row in matches:
        if row["status"] != "played":
            continue
        if row["season_id"] != config.SEASON_ID:
            continue
            
        match_id = row['match_id']
        resource_key = str(match_id)
        
        if not test_mode:
            shot_count = conn.execute("SELECT COUNT(*) FROM player_shots WHERE match_id = ?", (match_id,)).fetchone()[0]
            if shot_count > 0:
                logger.info(f"Shotmap for match {match_id} already exists in database, skipping API call")
                continue
            
        logger.info(f"Fetching shotmap for match {match_id}...")
        
        try:
            # Use _polite_get since get_match_shotmap isn't defined in SofaScoreAPIClient
            shotmap_response = api_client._polite_get(f"api/v1/event/{match_id}/shotmap")
            shotmap_data = shotmap_response.get('shotmap', [])
            
            if not shotmap_data:
                logger.info(f"No shotmap data found for match {match_id}.")
                log_scrape(conn, resource_type, resource_key, 'success')
                continue
                
            records = []
            for shot in shotmap_data:
                player = shot.get('player', {})
                player_id = player.get('id')
                
                # Ignorar si no hay jugador o no existe en nuestra base de datos
                if not player_id or player_id not in valid_players:
                    continue
                
                coords = shot.get('playerCoordinates', {})
                x_raw = coords.get('x', 0)
                y_raw = coords.get('y', 0)
                is_home = shot.get('isHome', True)
                
                # ¡Magia matemática en acción!
                distance_m, angle_rad = calculate_shot_features(x_raw, y_raw, is_home)
                
                goal_mouth_coords = shot.get('goalMouthCoordinates', {})
                goal_mouth_x = goal_mouth_coords.get('x') if goal_mouth_coords else None
                goal_mouth_y = goal_mouth_coords.get('y') if goal_mouth_coords else None
                goal_mouth_z = goal_mouth_coords.get('z') if goal_mouth_coords else None
                goal_mouth_location = shot.get('goalMouthLocation')
                
                records.append((
                    shot.get('id'),
                    player_id,
                    match_id,
                    config.SEASON_ID,
                    is_home,
                    shot.get('shotType'),
                    shot.get('situation'),
                    shot.get('bodyPart'),
                    x_raw,
                    y_raw,
                    distance_m,
                    angle_rad,
                    now,
                    goal_mouth_x,
                    goal_mouth_y,
                    goal_mouth_z,
                    goal_mouth_location
                ))
            
            if records:
                insert_query = '''
                    INSERT OR IGNORE INTO player_shots 
                    (shot_id, player_id, match_id, season_id, is_home, shot_type, situation, body_part, coord_x, coord_y, distance_m, angle_rad, scraped_at, goal_mouth_x, goal_mouth_y, goal_mouth_z, goal_mouth_location)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                '''
                # Context manager para inserción segura
                with conn:
                    conn.executemany(insert_query, records)
                total_inserted += len(records)
                
            log_scrape(conn, resource_type, resource_key, 'success')
            
        except Exception as e:
            logger.error(f"Error scraping shotmap for match {match_id}: {e}")
            log_scrape(conn, resource_type, resource_key, 'failed', error_message=str(e))
            
    logger.info(f"Successfully stored {total_inserted} new shots.")

    # Automatically calculate and store xG for all pending shots
    calculate_and_store_pending_xg(conn)

    return total_inserted


def calculate_and_store_pending_xg(conn, model_path: str = "xg_model_pipeline.pkl") -> int:
    """
    Calculate and store expected goals (xG) for any shots in player_shots
    that lack an entry in player_shots_xg.
    """
    query = """
        SELECT ps.shot_id, ps.distance_m, ps.angle_rad, ps.body_part, ps.situation
        FROM player_shots ps
        LEFT JOIN player_shots_xg psx ON ps.shot_id = psx.shot_id
        WHERE psx.shot_id IS NULL;
    """
    rows = conn.execute(query).fetchall()

    if not rows:
        logger.info("All shots in player_shots already have calculated xG. No pending shots.")
        return 0

    import os
    if not os.path.exists(model_path):
        # Also check relative to workspace/project root if running from a different working directory
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        alt_model_path = os.path.join(project_root, "xg_model_pipeline.pkl")
        if os.path.exists(alt_model_path):
            model_path = alt_model_path
        else:
            logger.warning(f"xG model file not found at '{model_path}' or '{alt_model_path}'. Skipping xG calculation.")
            return 0

    logger.info(f"Found {len(rows)} pending shots without xG. Calculating xG using {model_path}...")

    try:
        import joblib
        import pandas as pd

        model = joblib.load(model_path)
        df = pd.DataFrame([dict(r) for r in rows])

        def group_situation(sit):
            if sit == "fast-break":
                return "regular"
            elif sit == "throw-in-set-piece":
                return "set-piece"
            return sit

        df["situation_grouped"] = df["situation"].apply(group_situation)
        X_pred = df[["distance_m", "angle_rad", "body_part", "situation_grouped"]]

        df["calculated_xg"] = model.predict_proba(X_pred)[:, 1].round(3)
        now = datetime.utcnow().isoformat()

        records = [
            (int(row["shot_id"]), float(row["calculated_xg"]), "v1.0-pipeline", now)
            for _, row in df.iterrows()
        ]

        with conn:
            conn.executemany("""
                INSERT OR REPLACE INTO player_shots_xg (shot_id, calculated_xg, model_version, calculated_at)
                VALUES (?, ?, ?, ?);
            """, records)

        logger.info(f"Successfully calculated and stored xG for {len(records)} shots in player_shots_xg.")
        return len(records)

    except Exception as e:
        logger.error(f"Failed to calculate xG for pending shots: {e}")
        return 0