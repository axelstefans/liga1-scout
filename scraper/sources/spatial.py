import logging
import sqlite3
from datetime import datetime
import json
from scraper.db import is_cached, log_scrape
from scraper import config

logger = logging.getLogger(__name__)

def scrape_and_store_spatial_events(conn: sqlite3.Connection, api_client, matches: list[dict]):
    # Pre-filter matches to only the current season to avoid misleading logs and unnecessary iterations
    matches = [m for m in matches if m.get('season_id') == config.SEASON_ID and m.get('status') == 'played']
    logger.info(f"Starting spatial events (passes) extraction for {len(matches)} matches...")
    
    for match in matches:
        if match.get('status') != 'played':
            continue
        if match.get('season_id') != config.SEASON_ID:
            continue
            
        match_id = match['match_id']
        
        pass_count = conn.execute("SELECT COUNT(*) FROM player_passes WHERE match_id = ?", (match_id,)).fetchone()[0]
        if pass_count > 0:
            logger.info(f"Pass data for match {match_id} already exists, skipping")
            continue
            
        # Get players who played in this match
        players = conn.execute('''
            SELECT player_id 
            FROM player_match_stats 
            WHERE match_id = ? AND (minutes_played IS NULL OR minutes_played > 0)
        ''', (match_id,)).fetchall()
        
        if not players:
            continue
            
        for player_row in players:
            player_id = player_row['player_id']
            resource_key = f"{match_id}_{player_id}"
            
            if is_cached(conn, 'spatial_events', resource_key):
                continue
                
            try:
                data = api_client.get_player_rating_breakdown(match_id, player_id)
                
                # Try to safely extract passes
                passes = data.get('passes', [])
                if not passes and 'events' in data:
                    passes = data['events'].get('passes', [])
                if not passes and 'event' in data:
                    passes = data['event'].get('passes', [])
                
                cursor = conn.cursor()
                now = datetime.utcnow().isoformat()
                
                inserted_count = 0
                for p in passes:
                    # Safely extract coordinates
                    start_coords = p.get('playerCoordinates', {})
                    end_coords = p.get('passEndCoordinates', {})
                    
                    x_start = start_coords.get('x')
                    y_start = start_coords.get('y')
                    x_end = end_coords.get('x')
                    y_end = end_coords.get('y')
                    
                    # outcome is the boolean indicating success
                    outcome = p.get('outcome')
                    is_successful = True if outcome in (True, 'Successful', 'successful', 1) else False

                        
                    cursor.execute('''
                        INSERT OR IGNORE INTO player_passes 
                        (match_id, player_id, x_start, y_start, x_end, y_end, is_successful, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (match_id, player_id, x_start, y_start, x_end, y_end, is_successful, now))
                    
                    inserted_count += 1
                
                conn.commit()
                log_scrape(conn, 'spatial_events', resource_key, 'success')
                if inserted_count > 0:
                    logger.info(f"Inserted {inserted_count} passes for player {player_id} in match {match_id}")
                
            except Exception as e:
                logger.error(f"Error extracting passes for player {player_id} in match {match_id}: {e}")
                log_scrape(conn, 'spatial_events', resource_key, 'error', error_message=str(e))
                conn.commit()
                
        # Log the entire match as successfully scraped
        log_scrape(conn, 'spatial_match', str(match_id), 'success')
