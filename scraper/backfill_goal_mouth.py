import argparse
import logging
import time
from scraper.db import get_connection
from scraper.http_client import SofaScoreAPIClient

# Configurar logging
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger('backfill')

def main():
    parser = argparse.ArgumentParser(description="Backfill goal_mouth_x, goal_mouth_y, goal_mouth_z, and goal_mouth_location for season 88529")
    parser.add_argument('--dry-run', action='store_true', help="Print updates without executing them")
    parser.add_argument('--limit', type=int, default=None, help="Process only the first N matches")
    parser.add_argument('--delay', type=float, default=0.0, help="Additional sleep in seconds after processing each match")
    
    args = parser.parse_args()
    
    if args.delay > 0:
        logger.info(f"Extra delay between matches: {args.delay}s")
    
    if args.dry_run:
        logger.info("DRY RUN MODE ENABLED. No database updates will be executed.")
    
    conn = get_connection('liga1.db')
    
    # 1. Fetch exactly the scoped matches
    query = """
        SELECT DISTINCT ps.match_id
        FROM player_shots ps
        WHERE ps.season_id = 88529
        AND ps.goal_mouth_location IS NULL
    """
    matches = conn.execute(query).fetchall()
    
    logger.info(f"Retrieved exactly {len(matches)} matches needing backfill.")
    
    if args.limit:
        matches = matches[:args.limit]
        logger.info(f"Limiting to the first {args.limit} matches as requested.")
        
    api_client = SofaScoreAPIClient()
    
    total_matches_processed = 0
    total_rows_updated = 0
    total_rows_still_null = 0
    
    try:
        for row in matches:
            match_id = row['match_id']
            
            logger.info(f"Processing match_id: {match_id} ({total_matches_processed + 1}/{len(matches)})")
            
            try:
                shotmap_response = api_client._polite_get(f"api/v1/event/{match_id}/shotmap")
                shotmap_data = shotmap_response.get('shotmap', [])
                
                shots_updated_this_match = 0
                shots_still_null_this_match = 0
                
                # Usar una transacción explícita por partido
                if not args.dry_run:
                    conn.execute("BEGIN TRANSACTION")
                
                for shot in shotmap_data:
                    shot_id = shot.get('id')
                    goal_mouth_coords = shot.get('goalMouthCoordinates', {})
                    goal_mouth_x = goal_mouth_coords.get('x') if goal_mouth_coords else None
                    goal_mouth_y = goal_mouth_coords.get('y') if goal_mouth_coords else None
                    goal_mouth_z = goal_mouth_coords.get('z') if goal_mouth_coords else None
                    goal_mouth_location = shot.get('goalMouthLocation')
                    
                    if goal_mouth_location is None and not goal_mouth_coords:
                        shots_still_null_this_match += 1
                        continue # nothing to backfill
                    
                    if args.dry_run:
                        print(f"[DRY RUN] match_id={match_id}, shot_id={shot_id}, goal_mouth_x={goal_mouth_x}, goal_mouth_y={goal_mouth_y}, goal_mouth_z={goal_mouth_z}, goal_mouth_location={goal_mouth_location}")
                        shots_updated_this_match += 1
                    else:
                        cursor = conn.execute('''
                            UPDATE player_shots 
                            SET goal_mouth_x = ?, goal_mouth_y = ?, goal_mouth_z = ?, goal_mouth_location = ? 
                            WHERE shot_id = ?
                        ''', (goal_mouth_x, goal_mouth_y, goal_mouth_z, goal_mouth_location, shot_id))
                        if cursor.rowcount > 0:
                            shots_updated_this_match += 1

                # Commit per match
                if not args.dry_run:
                    conn.execute("COMMIT TRANSACTION")
                
                logger.info(f"Match {match_id}: {shots_updated_this_match} updated, {shots_still_null_this_match} remaining NULL.")
                
                total_matches_processed += 1
                total_rows_updated += shots_updated_this_match
                total_rows_still_null += shots_still_null_this_match
                
                if args.delay > 0 and total_matches_processed < len(matches):
                    time.sleep(args.delay)
                
            except Exception as e:
                if not args.dry_run:
                    conn.execute("ROLLBACK TRANSACTION")
                logger.error(f"Error processing match {match_id}: {e}")
                
    finally:
        api_client.close()
        
    logger.info("=== SUMMARY ===")
    logger.info(f"Total matches processed: {total_matches_processed}")
    logger.info(f"Total rows updated: {total_rows_updated}")
    logger.info(f"Total rows still without goal-mouth data (e.g. blocked): {total_rows_still_null}")

if __name__ == '__main__':
    main()
