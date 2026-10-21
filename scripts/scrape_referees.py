"""Scrape referees for Liga 1 matches and store in liga1.db.

Follows the undetected-chromedriver pattern from match_period_stats.py:
- Browser warm-up on sofascore.com to pass Cloudflare Turnstile.
- Re-use single session and execute sync fetch inside the authenticated context via execute_script.
- Polite pacing (2.5 - 4.0s) between matches.
- 100% idempotent: processes only matches WHERE referee_id IS NULL and commits 1-by-1.
"""

import codecs
import logging
import os
import random
import sqlite3
import sys
import time
from typing import Optional, Dict, Any

# Ensure stdout handles UTF-8 on Windows terminal
if sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = codecs.getwriter("utf-8")(sys.stdout.buffer, "replace")

from LanusStats.sofascore import _get_chrome_major_version, _get_system_chromedriver_path
import undetected_chromedriver as uc
from faker import Faker

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("scrape_referees")

DB_PATH = os.getenv("DB_PATH", "liga1.db")
WARMUP_SECONDS = 25
MIN_DELAY = 2.5
MAX_DELAY = 4.0
TARGET_SEASON_ID = 88529  # 2026 Season


def is_challenge_response(data: Any) -> bool:
    """Detects Cloudflare 403 challenge payload."""
    if not isinstance(data, dict):
        return False
    if data.get("code") == 403 and data.get("reason") == "challenge":
        return True
    err = data.get("error")
    if isinstance(err, dict) and err.get("code") == 403 and err.get("reason") == "challenge":
        return True
    return False


def build_driver() -> uc.Chrome:
    """Creates a visible undetected Chrome driver with eager loading to prevent timeouts on ad streams."""
    chrome_options = uc.ChromeOptions()
    chrome_options.page_load_strategy = "eager"
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


def fetch_event_data(driver: uc.Chrome, match_id: int) -> Optional[Dict[str, Any]]:
    """Fetches /api/v1/event/{match_id} using return fetch() inside browser context."""
    script = """
        return fetch('/api/v1/event/' + arguments[0])
            .then(r => {
                if (!r.ok) return { error: r.status, statusText: r.statusText };
                return r.json();
            })
            .catch(err => ({ error: err.toString() }));
    """
    try:
        return driver.execute_script(script, match_id)
    except Exception as e:
        logger.error(f"Error executing fetch for match {match_id}: {e}")
        return None


def upsert_referee(cursor: sqlite3.Cursor, ref_data: Dict[str, Any]) -> int:
    """Upserts referee record and returns referee_id."""
    ref_id = ref_data.get("id")
    name = ref_data.get("name", "Unknown Referee")
    slug = ref_data.get("slug")
    
    country_dict = ref_data.get("country", {})
    country_name = country_dict.get("name", "Peru") if isinstance(country_dict, dict) else "Peru"
    
    games = ref_data.get("games")
    yellows = ref_data.get("yellowCards")
    reds = ref_data.get("redCards")

    cursor.execute("""
        INSERT INTO referees (
            referee_id, name, slug, country,
            total_games_sofa, total_yellows_sofa, total_reds_sofa
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(referee_id) DO UPDATE SET
            name = excluded.name,
            slug = excluded.slug,
            country = excluded.country,
            total_games_sofa = COALESCE(excluded.total_games_sofa, referees.total_games_sofa),
            total_yellows_sofa = COALESCE(excluded.total_yellows_sofa, referees.total_yellows_sofa),
            total_reds_sofa = COALESCE(excluded.total_reds_sofa, referees.total_reds_sofa)
    """, (ref_id, name, slug, country_name, games, yellows, reds))
    
    return ref_id


def main():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Query pending finished/played matches for 2026 season first, then any other
    pending_matches = cursor.execute("""
        SELECT match_id, home_team_id, away_team_id, match_date, status, season_id
        FROM matches
        WHERE referee_id IS NULL AND status IN ('played', 'finished', 'FT')
          AND season_id = ?
        ORDER BY match_date DESC
    """, (TARGET_SEASON_ID,)).fetchall()

    total_pending = len(pending_matches)
    logger.info(f"Found {total_pending} pending finished/played matches for season {TARGET_SEASON_ID} without referee in {DB_PATH}.")

    if total_pending == 0:
        logger.info("All 2026 matches already have referee assignments! Exiting.")
        conn.close()
        return

    driver = None
    assigned_count = 0
    unassigned_count = 0

    try:
        logger.info("Initializing undetected-chromedriver...")
        driver = build_driver()

        # Step 4: 25-second warm-up on sofascore.com to resolve Turnstile & establish cookies
        logger.info("Navigating to https://www.sofascore.com/ for session warm-up...")
        try:
            driver.get("https://www.sofascore.com/")
        except Exception as e:
            logger.info(f"Page get triggered eager return: {e}")
        logger.info(f"Waiting {WARMUP_SECONDS}s for Cloudflare Turnstile and session cookies...")
        time.sleep(WARMUP_SECONDS)
        logger.info("Warm-up complete. Starting match referee extraction...")

        for idx, match in enumerate(pending_matches, start=1):
            match_id = match["match_id"]
            m_date = match["match_date"]

            res = fetch_event_data(driver, match_id)

            if is_challenge_response(res):
                logger.warning(f"Cloudflare challenge encountered on match {match_id}. Sleeping 12s and retrying...")
                time.sleep(12.0)
                res = fetch_event_data(driver, match_id)
                if is_challenge_response(res):
                    logger.error(f"Challenge persists for match {match_id}. Skipping.")
                    continue

            if not isinstance(res, dict) or "event" not in res:
                err = res.get("error") if isinstance(res, dict) else "Invalid response"
                logger.warning(f"[{idx}/{total_pending}] Match {match_id} ({m_date}): Failed to fetch event details ({err})")
                continue

            event = res.get("event", {})
            referee = event.get("referee")

            if referee and referee.get("id"):
                ref_id = upsert_referee(cursor, referee)
                cursor.execute("UPDATE matches SET referee_id = ? WHERE match_id = ?", (ref_id, match_id))
                conn.commit()
                assigned_count += 1
                logger.info(f"[{idx}/{total_pending}] Match {match_id}: Assigned to '{referee.get('name')}' (ID: {ref_id})")
            else:
                unassigned_count += 1
                logger.warning(f"[{idx}/{total_pending}] Match {match_id} ({m_date}): No referee listed in event details")

            # Commit after every match to ensure strict idempotency and instant persistence
            conn.commit()

            # Pacing between calls
            pause = random.uniform(MIN_DELAY, MAX_DELAY)
            time.sleep(pause)

    except KeyboardInterrupt:
        logger.warning("\nScraping interrupted by user. All processed matches remain saved in DB.")
    except Exception as e:
        logger.exception(f"Unexpected error during scraping: {e}")
    finally:
        if driver:
            try:
                driver.quit()
                logger.info("Browser session closed cleanly.")
            except Exception:
                pass
        conn.close()
        logger.info(f"Finished session: {assigned_count} matches assigned, {unassigned_count} without referee listed.")


if __name__ == "__main__":
    main()
