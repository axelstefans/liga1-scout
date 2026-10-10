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
        season_id = match.get('season_id')
        
        pass_count = conn.execute("SELECT COUNT(*) FROM player_passes WHERE match_id = ?", (match_id,)).fetchone()[0]
        
        try:
            def_count = conn.execute("SELECT COUNT(*) FROM player_defensive_actions WHERE match_id = ?", (match_id,)).fetchone()[0]
        except sqlite3.OperationalError:
            def_count = 0
            
        if pass_count > 0 and def_count > 0:
            logger.info(f"Spatial data for match {match_id} already exists, skipping")
            continue
            
        if pass_count > 0 and def_count == 0:
            logger.info(f"Backfilling new spatial data for match {match_id}. Purging old passes to avoid duplication...")
            conn.execute("DELETE FROM player_passes WHERE match_id = ?", (match_id,))
            conn.execute("DELETE FROM scrape_log WHERE resource_type = 'spatial_events' AND resource_key LIKE ?", (f"{match_id}_%",))
            conn.commit()
            
        # Get players who participated or were in the lineup for this match
        players = conn.execute('''
            SELECT DISTINCT player_id 
            FROM player_match_stats 
            WHERE match_id = ? 
              AND (
                COALESCE(minutes_played, 0) > 0 
                OR was_substitute = 0 
                OR was_substitute IS NULL
              )
        ''', (match_id,)).fetchall()
        
        if not players:
            logger.warning(f"No lineup or participating players found for match {match_id}. Skipping and not marking as complete.")
            continue
            
        for player_row in players:
            player_id = player_row['player_id']
            resource_key = f"{match_id}_{player_id}"
            
            if is_cached(conn, 'spatial_events', resource_key):
                continue
                
            try:
                data = api_client.get_player_rating_breakdown(match_id, player_id)
                
                # Try to safely extract events
                passes = data.get('passes', [])
                defensive = data.get('defensive', [])
                dribbles = data.get('dribbles', [])
                ball_carries = data.get('ball-carries', [])
                
                if not passes and 'events' in data:
                    passes = data['events'].get('passes', [])
                    defensive = data['events'].get('defensive', [])
                    dribbles = data['events'].get('dribbles', [])
                    ball_carries = data['events'].get('ball-carries', [])
                if not passes and 'event' in data:
                    passes = data['event'].get('passes', [])
                    defensive = data['event'].get('defensive', [])
                    dribbles = data['event'].get('dribbles', [])
                    ball_carries = data['event'].get('ball-carries', [])
                
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
                
                for d in defensive:
                    coords = d.get('playerCoordinates', {})
                    x = coords.get('x')
                    y = coords.get('y')
                    
                    action_type = d.get('eventActionType')
                    is_home = True if d.get('isHome') in (True, 1, 'true', 'True') else False
                    
                    end_coords = d.get('passEndCoordinates', {})
                    end_x = end_coords.get('x')
                    end_y = end_coords.get('y')
                    
                    cursor.execute('''
                        INSERT INTO player_defensive_actions 
                        (match_id, player_id, x, y, created_at, action_type, end_x, end_y, is_home)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (match_id, player_id, x, y, now, action_type, end_x, end_y, is_home))
                    
                for dr in dribbles:
                    coords = dr.get('playerCoordinates', {})
                    x = coords.get('x')
                    y = coords.get('y')
                    outcome = dr.get('outcome')
                    is_successful = True if outcome in (True, 'Successful', 'successful', 1) else False
                    
                    cursor.execute('''
                        INSERT INTO player_dribbles 
                        (match_id, player_id, x, y, is_successful, created_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                    ''', (match_id, player_id, x, y, is_successful, now))
                    
                for bc in ball_carries:
                    start_coords = bc.get('playerCoordinates', {})
                    end_coords = bc.get('passEndCoordinates', {})
                    
                    x_start = start_coords.get('x')
                    y_start = start_coords.get('y')
                    x_end = end_coords.get('x')
                    y_end = end_coords.get('y')
                    
                    is_home = True if bc.get('isHome') in (True, 1, 'true', 'True') else False
                    
                    cursor.execute('''
                        INSERT INTO player_ball_carries 
                        (match_id, player_id, season_id, x_start, y_start, x_end, y_end, is_home, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (match_id, player_id, season_id, x_start, y_start, x_end, y_end, is_home, now))
                
                conn.commit()
                log_scrape(conn, 'spatial_events', resource_key, 'success')
                if inserted_count > 0 or defensive or dribbles or ball_carries:
                    logger.info(f"Inserted {inserted_count} passes, {len(defensive)} def, {len(dribbles)} dribbles, {len(ball_carries)} carries for player {player_id} in match {match_id}")
                
            except Exception as e:
                logger.error(f"Error extracting passes for player {player_id} in match {match_id}: {e}")
                log_scrape(conn, 'spatial_events', resource_key, 'error', error_message=str(e))
                conn.commit()
                
        # Log the entire match as successfully scraped
        log_scrape(conn, 'spatial_match', str(match_id), 'success')
