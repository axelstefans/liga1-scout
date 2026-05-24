import logging
from datetime import datetime
from ..db import is_cached, log_scrape
from .. import config

logger = logging.getLogger(__name__)

def scrape_and_store_squads(conn, api_client, teams) -> int:
    """Fetch squads for all given teams and store in players table."""
    resource_type = "squads"
    total_inserted = 0
    now = datetime.utcnow().isoformat()
    
    for team in teams:
        team_id = team['team_id']
        resource_key = str(team_id)
        
        if is_cached(conn, resource_type, resource_key):
            logger.info(f"Squad for team {team_id} is cached. Skipping.")
            continue
            
        logger.info(f"Fetching squad for team {team_id}...")
        try:
            players_data = api_client.get_squad(team_id)
            if not players_data:
                logger.warning(f"No players found for team {team_id}.")
                log_scrape(conn, resource_type, resource_key, 'success')
                continue
                
            records = []
            for item in players_data:
                player = item.get('player', {})
                player_id = player.get('id')
                name = player.get('name')
                
                # Timestamp might be in seconds or direct string depending on API
                # date_of_birth mapping isn't always trivial, let's grab what we can
                dob = None
                date_of_birth_timestamp = player.get('dateOfBirthTimestamp')
                if date_of_birth_timestamp:
                    try:
                        dob = datetime.utcfromtimestamp(date_of_birth_timestamp).strftime('%Y-%m-%d')
                    except Exception:
                        pass
                
                nationality = player.get('country', {}).get('name')
                position = player.get('position')
                position_group = config.POSITION_GROUP_MAP.get(position, 'Unknown')
                shirt_number = player.get('shirtNumber')
                
                if player_id and name:
                    records.append((
                        player_id, team_id, name, dob, nationality,
                        position, position_group, shirt_number, now
                    ))
            
            if records:
                conn.execute("BEGIN TRANSACTION")
                conn.executemany('''
                    INSERT OR REPLACE INTO players (
                        player_id, team_id, name, date_of_birth, nationality,
                        position, position_group, shirt_number, scraped_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', records)
                conn.execute("COMMIT")
                total_inserted += len(records)
                
            log_scrape(conn, resource_type, resource_key, 'success')
            logger.info(f"Stored {len(records)} players for team {team_id}.")
            
        except Exception as e:
            logger.error(f"Error scraping squad for team {team_id}: {e}")
            log_scrape(conn, resource_type, resource_key, 'failed', error_message=str(e))
            # Continue to next team instead of raising, so one failed team doesn't break everything
            
    return total_inserted
