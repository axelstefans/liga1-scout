import time
import random
import logging
from . import config
import LanusStats as ls

logger = logging.getLogger(__name__)

class SofaScoreAPIClient:
    """Wrapper for SofaScore JSON API using LanusStats undetected-chromedriver to bypass 403s."""
    
    def __init__(self):
        logger.info("Initialising LanusStats SofaScore module (this may launch Chrome)...")
        self.sofascore = ls.SofaScore()
    
    def _polite_get(self, endpoint: str) -> dict:
        """Executes GET request using LanusStats with random delay and exponential backoff retry."""
        time.sleep(random.uniform(config.MIN_DELAY_SECONDS, config.MAX_DELAY_SECONDS))
        
        for attempt in range(1, config.MAX_RETRIES + 1):
            try:
                # LanusStats sofascore_request handles the base URL automatically
                data = self.sofascore.sofascore_request(endpoint)
                if data is None:
                    raise ValueError(f"Received None from sofascore_request for {endpoint}")
                return data
            except Exception as e:
                if attempt == config.MAX_RETRIES:
                    logger.error(f"Failed to fetch {endpoint} after {config.MAX_RETRIES} attempts: {e}")
                    raise
                else:
                    backoff = 2 ** attempt
                    logger.warning(f"Request error for {endpoint}: {e}. Retrying in {backoff}s (Attempt {attempt}/{config.MAX_RETRIES})")
                    time.sleep(backoff)
        
        raise RuntimeError(f"Exhausted retries for {endpoint}")

    def get_teams(self, league_id: int, season_id: int) -> list[dict]:
        endpoint = f"unique-tournament/{league_id}/season/{season_id}/teams"
        data = self._polite_get(endpoint)
        return data.get('teams', [])

    def get_squad(self, team_id: int) -> list[dict]:
        endpoint = f"team/{team_id}/players"
        data = self._polite_get(endpoint)
        return data.get('players', [])

    def get_season_stats_page(self, league_id: int, season_id: int, offset: int = 0) -> dict:
        endpoint = f"unique-tournament/{league_id}/season/{season_id}/statistics?limit=100&offset={offset}&order=-rating&accumulation=total"
        return self._polite_get(endpoint)

    def get_matches_by_round(self, league_id: int, season_id: int, round_num: int) -> list[dict]:
        endpoint = f"unique-tournament/{league_id}/season/{season_id}/events/round/{round_num}"
        data = self._polite_get(endpoint)
        return data.get('events', [])

    def close(self):
        """Closes the underlying browser if needed."""
        if hasattr(self.sofascore, 'driver') and self.sofascore.driver:
            try:
                self.sofascore.driver.quit()
            except Exception:
                pass
