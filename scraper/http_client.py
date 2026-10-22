import time
import random
import logging
from typing import Optional
import undetected_chromedriver as uc
from faker import Faker
from LanusStats.sofascore import _get_chrome_major_version, _get_system_chromedriver_path
from . import config
import LanusStats as ls

logger = logging.getLogger(__name__)

WARMUP_SECONDS = 25


def is_challenge_response(data: any) -> bool:
    """Detects Cloudflare 403 challenge payload or API error response."""
    if not isinstance(data, dict):
        return False
    if data.get("code") == 403 and data.get("reason") == "challenge":
        return True
    err = data.get("error")
    if isinstance(err, dict):
        if err.get("code") == 403 and err.get("reason") == "challenge":
            return True
        if err.get("code") in (403, 429, 500, 503):
            return True
    if err == 403 or data.get("status") == 403:
        return True
    return False


def _get_headed_driver_builder():
    """Returns a driver builder that runs undetected-chromedriver in visible/headed mode."""
    def _headed_build_driver():
        chrome_options = uc.ChromeOptions()
        chrome_options.page_load_strategy = "eager"
        # Explicitly headed mode to maintain valid Turnstile clearance cookies
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument(f"user-agent={Faker().chrome()}")
        driver = uc.Chrome(
            options=chrome_options,
            version_main=_get_chrome_major_version(),
            driver_executable_path=_get_system_chromedriver_path(),
        )
        driver.set_page_load_timeout(35)
        return driver
    return _headed_build_driver


