import logging
import sqlite3
from scraper.sources.shotmap import calculate_and_store_pending_xg
from scraper.sources.team_metrics import recompute_all_team_metrics
from scraper.sources.percentiles import compute_and_store_percentiles
from scraper.sources.role_percentiles import compute_and_store_role_percentiles

logger = logging.getLogger(__name__)


def backfill_xg(conn: sqlite3.Connection, force_all: bool = True) -> None:
    """
    Recalculates xG across player_shots_xg using xg_model_pipeline.pkl (with 0.79 for penalties)
    and synchronizes all derived tables:
      1. player_shots_xg (model_version = 'v1.0-pipeline')
      2. player_match_stats.expected_goals
      3. player_season_stats.expected_goals
      4. team_match_metrics (xg_for, xg_against, npxg_for, npxg_against)
      5. player_season_percentiles & player_season_role_percentiles
    """
    logger.info("Starting unified xG backfill across database...")

    # 1. Recalculate shot-level xG in player_shots_xg
    updated_shots = calculate_and_store_pending_xg(conn, force_all=force_all)
    logger.info(f"Shot-level xG synchronized ({updated_shots} shots processed).")

    cursor = conn.cursor()

    # 2. Synchronize player_match_stats.expected_goals from player_shots_xg
    logger.info("Synchronizing player_match_stats.expected_goals from player_shots_xg...")
    cursor.execute("""
        UPDATE player_match_stats
        SET expected_goals = COALESCE(
            (
                SELECT ROUND(SUM(psx.calculated_xg), 2)
                FROM player_shots ps
                JOIN player_shots_xg psx ON ps.shot_id = psx.shot_id
                WHERE ps.match_id = player_match_stats.match_id
                  AND ps.player_id = player_match_stats.player_id
            ),
            0.0
        )
        WHERE expected_goals IS NOT NULL
           OR EXISTS (
                SELECT 1 FROM player_shots ps
                WHERE ps.match_id = player_match_stats.match_id
                  AND ps.player_id = player_match_stats.player_id
           );
    """)

    # 3. Synchronize player_season_stats.expected_goals for the active season
    logger.info("Synchronizing player_season_stats.expected_goals for latest season...")
    cursor.execute("UPDATE player_season_stats SET expected_goals = 0.0")
    cursor.execute("""
        UPDATE player_season_stats
        SET expected_goals = COALESCE(
            (
                SELECT ROUND(SUM(psx.calculated_xg), 3)
                FROM player_shots ps
                JOIN player_shots_xg psx ON ps.shot_id = psx.shot_id
                WHERE ps.player_id = player_season_stats.player_id
                  AND ps.season_id = (SELECT MAX(season_id) FROM matches)
            ),
            0.0
        );
    """)
    conn.commit()

    # 4. Recompute team_match_metrics for the active season
    logger.info("Recomputing team_match_metrics...")
    recompute_all_team_metrics(conn)

    # 5. Recompute player percentiles (group and tactical role)
    logger.info("Recomputing player season percentiles and role percentiles...")
    compute_and_store_percentiles(conn)
    compute_and_store_role_percentiles(conn)

    logger.info("Unified xG backfill complete.")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
    db_conn = sqlite3.connect("liga1.db")
    db_conn.row_factory = sqlite3.Row
    try:
        backfill_xg(db_conn, force_all=True)
    finally:
        db_conn.close()
