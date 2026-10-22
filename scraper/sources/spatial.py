import logging
import random
import sqlite3
import time
from datetime import datetime
from scraper.db import is_cached, log_scrape
from scraper.http_client import is_challenge_response
from scraper import config

logger = logging.getLogger(__name__)


def _is_match_complete(conn: sqlite3.Connection, match_id: int) -> tuple[bool, int, list]:
    """
    Returns (is_complete, pass_count, eligible_players).
    A match is considered complete if a verified spatial_match completion flag exists with pass_count > 0,
    or if ALL eligible players for that match already have records in player_passes.
    """
    pass_count = conn.execute("SELECT COUNT(*) FROM player_passes WHERE match_id = ?", (match_id,)).fetchone()[0]
    players = conn.execute('''
        SELECT DISTINCT player_id, minutes_played, was_substitute, sofascore_rating
        FROM player_match_stats
        WHERE match_id = ?
          AND (COALESCE(minutes_played, 0) > 0 OR sofascore_rating IS NOT NULL)
    ''', (match_id,)).fetchall()

    if pass_count > 0:
        has_completion_flag = conn.execute(
            "SELECT 1 FROM scrape_log WHERE resource_type = 'spatial_match' AND resource_key = ? AND status = 'success' LIMIT 1",
            (str(match_id),)
        ).fetchone()
        if has_completion_flag:
            return True, pass_count, players

        if players:
            players_with_passes = {
                row[0]
                for row in conn.execute(
                    "SELECT DISTINCT player_id FROM player_passes WHERE match_id = ?",
                    (match_id,)
                ).fetchall()
            }
            if all(p['player_id'] in players_with_passes for p in players):
                return True, pass_count, players

    return False, pass_count, players


def scrape_and_store_spatial_events(conn: sqlite3.Connection, api_client, matches: list[dict]):
    # Pre-filter matches to only the current season to avoid misleading logs and unnecessary iterations
    matches = [m for m in matches if m.get('season_id') == config.SEASON_ID and m.get('status') == 'played']
    logger.info(f"Starting spatial events (passes) extraction for {len(matches)} matches...")
    
    # Filter to pending/incomplete matches while logging skipped matches
    pending_matches = []
    for match in matches:
        if match.get('status') != 'played':
            continue
        if match.get('season_id') != config.SEASON_ID:
            continue
            
        match_id = match['match_id']
        is_complete, pass_count, _ = _is_match_complete(conn, match_id)
        
        if is_complete:
            logger.info(f"Spatial data for match {match_id} already exists ({pass_count} passes), skipping")
            continue

        pending_matches.append(match)

    for match_idx, match in enumerate(pending_matches, start=1):
        match_id = match['match_id']
        season_id = match.get('season_id')
        
        is_complete, pass_count, players = _is_match_complete(conn, match_id)
        if is_complete:
            logger.info(f"Spatial data for match {match_id} already exists ({pass_count} passes), skipping")
            continue

        if pass_count == 0:
            # If the database has 0 passes, purge any false-positive cache entries so players are re-extracted
            conn.execute("DELETE FROM scrape_log WHERE resource_type = 'spatial_events' AND resource_key LIKE ?", (f"{match_id}_%",))
            conn.execute("DELETE FROM scrape_log WHERE resource_type = 'spatial_match' AND resource_key = ?", (str(match_id),))
            conn.commit()
        
        if not players:
            logger.warning(f"No lineup or participating players found for match {match_id}. Skipping and not marking as complete.")
            continue

        total_players = len(players)
        logger.info(f"Processing match {match_id} ({match_idx}/{len(pending_matches)}): {total_players} eligible participating players.")
            
        players_processed = 0
        for player_row in players:
            player_id = player_row['player_id']
            mins_played = player_row['minutes_played'] or 0
            resource_key = f"{match_id}_{player_id}"
            
            player_exists = conn.execute(
                "SELECT 1 FROM player_passes WHERE match_id = ? AND player_id = ? LIMIT 1",
                (match_id, player_id)
            ).fetchone()
            if player_exists:
                continue
                
            try:
                data = api_client.get_player_rating_breakdown(match_id, player_id)
                players_processed += 1

                if data is None:
                    # 404 Not Found: player has no spatial data registered by SofaScore
                    log_scrape(conn, 'spatial_events', resource_key, 'success')
                    conn.commit()
                else:
                    if is_challenge_response(data):
                        raise RuntimeError(f"Cloudflare challenge payload returned for player {player_id} in match {match_id}")

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
                    # Condition cache logging on physical extraction or 0 mins played
                    if inserted_count > 0 or defensive or dribbles or ball_carries or mins_played == 0:
                        log_scrape(conn, 'spatial_events', resource_key, 'success')
                        if inserted_count > 0 or defensive or dribbles or ball_carries:
                            logger.info(f"Inserted {inserted_count} passes, {len(defensive)} def, {len(dribbles)} dribbles, {len(ball_carries)} carries for player {player_id} in match {match_id}")
                    else:
                        logger.warning(f"0 events extracted for player {player_id} (played {mins_played}m) in match {match_id}. Not logging success.")

            except SystemExit:
                raise
            except Exception as e:
                logger.error(f"Error extracting passes for player {player_id} in match {match_id}: {e}")
                log_scrape(conn, 'spatial_events', resource_key, 'error', error_message=str(e))
                conn.commit()

            # Human pacing between players
            time.sleep(random.uniform(4.5, 7.0))
            # Cool-down batch: Every 7 players processed, introduce an additional pause
            if players_processed > 0 and players_processed % 7 == 0:
                cooldown = random.uniform(10.0, 15.0)
                logger.info(f"Cool-down batch after {players_processed} players: pausing {cooldown:.1f}s...")
                time.sleep(cooldown)
                
        # Log match as success ONLY if physical passes were stored
        final_passes = conn.execute("SELECT COUNT(*) FROM player_passes WHERE match_id = ?", (match_id,)).fetchone()[0]
        if final_passes > 0:
            log_scrape(conn, 'spatial_match', str(match_id), 'success')
            conn.commit()
            logger.info(f"Match {match_id} spatial events extraction verified: {final_passes} passes stored.")
        else:
            logger.warning(f"Match {match_id} ended with 0 passes in database. NOT marking spatial_match as success.")

        # Between matches: pause before proceeding to the next pending match
        if match_idx < len(pending_matches):
            match_pause = random.uniform(12.0, 18.0)
            logger.info(f"Match {match_id} complete. Pausing {match_pause:.1f}s before next match...")
            time.sleep(match_pause)
