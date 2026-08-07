import logging
import time
from datetime import datetime
from ..db import is_cached, log_scrape
from .. import config
from .formation_parser import get_tactical_position

logger = logging.getLogger(__name__)

def camel_to_snake(name):
    import re
    name = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', name)
    return re.sub('([a-z0-9])([A-Z])', r'\1_\2', name).lower()

def scrape_and_store_match_stats(conn, sofascore_lanus, matches) -> int:
    resource_type = "match_stats"
    total_inserted = 0
    now = datetime.utcnow().isoformat()
    
    for match in matches:
        if match['status'] != 'played':
            continue
        if match.get('season_id') != config.SEASON_ID:
            continue
            
        match_id = match['match_id']
        match_url = match['match_url']
        resource_key = str(match_id)
        
        # Definitive DB presence check (permanent skip for finished matches)
        has_data = conn.execute("SELECT 1 FROM player_match_stats WHERE match_id = ? LIMIT 1", (match_id,)).fetchone()
        if has_data:
            logger.info(f"Match stats for {match_id} already exist in DB. Skipping API call.")
            continue
            
        if is_cached(conn, resource_type, resource_key):
            logger.info(f"Match stats for {match_id} are cached (recent). Skipping.")
            continue
            
        logger.info(f"Fetching match stats for {match_id} via LanusStats...")
        
        success = False
        for attempt in range(1, config.MAX_RETRIES + 1):
            try:
                # ==========================================
                # NUEVO: Extraer Formaciones y Posiciones primero
                # ==========================================
                tactical_positions = {}
                lineups_data = sofascore_lanus.sofascore_request(f'api/v1/event/{str(match_id)}/lineups')
                
                if lineups_data:
                    for side in ['home', 'away']:
                        if side in lineups_data:
                            team_info = lineups_data[side]
                            formation = team_info.get('formation', '')
                            players_list = team_info.get('players', [])
                            
                            for idx, p_entry in enumerate(players_list):
                                p_id = p_entry.get('player', {}).get('id')
                                if p_id:
                                    tactical_positions[p_id] = get_tactical_position(
                                        player_index=idx,
                                        formation=formation,
                                        is_substitute=p_entry.get('substitute', False),
                                        default_position=p_entry.get('position', 'Unknown')
                                    )
                time.sleep(1) # Pequeño delay de cortesía después de la llamada extra
                # ==========================================
                
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
                        row_dict = row_data.to_dict()
                        player_id = None
                        
                        for k, v in row_dict.items():
                            if k.lower() in ('id', 'player_id', 'player.id'):
                                player_id = v
                                break
                        
                        if not player_id:
                            continue
                            
                        flat_dict = {}
                        for k, v in row_dict.items():
                            clean_k = k.replace('statistics.', '')
                            flat_dict[clean_k] = v
                            
                        # NUEVO: Obtenemos la posición táctica que inferimos arriba
                        final_position = tactical_positions.get(player_id, flat_dict.get('position', None))
                            
                        # Prepare insert dictionary
                        stat_data = {
                            'player_id': player_id,
                            'match_id': match_id,
                            'team_id': team_id,
                            'scraped_at': now,
                            'position': final_position, # NUEVO: Guardamos la posición en la DB
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
                if "doesn't have enough information" in str(e):
                    logger.warning(f"Walkover/No data for {match_id}: {e}. Skipping permanently.")
                    log_scrape(conn, resource_type, resource_key, 'failed', error_message=str(e))
                    success = True
                    break
                    
                backoff = 2 ** attempt
                logger.warning(f"LanusStats failed for {match_id}: {e}. Retrying in {backoff}s (Attempt {attempt}/{config.MAX_RETRIES})")
                time.sleep(backoff)
        
        if not success:
            logger.error(f"Failed to scrape match stats for {match_id} after {config.MAX_RETRIES} attempts.")
            log_scrape(conn, resource_type, resource_key, 'failed', error_message="Exhausted retries.")

    return total_inserted