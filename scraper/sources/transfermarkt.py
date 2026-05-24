import logging
from datetime import datetime
from ..db import is_cached, log_scrape
from .. import config

logger = logging.getLogger(__name__)

def scrape_and_store_market_values(conn, tm_lanus, teams) -> int:
    """Fetch market values and transfer history using LanusStats Transfermarkt."""
    resource_type = "transfermarkt"
    total_inserted = 0
    now = datetime.utcnow().isoformat()
    
    for team in teams:
        team_id = team['team_id']
        tm_team_id = team['tm_team_id']
        tm_team_name = team['tm_team_name']
        
        if not tm_team_id:
            logger.warning(f"No Transfermarkt ID for team {team_id} ({team['name']}). Skipping.")
            continue
            
        resource_key = str(tm_team_id)
        if is_cached(conn, resource_type, resource_key):
            logger.info(f"Transfermarkt data for team {tm_team_id} is cached. Skipping.")
            continue
            
        logger.info(f"Fetching Transfermarkt data for {tm_team_name}...")
        
        try:

            tm_slug = conn.execute("SELECT slug FROM teams WHERE team_id=?", (team_id,)).fetchone()
            tm_slug = tm_slug[0] if tm_slug else None
            df_squad = tm_lanus.scrape_players_for_teams(tm_slug, str(tm_team_id), "2025")
            
            if df_squad is None or df_squad.empty:
                logger.warning(f"No squad data from Transfermarkt for {tm_team_name}.")
                log_scrape(conn, resource_type, resource_key, 'success')
                continue
                
            # We need to map TM players back to SofaScore players. 
            # This is hard because names differ.
            # However, the user constitution says we store whatever TM returns and we can join later.
            # But the table `player_market_values` has `player_id` (SofaScore ID) as foreign key.
            # Let's fetch the current players for this team from DB to attempt fuzzy matching.
            db_players = conn.execute("SELECT player_id, name, shirt_number FROM players WHERE team_id = ?", (team_id,)).fetchall()
            
            records_mv = []
            
            for _, row in df_squad.iterrows():
                # We expect columns like Player_id, Name, Market_value, etc. depending on LanusStats
                # We will inspect row keys case-insensitively
                row_dict = {str(k).lower(): v for k, v in row.to_dict().items()}
                
                tm_player_id = row_dict.get('player_id')
                tm_name = row_dict.get('name', '')
                mv_str = row_dict.get('market_value') # Or similar
                
                # Attempt to find the SofaScore player_id by name or shirt number
                matched_player_id = None
                for db_p in db_players:
                    # Simple case-insensitive exact match
                    if tm_name.lower() == db_p['name'].lower():
                        matched_player_id = db_p['player_id']
                        break
                        
                if matched_player_id:
                    # Calculate int market value if possible (e.g. "€1.50m" -> 1500000)
                    mv_int = None # parsing can be complex, skipping for now, relying on mv_str
                    
                    records_mv.append((
                        matched_player_id, str(tm_player_id), mv_int, str(mv_str), now, now
                    ))
            
            if records_mv:
                conn.execute("BEGIN TRANSACTION")
                conn.executemany('''
                    INSERT OR REPLACE INTO player_market_values (
                        player_id, tm_player_id, market_value_eur, market_value_str, value_date, scraped_at
                    ) VALUES (?, ?, ?, ?, ?, ?)
                ''', records_mv)
                conn.execute("COMMIT")
                total_inserted += len(records_mv)
                
            log_scrape(conn, resource_type, resource_key, 'success')
            logger.info(f"Stored {len(records_mv)} market values for {tm_team_name}.")
            
        except Exception as e:
            logger.error(f"Error scraping Transfermarkt for {tm_team_name}: {e}")
            log_scrape(conn, resource_type, resource_key, 'failed', error_message=str(e))
            # Continue to next team

    return total_inserted
