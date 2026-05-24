import logging
import time
from datetime import datetime
from ..db import is_cached, log_scrape
from .. import config

logger = logging.getLogger(__name__)

def camel_to_snake(name):
    import re
    name = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', name)
    return re.sub('([a-z0-9])([A-Z])', r'\1_\2', name).lower()

def scrape_and_store_match_stats(conn, sofascore_lanus, matches) -> int:
    """
    Fetch player match stats for played matches using LanusStats with retry loop.
    """
    resource_type = "match_stats"
    total_inserted = 0
    now = datetime.utcnow().isoformat()
    
    for match in matches:
        if match['status'] != 'played':
            continue
            
        match_id = match['match_id']
        match_url = match['match_url']
        resource_key = str(match_id)
        
        if is_cached(conn, resource_type, resource_key):
            logger.info(f"Match stats for {match_id} are cached. Skipping.")
            continue
            
        logger.info(f"Fetching match stats for {match_id} via LanusStats...")
        
        success = False
        for attempt in range(1, config.MAX_RETRIES + 1):
            try:
                # LanusStats get_players_match_stats returns [home_df, away_df]
                dfs = sofascore_lanus.get_players_match_stats(match_url)
                if not dfs or len(dfs) < 2:
                    raise ValueError("LanusStats did not return both home and away DataFrames.")
                    
                home_df, away_df = dfs
                
                # Combine and process
                records = []
                for df, team_id in [(home_df, match['home_team_id']), (away_df, match['away_team_id'])]:
                    if df is None or df.empty:
                        continue
                    
                    for _, row_data in df.iterrows():
                        # The LanusStats DF typically contains player info + stats
                        # We need to map standard SofaScore fields
                        row_dict = row_data.to_dict()
                        player_id = None
                        
                        # Find player ID. The dataframe might have it as 'id' or 'player_id' or 'player.id'
                        # Usually LanusStats prefixes columns or we have to inspect it
                        # For now, let's assume 'id' is player_id and 'name' is player name
                        # Actually LanusStats get_players_match_stats typically returns flattened dicts
                        # We will dynamically map matching columns
                        
                        # Let's look for player_id
                        for k, v in row_dict.items():
                            if k.lower() in ('id', 'player_id', 'player.id'):
                                player_id = v
                                break
                        
                        if not player_id:
                            # If we can't find ID, we skip
                            continue
                            
                        # Flatten keys by removing 'statistics.' prefix if present
                        flat_dict = {}
                        for k, v in row_dict.items():
                            clean_k = k.replace('statistics.', '')
                            flat_dict[clean_k] = v
                            
                        # Prepare insert dictionary
                        stat_data = {
                            'player_id': player_id,
                            'match_id': match_id,
                            'team_id': team_id,
                            'scraped_at': now,
                            'sofascore_rating': flat_dict.get('rating'),
                            'goals': flat_dict.get('goals'),
                            'assists': flat_dict.get('goalAssist'),
                            'shots_on_target': flat_dict.get('onTargetScoringAttempt'),
                            'tackles': flat_dict.get('totalTackle'),
                            'interceptions': flat_dict.get('interceptionWon'),
                            'key_passes': flat_dict.get('keyPass'),
                            'minutes_played': flat_dict.get('minutesPlayed'),
                            'total_shots': flat_dict.get('totalShots')
                        }
                        
                        # Calculate accurate_passes_pct
                        acc_pass = flat_dict.get('accuratePass')
                        tot_pass = flat_dict.get('totalPass')
                        if acc_pass is not None and tot_pass is not None and tot_pass > 0:
                            stat_data['accurate_passes_pct'] = (acc_pass / tot_pass) * 100
                            
                        # Remove None values so we only insert valid data
                        stat_data = {k: v for k, v in stat_data.items() if v is not None}
                        
                        records.append(stat_data)
                
                if records:
                    table_info = conn.execute("PRAGMA table_info(player_match_stats)").fetchall()
                    valid_columns = {col['name'] for col in table_info}
                    
                    all_keys = set()
                    for r in records:
                        all_keys.update(r.keys())
                    
                    final_keys = list(all_keys.intersection(valid_columns))
                    
                    insert_query = f'''
                        INSERT OR IGNORE INTO player_match_stats ({", ".join(final_keys)})
                        VALUES ({", ".join(["?"] * len(final_keys))})
                    '''
                    
                    values_list = []
                    for r in records:
                        values_list.append([r.get(k) for k in final_keys])
                        
                    conn.execute("PRAGMA foreign_keys=OFF")
                    conn.executemany(insert_query, values_list)
                    conn.execute("PRAGMA foreign_keys=ON")
                    total_inserted += len(records)
                
                log_scrape(conn, resource_type, resource_key, 'success')
                success = True
                break # Success, exit retry loop
                
            except Exception as e:
                backoff = 2 ** attempt
                logger.warning(f"LanusStats failed for {match_id}: {e}. Retrying in {backoff}s (Attempt {attempt}/{config.MAX_RETRIES})")
                time.sleep(backoff)
        
        if not success:
            logger.error(f"Failed to scrape match stats for {match_id} after {config.MAX_RETRIES} attempts.")
            log_scrape(conn, resource_type, resource_key, 'failed', error_message="Exhausted retries.")
            # Continue to the next match, we do not abort the pipeline.

    return total_inserted
