import logging
import time
from datetime import datetime

from ..db import is_cached, log_scrape
from .. import config

logger = logging.getLogger(__name__)

def scrape_and_store_heatmaps(conn, api_client) -> int:
    """
    Scrape and store heatmap data for all players with season stats.
    """
    logger.info("Starting heatmap scrape...")
    
    # Query all distinct player_ids from player_season_stats
    players = conn.execute(
        "SELECT DISTINCT player_id FROM player_season_stats"
    ).fetchall()
    
    total_inserted = 0
    
    for row in players:
        player_id = row["player_id"]
        
        if is_cached(conn, "heatmap", str(player_id)):
            logger.debug(f"Skipping cached heatmap for player {player_id}")
            continue
            
        try:
            logger.info(f"Fetching heatmap for player {player_id}...")
            endpoint = f"api/v1/player/{player_id}/heatmap/season/{config.SEASON_ID}"
            data = api_client._polite_get(endpoint)
            
            if not data:
                points = []
            else:
                points = data.get('points', data.get('heatmap', []))
            
            if not points or not isinstance(points, list):
                log_scrape(conn, "heatmap", str(player_id), 'success')
                time.sleep(1.5)
                continue
                
            with conn:
                for point in points:
                    conn.execute("""
                        INSERT OR IGNORE INTO player_heatmap 
                        (player_id, season_id, x, y, count, scraped_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (
                        player_id,
                        config.SEASON_ID,
                        point.get('x', 0),
                        point.get('y', 0),
                        point.get('count', 1),
                        datetime.utcnow().isoformat()
                    ))
                    total_inserted += 1
            
            log_scrape(conn, "heatmap", str(player_id), 'success')
            
        except Exception as e:
            logger.error(f"Failed to scrape heatmap for player {player_id}: {e}")
            log_scrape(conn, "heatmap", str(player_id), 'failed', error_message=str(e))
            
        time.sleep(1.5)
        
    logger.info(f"Finished scraping heatmaps. Inserted {total_inserted} points.")
    return total_inserted
