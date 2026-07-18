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
    
    matches = conn.execute("SELECT match_id FROM matches").fetchall()
    
    # MODO PRUEBA: Si está activo, solo probamos con 1 partido para no bloquear la IP
    if test_mode:
        logger.info("⚠️ TEST MODE ACTIVO: Solo se procesará el primer partido para verificar cálculos.")
        matches = matches[:1]
        
    total_inserted = 0
    now = datetime.utcnow().isoformat()
    
    for row in matches:
        match_id = row['match_id']
        resource_key = str(match_id)
        
        # Ignorar si ya está cacheado (a menos que estemos forzando el test)
        if is_cached(conn, resource_type, resource_key) and not test_mode:
            continue
            
        logger.info(f"Fetching shotmap for match {match_id}...")
        
        try:
            # Usamos tu cliente LanusStats "polite" que ya incluye retrasos anti-baneo
            shotmap_data = api_client.get_match_shotmap(match_id)
            
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
                    now
                ))
            
            if records:
                insert_query = '''
                    INSERT OR IGNORE INTO player_shots 
                    (shot_id, player_id, match_id, season_id, is_home, shot_type, situation, body_part, coord_x, coord_y, distance_m, angle_rad, scraped_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    return total_inserted