import argparse
import sqlite3
import logging
import time
from scraper.http_client import SofaScoreAPIClient
from scraper.db import get_connection

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def parse_args():
    parser = argparse.ArgumentParser(description="Backfill action_type and coordinates for player_defensive_actions.")
    parser.add_argument("--dry-run", action="store_true", help="Do not write to database.")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of matches to process.")
    parser.add_argument("--delay", type=float, default=2.0, help="Delay in seconds between matches to avoid rate limiting.")
    return parser.parse_args()

def main():
    args = parse_args()
    if args.dry_run:
        logger.info("Starting in DRY RUN mode. No database updates will occur.")

    conn = get_connection('liga1.db')
    
    # 1. Selection query
    query = """
        SELECT DISTINCT d.match_id
        FROM player_defensive_actions d
        JOIN matches m ON d.match_id = m.match_id
        WHERE m.season_id = 88529 AND d.action_type IS NULL
    """
    matches = conn.execute(query).fetchall()
    
    logger.info(f"Found {len(matches)} matches needing defensive actions backfill.")

    if args.limit:
        matches = matches[:args.limit]

    client = SofaScoreAPIClient()
    total_matches_processed = 0
    total_events_found = 0
    total_unmatched_warnings = 0
    total_rows_updated = 0
    
    try:
        for idx, row in enumerate(matches):
            match_id = row['match_id']
            
            logger.info(f"Processing match {idx+1}/{len(matches)} (match_id: {match_id})...")
            
            # 2. Get the list of players
            players = conn.execute('''
                SELECT player_id
                FROM player_match_stats
                WHERE match_id = ? AND minutes_played > 0
            ''', (match_id,)).fetchall()
            
            match_events_found = 0
            match_unmatched_warnings = 0
            
            for p_row in players:
                player_id = p_row['player_id']
                try:
                    # 3. Call client to get breakdown
                    data = client.get_player_rating_breakdown(match_id, player_id)
                    events = data.get('events', data.get('event', data))
                    defensive_actions = events.get('defensive', [])
                    
                    if defensive_actions:
                        # 4. Log the count
                        logger.info(f"Match {match_id}, Player {player_id}: Found {len(defensive_actions)} defensive events in API.")
                        match_events_found += len(defensive_actions)
                        
                        # 1. Query existing DB rows for this (match_id, player_id)
                        db_rows = conn.execute('''
                            SELECT id, x, y 
                            FROM player_defensive_actions 
                            WHERE match_id = ? AND player_id = ? 
                            ORDER BY id ASC
                        ''', (match_id, player_id)).fetchall()
                        
                        candidate_pool = [dict(r) for r in db_rows]
                        matched_count = 0
                        
                        # 2. For each API event (in original array order)
                        for event in defensive_actions:
                            coords = event.get('playerCoordinates', {})
                            ev_x = coords.get('x')
                            ev_y = coords.get('y')
                            action_type = event.get('eventActionType')
                            is_home = True if event.get('isHome') in (True, 1, 'true', 'True') else False
                            
                            end_coords = event.get('passEndCoordinates', {})
                            end_x = end_coords.get('x')
                            end_y = end_coords.get('y')
                            
                            # 3. Search candidate pool for FIRST unconsumed row
                            matched = False
                            for candidate in candidate_pool:
                                if 'consumed' not in candidate:
                                    if ev_x is not None and ev_y is not None and candidate['x'] is not None and candidate['y'] is not None:
                                        if abs(candidate['x'] - ev_x) < 0.01 and abs(candidate['y'] - ev_y) < 0.01:
                                            candidate['consumed'] = True
                                            matched = True
                                            matched_count += 1
                                            logger.info(f"MATCH: row id={candidate['id']} <- action_type={action_type}, end_x={end_x}, end_y={end_y}, is_home={is_home}")
                                            
                                            if not args.dry_run:
                                                conn.execute('''
                                                    UPDATE player_defensive_actions 
                                                    SET action_type = ?, end_x = ?, end_y = ?, is_home = ? 
                                                    WHERE id = ?
                                                ''', (action_type, end_x, end_y, is_home, candidate['id']))
                                                total_rows_updated += 1
                                                
                                            break
                            
                            # 4. Unmatched warning
                            if not matched:
                                logger.warning(f"UNMATCHED: match_id={match_id} player_id={player_id} event_coords=({ev_x},{ev_y}) action_type={action_type} - no corresponding DB row found.")
                                match_unmatched_warnings += 1
                        
                        # 5. Per-player summary
                        logger.info(f"Summary for Player {player_id}: Matched {matched_count} / {len(db_rows)} total DB rows.")
                        
                except Exception as e:
                    logger.error(f"Error fetching data for match {match_id}, player {player_id}: {e}")
                    
            if not args.dry_run:
                conn.commit()
                    
            total_matches_processed += 1
            total_events_found += match_events_found
            total_unmatched_warnings += match_unmatched_warnings
            logger.info(f"Finished match {match_id}: Processed {len(players)} players, found {match_events_found} defensive events.")
            
            if idx < len(matches) - 1:
                time.sleep(args.delay)
                
    finally:
        client.close()
        
    logger.info("--- BACKFILL COMPLETE ---")
    logger.info(f"Total Matches Processed: {total_matches_processed}")
    logger.info(f"Total Defensive Events Found: {total_events_found}")
    logger.info(f"Total Unmatched Warnings: {total_unmatched_warnings}")
    logger.info(f"Total Rows Updated: {total_rows_updated}")

if __name__ == '__main__':
    main()
