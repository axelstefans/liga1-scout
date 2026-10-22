import logging
import random
import time
import json
from datetime import datetime
import LanusStats as ls

from ..db import log_scrape
from .. import config

logger = logging.getLogger(__name__)


def get_stale_heatmap_candidates(conn, season_id: int = config.SEASON_ID):
    """
    Returns player_id, name, and latest_match_date for players with no heatmap,
    or whose latest match is later than their heatmap's scraped_at.
    """
    query = """
        SELECT pms.player_id, p.name, MAX(m.match_date) AS latest_match_date
        FROM player_match_stats pms
        JOIN matches m ON m.match_id = pms.match_id
        JOIN players p ON p.player_id = pms.player_id
        LEFT JOIN player_heatmaps ph ON ph.player_id = pms.player_id AND ph.season_id = :season_id
        WHERE m.season_id = :season_id AND pms.minutes_played > 0
        GROUP BY pms.player_id
        HAVING ph.scraped_at IS NULL OR datetime(MAX(m.match_date)) > datetime(ph.scraped_at)
        ORDER BY latest_match_date DESC, p.name ASC;
    """
    return conn.execute(query, {"season_id": season_id}).fetchall()


def scrape_and_store_heatmaps(conn, api_client) -> int:
    """
    Scrape and store heatmap data as JSON blobs for missing or stale players.
    """
    logger.info("Starting heatmap scrape...")

    candidates = get_stale_heatmap_candidates(conn, config.SEASON_ID)
    total = len(candidates)

    if total == 0:
        logger.info("All player heatmaps are up to date. Nothing to scrape.")
        return 0

    logger.info(f"Found {total} stale/missing player heatmaps to sync.")

    total_inserted = 0
    sofascore = None

    try:
        for idx, row in enumerate(candidates, start=1):
            player_id = row["player_id"]
            name = row["name"]

            # Lazy initialize LanusStats SofaScore to avoid spinning up Chrome if no players need scraping
            if sofascore is None:
                sofascore = ls.SofaScore()

            try:
                logger.info(f"Syncing heatmap {idx}/{total} for player {player_id} ({name})")

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
                    log_scrape(conn, "heatmap_json", str(player_id), 'success')
                else:
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
                    except Exception as db_err:
                        logger.error(f"Failed to record tombstone for player {player_id}: {db_err}")

                    log_scrape(conn, "heatmap_json", str(player_id), 'success')
                else:
                    logger.error(f"Failed to scrape heatmap for player {player_id}: {e}")
                    log_scrape(conn, "heatmap_json", str(player_id), 'failed', error_message=str(e))

            time.sleep(random.uniform(3.5, 5.5))
            if idx % 20 == 0:
                cooldown = random.uniform(14.0, 18.0)
                logger.info(f"[COOLDOWN] {cooldown:.1f}s after {idx} heatmaps")
                time.sleep(cooldown)

    finally:
        if sofascore is not None:
            try:
                sofascore.close()
            except Exception as close_err:
                logger.warning(f"Error closing SofaScore browser session: {close_err}")

    logger.info(f"Finished scraping heatmaps. Inserted/Updated {total_inserted} players.")
    return total_inserted
