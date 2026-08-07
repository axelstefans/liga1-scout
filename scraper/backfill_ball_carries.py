import argparse
import sqlite3
import logging
import time
from datetime import datetime
from scraper.http_client import SofaScoreAPIClient
from scraper.db import get_connection

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def parse_args():
    parser = argparse.ArgumentParser(description="Backfill player_ball_carries for already scraped matches.")
    parser.add_argument("--dry-run", action="store_true", help="Do not write to database.")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of matches to process.")
    parser.add_argument("--delay", type=float, default=2.0, help="Delay in seconds between matches to avoid rate limiting.")
    return parser.parse_args()

def main():
    args = parse_args()
    if args.dry_run:
        logger.info("Starting in DRY RUN mode. No database inserts will occur.")

    conn = get_connection('liga1.db')
    
    # 1. Selection query
    query = """
        SELECT DISTINCT pda.match_id
        FROM player_defensive_actions pda
        JOIN matches m ON pda.match_id = m.match_id
        WHERE m.season_id = 88529
        AND pda.match_id NOT IN (SELECT DISTINCT match_id FROM player_ball_carries)
    """
    matches = conn.execute(query).fetchall()
    
    if args.limit:
        matches = matches[:args.limit]
        
    logger.info(f"Found {len(matches)} matches needing ball-carries backfill.")

    client = SofaScoreAPIClient()
    total_matches_processed = 0
    total_rows_inserted = 0
    
    try:
        for idx, row in enumerate(matches):
            match_id = row['match_id']
            season_id = 88529
            
            logger.info(f"Processing match {idx+1}/{len(matches)} (match_id: {match_id})...")
            
            players = conn.execute('''
                SELECT player_id
                FROM player_match_stats
                WHERE match_id = ? AND minutes_played > 0
            ''', (match_id,)).fetchall()
            
            match_rows_inserted = 0
            
            for p_row in players:
                player_id = p_row['player_id']
                try:
                    data = client.get_player_rating_breakdown(match_id, player_id)
                    events = data.get('events', data.get('event', data))
                    ball_carries = events.get('ball-carries', [])
                    
                    if ball_carries:
                        for bc in ball_carries:
                            start_coords = bc.get('playerCoordinates', {})
                            end_coords = bc.get('passEndCoordinates', {})
                            
                            x_start = start_coords.get('x')
                            y_start = start_coords.get('y')
                            x_end = end_coords.get('x')
                            y_end = end_coords.get('y')
                            
                            is_home = True if bc.get('isHome') in (True, 1, 'true', 'True') else False
                            
                            if not args.dry_run:
                                cursor = conn.cursor()
                                now = datetime.utcnow().isoformat()
                                cursor.execute('''
                                    INSERT INTO player_ball_carries 
                                    (match_id, player_id, season_id, x_start, y_start, x_end, y_end, is_home, created_at)
                                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                                ''', (match_id, player_id, season_id, x_start, y_start, x_end, y_end, is_home, now))
                                
                            match_rows_inserted += 1
                except Exception as e:
                    logger.error(f"Error fetching data for match {match_id}, player {player_id}: {e}")
                    
            if not args.dry_run:
                conn.commit()
                
            total_matches_processed += 1
            total_rows_inserted += match_rows_inserted
            logger.info(f"Finished match {match_id}: Processed {len(players)} players, found {match_rows_inserted} ball-carry rows.")
            
            if idx < len(matches) - 1:
                time.sleep(args.delay)
                
    finally:
        client.close()
        
    logger.info("--- BACKFILL COMPLETE ---")
    logger.info(f"Total Matches Processed: {total_matches_processed}")
    logger.info(f"Total Rows Inserted (simulated if dry-run): {total_rows_inserted}")

if __name__ == '__main__':
    main()
