import logging
import time
import json
from datetime import datetime
import LanusStats as ls

from ..db import is_cached, log_scrape
from .. import config

logger = logging.getLogger(__name__)

def scrape_and_store_heatmaps(conn, api_client) -> int:
    """
    Scrape and store heatmap data as JSON blobs.
    """
    logger.info("Starting heatmap scrape...")
    
    # Query distinct player_ids. Limit to 3 for testing as requested.
    players = conn.execute(
        "SELECT DISTINCT player_id FROM player_season_stats LIMIT 3"
    ).fetchall()
    
    total_inserted = 0
    sofascore = ls.SofaScore()
    
    for row in players:
        player_id = row["player_id"]
        
        if is_cached(conn, "heatmap_json", str(player_id)):
            logger.debug(f"Skipping cached heatmap for player {player_id}")
            continue
            
        try:
            logger.info(f"Fetching heatmap for player {player_id}...")
            
            # Use LanusStats
            heatmap_data = sofascore.get_player_season_heatmap("Peru Liga 1", "2026", player_id)
            
            if hasattr(heatmap_data, 'to_dict'):
                points = heatmap_data.to_dict(orient='records')
            elif isinstance(heatmap_data, list):
                points = heatmap_data
            else:
                points = []
            
            if not points:
                logger.info(f"No points for {player_id}")
                log_scrape(conn, "heatmap_json", str(player_id), 'success')
                continue
                
            points_json = json.dumps(points)
                
            with conn:
                conn.execute("""
                    INSERT INTO player_heatmaps (player_id, season_id, heatmap_json, scraped_at)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(player_id, season_id) DO UPDATE SET
                    heatmap_json = excluded.heatmap_json,
                    scraped_at = excluded.scraped_at
                """, (
                    player_id,
                    config.SEASON_ID,
                    points_json,
                    datetime.utcnow().isoformat()
                ))
                total_inserted += 1
            
            log_scrape(conn, "heatmap_json", str(player_id), 'success')
            
        except Exception as e:
            if "PlayerDoesntHaveInfo" in type(e).__name__ or "PlayerDoesntHaveInfo" in str(e):
                logger.info(f"Player {player_id} doesn't have heatmap info.")
                log_scrape(conn, "heatmap_json", str(player_id), 'success')
            else:
                logger.error(f"Failed to scrape heatmap for player {player_id}: {e}")
                log_scrape(conn, "heatmap_json", str(player_id), 'failed', error_message=str(e))
            
        time.sleep(1.5)
        
    logger.info(f"Finished scraping heatmaps. Inserted/Updated {total_inserted} players.")
    return total_inserted
