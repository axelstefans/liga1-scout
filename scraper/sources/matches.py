import logging
from datetime import datetime
from ..db import is_cached, log_scrape
from .. import config

logger = logging.getLogger(__name__)

def scrape_and_store_matches(conn, api_client) -> list[dict]:
    """Fetch all match fixtures/results and store in matches table."""
    resource_type = "matches"
    resource_key = f"{config.LEAGUE_ID}_{config.SEASON_ID}"
    
    if is_cached(conn, resource_type, resource_key):
        logger.info("Matches are cached. Skipping fetch, but returning from DB.")
        rows = conn.execute("SELECT * FROM matches").fetchall()
        return [dict(row) for row in rows]
        
    logger.info("Fetching matches from SofaScore API...")
    now = datetime.utcnow().isoformat()
    total_inserted = 0
    records = []
    
    try:
        rounds_data = api_client.get_rounds(config.LEAGUE_ID, config.SEASON_ID)
        rounds = rounds_data.get('rounds', [])
        logger.info(f"Found {len(rounds)} rounds to scrape.")

        for round_info in rounds:
            round_num = round_info.get('round')
            prefix = round_info.get('prefix', 'Apertura')
            
            # 1. Query local DB to avoid fetching already completed rounds
            db_matches = conn.execute(
                "SELECT status, match_date FROM matches WHERE season_id = ? AND round = ? ORDER BY match_date", 
                (config.SEASON_ID, round_num)
            ).fetchall()
            
            # 2. Handle overlapping round numbers (Apertura Round 1 vs Clausura Round 1)
            target_matches = db_matches
            if len(db_matches) > 12:
                # We have matches for both Apertura and Clausura. Order by date separates them.
                half_idx = len(db_matches) // 2
                if 'apertura' in prefix.lower():
                    target_matches = db_matches[:half_idx]
                else:
                    target_matches = db_matches[half_idx:]
            elif len(db_matches) > 0 and len(db_matches) <= 12:
                # We only have one tournament's matches (Apertura happens first)
                if 'clausura' in prefix.lower():
                    target_matches = []
            
            # 3. If round is fully populated (~9 matches) and completely finished, skip the network request
            if len(target_matches) >= 8 and all(m['status'] in ('played', 'cancelled') for m in target_matches):
                logger.info(f"Round {round_num} ({prefix}) is fully completed locally. Skipping API call.")
                continue
                
            logger.info(f"Fetching matches for round {round_num} ({prefix})...")
            events = api_client.get_matches_by_round(config.LEAGUE_ID, config.SEASON_ID, round_num, prefix)

            if not events:
                continue
                
            for event in events:
                match_id = event.get('id')
                home_team = event.get('homeTeam', {})
                away_team = event.get('awayTeam', {})
                home_team_id = home_team.get('id')
                away_team_id = away_team.get('id')
                home_slug = home_team.get('slug', '')
                away_slug = away_team.get('slug', '')
                
                # e.g., '2025-01-24T20:00:00Z'
                startTimestamp = event.get('startTimestamp')
                match_date = datetime.utcfromtimestamp(startTimestamp).isoformat() if startTimestamp else None
                
                home_score = event.get('homeScore', {}).get('current')
                away_score = event.get('awayScore', {}).get('current')
                status_code = event.get('status', {}).get('code')
                
                # Map status code to string (approximate, usually 100=ended, 0=not started)
                status_type = event.get('status', {}).get('type')
                if status_type == 'finished':
                    status = 'played'
                elif status_type == 'notstarted':
                    status = 'scheduled'
                elif status_type == 'postponed':
                    status = 'postponed'
                elif status_type == 'canceled':
                    status = 'cancelled'
                else:
                    status = status_type or 'unknown'
                    
                match_url = f"https://www.sofascore.com/{home_slug}-{away_slug}/Kb#id:{match_id}"
                
                records.append((
                    match_id, home_team_id, away_team_id, match_date, round_num,
                    home_score, away_score, status, match_url, config.SEASON_ID, now
                ))
            
        if records:
            conn.execute("BEGIN TRANSACTION")
            conn.executemany('''
                INSERT OR REPLACE INTO matches (
                    match_id, home_team_id, away_team_id, match_date, round,
                    home_score, away_score, status, match_url, season_id, scraped_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', records)
            conn.execute("COMMIT")
            total_inserted += len(records)
            
        log_scrape(conn, resource_type, resource_key, 'success')
        logger.info(f"Successfully stored {total_inserted} matches.")
        
        # Return all matches from db
        return [dict(row) for row in conn.execute("SELECT * FROM matches").fetchall()]
        
    except Exception as e:
        logger.error(f"Error scraping matches: {e}")
        log_scrape(conn, resource_type, resource_key, 'failed', error_message=str(e))
        raise
