import logging
import io
import requests
from datetime import datetime
from colorthief import ColorThief
from ..db import is_cached, log_scrape
from .. import config

logger = logging.getLogger(__name__)

def get_dominant_color(url: str, fallback: str = "#0ea5e9") -> str:
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        f = io.BytesIO(response.content)
        color_thief = ColorThief(f)
        # get_color returns (r, g, b)
        dominant_color = color_thief.get_color(quality=1)
        return "#{:02x}{:02x}{:02x}".format(*dominant_color).upper()
    except Exception as e:
        logger.warning(f"Failed to extract color from {url}: {e}")
        return fallback

def scrape_and_store_teams(conn, api_client) -> list[dict]:
    """Fetch all teams from SofaScore and store in teams table."""
    resource_type = "teams"
    resource_key = f"{config.LEAGUE_ID}_{config.SEASON_ID}"
    
    if is_cached(conn, resource_type, resource_key):
        logger.info(f"Teams data is cached for league {config.LEAGUE_ID}. Skipping.")
        # We still need to return the teams for downstream tasks.
        rows = conn.execute("SELECT * FROM teams").fetchall()
        return [dict(row) for row in rows]
    
    logger.info("Fetching teams from SofaScore API...")
    try:
        teams_data = api_client.get_teams(config.LEAGUE_ID, config.SEASON_ID)
        if teams_data:
            import json
            logger.info(f"Sample team structure: {json.dumps(teams_data[0], indent=2)}")
        if not teams_data:
            logger.warning("No teams found.")
            return []
            
        now = datetime.utcnow().isoformat()
        records = []
        for team in teams_data:
            team_id = team.get('id')
            name = team.get('name')
            slug = team.get('slug')
            short_name = team.get('shortName')
            country = team.get('country', {}).get('name')
            logo_url = f"https://api.sofascore.app/api/v1/team/{team_id}/image"
            tm_team_id = config.TM_TEAM_MAP.get(slug)
            primary_color = get_dominant_color(logo_url)
            
            records.append((
                team_id, name, short_name, country, logo_url,
                tm_team_id, name, primary_color, now
            ))
            
        conn.execute("BEGIN TRANSACTION")
        conn.executemany('''
            INSERT OR REPLACE INTO teams (
                team_id, name, short_name, country, logo_url, tm_team_id, tm_team_name, primary_color, scraped_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', records)
        conn.execute("COMMIT")
        
        log_scrape(conn, resource_type, resource_key, 'success')
        logger.info(f"Successfully stored {len(records)} teams.")
        
        # Return what we inserted
        return [dict(row) for row in conn.execute("SELECT * FROM teams").fetchall()]
        
    except Exception as e:
        logger.error(f"Error scraping teams: {e}")
        log_scrape(conn, resource_type, resource_key, 'failed', error_message=str(e))
        raise
