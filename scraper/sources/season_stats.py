import logging
import re
from datetime import datetime
from ..db import is_cached, log_scrape
from .. import config

logger = logging.getLogger(__name__)

def camel_to_snake(name):
    """Convert camelCase to snake_case."""
    name = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', name)
    return re.sub('([a-z0-9])([A-Z])', r'\1_\2', name).lower()

def scrape_and_store_season_stats(conn, api_client) -> int:
    """Fetch paginated season stats from SofaScore JSON API."""
    resource_type = "season_stats"
    resource_key = f"{config.LEAGUE_ID}_{config.SEASON_ID}"
    
    if is_cached(conn, resource_type, resource_key):
        logger.info("Season stats are cached. Skipping.")
        return 0
        
    logger.info("Fetching season stats from SofaScore API...")
    now = datetime.utcnow().isoformat()
    offset = 0
    total_inserted = 0
    
    try:
        while True:
            logger.info(f"Fetching season stats page with offset {offset}...")
            data = api_client.get_season_stats_page(config.LEAGUE_ID, config.SEASON_ID, offset=offset)
            results = data.get('results', [])
            current_page = data.get('page', 1)
            total_pages = data.get('pages', 1)
            has_next_page = current_page < total_pages
            
            if not results:
                break
                
            records = []
            columns = []
            
            for item in results:
                player = item.get('player', {})
                team = item.get('team', {})
                player_id = player.get('id')
                team_id = team.get('id')
                
                if not player_id:
                    continue
                    
                # Skip if player is not in our players table (FK constraint will fail otherwise)
                row = conn.execute("SELECT 1 FROM players WHERE player_id = ?", (player_id,)).fetchone()
                if not row:
                    continue
                
                # Flatten the stats dictionary into a DB-friendly format
                stat_data = {'player_id': player_id, 'team_id': team_id, 'scraped_at': now}
                
                # SofaScore returns fields directly inside the item, some are nested
                for k, v in item.items():
                    if k in ('player', 'team'):
                        continue
                    snake_k = camel_to_snake(k)
                    stat_data[snake_k] = v
                
                records.append(stat_data)
                
            if records:
                # Get the union of all keys across all records for this page to construct the insert query dynamically
                all_keys = set()
                for r in records:
                    all_keys.update(r.keys())
                
                # Filter out keys that aren't in the player_season_stats table
                # We can do this by getting the PRAGMA table_info
                table_info = conn.execute("PRAGMA table_info(player_season_stats)").fetchall()
                valid_columns = {col['name'] for col in table_info}
                
                final_keys = list(all_keys.intersection(valid_columns))
                
                insert_query = f'''
                    INSERT OR REPLACE INTO player_season_stats ({", ".join(final_keys)})
                    VALUES ({", ".join(["?"] * len(final_keys))})
                '''
                
                values_list = []
                for r in records:
                    values = [r.get(k) for k in final_keys]
                    values_list.append(values)
                    
                conn.execute("BEGIN TRANSACTION")
                conn.executemany(insert_query, values_list)
                conn.execute("COMMIT")
                total_inserted += len(records)
            
            if not has_next_page:
                break
                
            offset += 100 # Default limit is 100
            
        log_scrape(conn, resource_type, resource_key, 'success')
        logger.info(f"Successfully stored {total_inserted} season stats records.")
        return total_inserted
        
    except Exception as e:
        logger.error(f"Error scraping season stats: {e}")
        log_scrape(conn, resource_type, resource_key, 'failed', error_message=str(e))
        raise