class SofaScoreAPIClient:
    """Wrapper for SofaScore JSON API using LanusStats undetected-chromedriver to bypass 403s."""
    
    def __init__(self):
        logger.info("Initialising LanusStats SofaScore module (this may launch Chrome)...")
        self.sofascore = ls.SofaScore()
        self.sofascore._build_driver = _get_headed_driver_builder()
        self._warmed_up = False
        self._consecutive_403_count = 0

    def _ensure_warmed_up_driver(self):
        """Ensures the headed browser session is initialized and warmed up for 25s on sofascore.com."""
        driver = self.sofascore._ensure_driver()
        if not self._warmed_up:
            logger.info("Navigating to https://www.sofascore.com/ for 25s initial Turnstile warm-up...")
            try:
                driver.get("https://www.sofascore.com/")
            except Exception as e:
                logger.debug(f"Initial page get note: {e}")
            time.sleep(WARMUP_SECONDS)
            self._warmed_up = True
            logger.info("Browser session warm-up complete.")
        return driver
    
    def _polite_get(self, endpoint: str) -> dict:
        """Executes GET request using LanusStats with random delay and exponential backoff retry."""
        time.sleep(random.uniform(config.MIN_DELAY_SECONDS, config.MAX_DELAY_SECONDS))
        
        for attempt in range(1, config.MAX_RETRIES + 1):
            try:
                # LanusStats sofascore_request handles the base URL automatically
                data = self.sofascore.sofascore_request(endpoint)
                if data is None:
                    raise ValueError(f"Received None from sofascore_request for {endpoint}")
                if is_challenge_response(data):
                    raise RuntimeError(f"Cloudflare/API Challenge response detected for {endpoint}: {data}")
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
        endpoint = f"api/v1/unique-tournament/{league_id}/season/{season_id}/teams"
        data = self._polite_get(endpoint)
        return data.get('teams', [])

    def get_squad(self, team_id: int) -> list[dict]:
        endpoint = f"api/v1/team/{team_id}/players"
        data = self._polite_get(endpoint)
        return data.get('players', [])

    def get_season_stats_page(self, league_id: int, season_id: int, offset: int = 0) -> dict:
        fields = "goals,yellowCards,redCards,groundDuelsWon,groundDuelsWonPercentage,aerialDuelsWon,aerialDuelsWonPercentage,successfulDribbles,successfulDribblesPercentage,tackles,assists,accuratePassesPercentage,totalDuelsWon,totalDuelsWonPercentage,minutesPlayed,wasFouled,fouls,dispossessed,possesionLost,appearances,started,saves,cleanSheets,savedShotsFromInsideTheBox,savedShotsFromOutsideTheBox,goalsConcededInsideTheBox,goalsConcededOutsideTheBox,highClaims,successfulRunsOut,punches,runsOut,accurateFinalThirdPasses,bigChancesCreated,accuratePasses,keyPasses,accurateCrosses,accurateCrossesPercentage,accurateLongBalls,accurateLongBallsPercentage,interceptions,clearances,dribbledPast,bigChancesMissed,totalShots,shotsOnTarget,blockedShots,goalConversionPercentage,hitWoodwork,offsides,expectedGoals,errorLeadToGoal,errorLeadToShot,passToAssist,rating"
        endpoint = f"api/v1/unique-tournament/{league_id}/season/{season_id}/statistics?limit=100&offset={offset}&order=-rating&accumulation=total&fields={fields}"
        return self._polite_get(endpoint)

    def get_matches_by_round(self, league_id: int, season_id: int, round_num: int, prefix: str = 'Apertura') -> list[dict]:
        endpoint = f"api/v1/unique-tournament/{league_id}/season/{season_id}/events/round/{round_num}/prefix/{prefix}"
        data = self._polite_get(endpoint)
        return data.get('events', [])
    
    def get_rounds(self, league_id: int, season_id: int) -> dict:
        endpoint = f"api/v1/unique-tournament/{league_id}/season/{season_id}/rounds"
        return self._polite_get(endpoint)

    def fetch_in_browser(self, endpoint: str) -> Optional[dict]:
        """Executes in-browser fetch() maintaining Turnstile clearance cookies, refreshing session on 403."""
        driver = self._ensure_warmed_up_driver()
        script = f"""
            return fetch('{endpoint}')
                .then(async r => {{
                    let body = null;
                    try {{ body = await r.json(); }} catch (e) {{}}
                    return {{ status: r.status, ok: r.ok, data: body }};
                }})
                .catch(e => ({{ status: 0, ok: false, error: e.toString() }}));
        """

        for attempt in range(2):
            res = driver.execute_script(script)
            if not isinstance(res, dict):
                raise RuntimeError(f"Unexpected script response for {endpoint}: {res}")

            status = res.get("status")
            data = res.get("data")

            if status == 404 or (isinstance(data, dict) and isinstance(data.get("error"), dict) and data["error"].get("code") == 404):
                self._consecutive_403_count = 0
                logger.debug(f"404 Not Found for {endpoint} (no spatial data).")
                return None

            if status == 403 or is_challenge_response(data):
                if attempt == 0:
                    logger.warning("Cloudflare 403 challenge encountered. Refreshing browser session to renew Turnstile token...")
                    try:
                        driver.refresh()
                    except Exception as e:
                        logger.debug(f"Browser refresh note: {e}")
                    time.sleep(12)  # Wait for Turnstile challenge to auto-clear in headed Chrome
                    continue
                else:
                    self._consecutive_403_count += 1
                    logger.warning(
                        f"403 challenge persisted after browser refresh for {endpoint} "
                        f"(consecutive 403s: {self._consecutive_403_count}/3)."
                    )
                    if self._consecutive_403_count >= 3:
                        raise SystemExit("Cloudflare session expired. Halting to preserve IP.")
                    return data

            if not res.get("ok") or data is None:
                err_msg = res.get("error") or f"HTTP {status}"
                raise RuntimeError(f"Failed to fetch {endpoint}: {err_msg}")

            # Valid response
            self._consecutive_403_count = 0
            return data

        return None
    
    def get_player_rating_breakdown(self, event_id: int, player_id: int) -> Optional[dict]:
        """Fetches player rating breakdown via in-browser fetch() maintaining Turnstile clearance cookies."""
        endpoint = f"/api/v1/event/{event_id}/player/{player_id}/rating-breakdown"
        return self.fetch_in_browser(endpoint)

    def get_match_statistics(self, match_id: int) -> dict:
        """Fetch period-by-period team stats (ALL, 1ST, 2ND) including corners, fouls."""
        endpoint = f"api/v1/event/{match_id}/statistics"
        return self._polite_get(endpoint)

    def get_match_incidents(self, match_id: int) -> dict:
        """Fetch chronological events (goals with minute/addedTime, cards, substitutions)."""
        endpoint = f"api/v1/event/{match_id}/incidents"
        return self._polite_get(endpoint)

    def close(self):
        """Closes the underlying browser if needed."""
        if hasattr(self.sofascore, 'close'):
            try:
                self.sofascore.close()
            except Exception:
                pass
