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
    
    # 1. Fast In-Memory Set Pre-check:
    # Query all player IDs that already have a heatmap recorded in the database
    existing_heatmaps = {
        row["player_id"]
        for row in conn.execute("SELECT DISTINCT player_id FROM player_heatmaps").fetchall()
    }

    # Query candidate players from player_season_stats
    players = conn.execute(
        "SELECT player_id, COALESCE(minutes_played, 0) AS minutes_played FROM player_season_stats"
    ).fetchall()

    total_inserted = 0
    sofascore = None

    try:
        for row in players:
            player_id = row["player_id"]
            minutes_played = row["minutes_played"]

            # Skip if heatmap already exists in DB
            if player_id in existing_heatmaps:
                logger.info(f"Heatmap for player {player_id} already exists in database, skipping API call")
                continue

            # Skip players with 0 or negative minutes played
            if minutes_played <= 0:
                logger.info(f"Player {player_id} has 0 minutes played, skipping heatmap API call")
                continue

            # Fallback check against scrape_log cache
            if is_cached(conn, "heatmap_json", str(player_id)):
                logger.debug(f"Skipping cached heatmap for player {player_id}")
                continue

            # Lazy initialize LanusStats SofaScore to avoid spinning up Chrome if no players need scraping
            if sofascore is None:
                sofascore = ls.SofaScore()

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
                    logger.info(f"No points for {player_id}, recording tombstone.")
                    points_json = json.dumps([])
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
                    existing_heatmaps.add(player_id)
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

                existing_heatmaps.add(player_id)
                log_scrape(conn, "heatmap_json", str(player_id), 'success')

            except Exception as e:
                if "PlayerDoesntHaveInfo" in type(e).__name__ or "PlayerDoesntHaveInfo" in str(e):
                    logger.info(f"Player {player_id} doesn't have heatmap info, recording tombstone.")
                    points_json = json.dumps([])
                    try:
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
                        existing_heatmaps.add(player_id)
                    except Exception as db_err:
                        logger.error(f"Failed to record tombstone for player {player_id}: {db_err}")

                    log_scrape(conn, "heatmap_json", str(player_id), 'success')
                else:
                    logger.error(f"Failed to scrape heatmap for player {player_id}: {e}")
                    log_scrape(conn, "heatmap_json", str(player_id), 'failed', error_message=str(e))

            time.sleep(1.5)

    finally:
        if sofascore is not None:
            try:
                sofascore.close()
            except Exception as close_err:
                logger.warning(f"Error closing SofaScore browser session: {close_err}")

    logger.info(f"Finished scraping heatmaps. Inserted/Updated {total_inserted} players.")
    return total_inserted
