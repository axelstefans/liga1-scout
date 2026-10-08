import logging
import random
import time
from datetime import datetime
from ..db import is_cached, log_scrape
from .. import config

logger = logging.getLogger(__name__)


def _parse_val(raw_val, as_float=False):
    """Safely parses raw integer or float string/value."""
    if raw_val is None:
        return None
    if isinstance(raw_val, (int, float)):
        return float(raw_val) if as_float else int(raw_val)
    if isinstance(raw_val, str):
        clean = raw_val.replace('%', '').strip()
        try:
            return float(clean) if as_float else int(clean)
        except ValueError:
            return None
    return None


def is_challenge_response(data: dict) -> bool:
    """Detects Cloudflare 403 challenge payload."""
    if not isinstance(data, dict):
        return False
    if data.get("code") == 403 and data.get("reason") == "challenge":
        return True
    err = data.get("error")
    if isinstance(err, dict) and err.get("code") == 403 and err.get("reason") == "challenge":
        return True
    return False


def _get_headed_driver_builder(sofascore_instance):
    """Returns a driver builder for LanusStats.SofaScore that runs in visible/headed mode."""
    import undetected_chromedriver as uc
    from faker import Faker
    from LanusStats.sofascore import _get_chrome_major_version, _get_system_chromedriver_path

    def _headed_build_driver():
        chrome_options = uc.ChromeOptions()
        # Explicitly NO headless mode: runs in visible single window
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument(f'user-agent={Faker().chrome()}')
        return uc.Chrome(
            options=chrome_options,
            version_main=_get_chrome_major_version(),
            driver_executable_path=_get_system_chromedriver_path(),
        )
    return _headed_build_driver


def scrape_and_store_match_period_stats(conn, api_client, matches=None, test_mode=False) -> int:
    """Fetch period-level team stats (1ST, 2ND, ALL) and goal incidents for played matches with 1-by-1 commits."""
    resource_type = "match_period_stats"
    total_processed = 0

    # Ensure headed browser mode on the existing SofaScore instance
    if hasattr(api_client, "sofascore"):
        sofascore_inst = api_client.sofascore
        # If driver is not yet created, patch _build_driver so it initializes headed
        if getattr(sofascore_inst, "_driver", None) is None:
            sofascore_inst._build_driver = _get_headed_driver_builder(sofascore_inst)

    if matches is None:
        matches = [dict(row) for row in conn.execute(
            "SELECT * FROM matches WHERE season_id = ? AND status = 'played' ORDER BY match_date",
            (config.SEASON_ID,)
        ).fetchall()]

    played_matches = [
        m for m in matches 
        if m.get("status") == "played" and m.get("season_id") == config.SEASON_ID
    ]

    logger.info(f"Checking match period stats for {len(played_matches)} played matches...")

    # Step 1: Pre-filtering with skipping query
    unprocessed_matches = []
    for match in played_matches:
        match_id = match["match_id"]
        has_periods = conn.execute(
            "SELECT 1 FROM match_period_stats WHERE match_id = ? AND period IN ('1ST', '2ND') LIMIT 1",
            (match_id,)
        ).fetchone()
        if not has_periods:
            unprocessed_matches.append(match)

    if test_mode:
        logger.info("[TEST MODE] Running controlled test of 2 matches.")
        matches_to_process = unprocessed_matches[:2] if len(unprocessed_matches) >= 2 else unprocessed_matches
    else:
        matches_to_process = unprocessed_matches

    if not matches_to_process:
        logger.info("No matches require period stats scraping.")
        return 0

    total_count = len(matches_to_process)
    logger.info(f"Targeting {total_count} matches for period stats and goal incidents.")

    # Step 3: Session Warm-up
    try:
        driver = api_client.sofascore._ensure_driver()
        logger.info("Initializing session: Navigating to SofaScore homepage for Cloudflare warm-up...")
        driver.get("https://www.sofascore.com/")
        logger.info("Waiting 25 seconds for full page assets, Turnstile validation, and session cookies to settle...")
        time.sleep(25)
        logger.info("Warm-up complete. Starting match-by-match scraping pipeline...")
    except Exception as e:
        logger.warning(f"Session warm-up error: {e}")

    for idx, match in enumerate(matches_to_process, start=1):
        match_start_time = time.time()
        match_id = match["match_id"]
        home_team_id = match["home_team_id"]
        away_team_id = match["away_team_id"]
        resource_key = str(match_id)

        # Check DB: SELECT 1 FROM match_period_stats WHERE match_id = ? AND period IN ('1ST', '2ND') LIMIT 1. If found, skip immediately.
        has_periods = conn.execute(
            "SELECT 1 FROM match_period_stats WHERE match_id = ? AND period IN ('1ST', '2ND') LIMIT 1",
            (match_id,)
        ).fetchone()
        if has_periods:
            logger.info(f"Match {match_id} already has period stats in SQLite. Skipping without network call.")
            continue

        match_url = match.get("match_url") or f"https://www.sofascore.com/event/{match_id}"
        logger.info(f"[{idx}/{total_count}] Navigating to match page {match_url} (ID: {match_id})...")

        try:
            driver = api_client.sofascore._ensure_driver()
            # Reuse the exact same tab for every match: navigate directly
            driver.get(match_url)
            time.sleep(random.uniform(2.5, 4.0))

            # Fetch statistics via in-page JavaScript execution
            stats_data = driver.execute_script("""
                return fetch('/api/v1/event/' + arguments[0] + '/statistics')
                    .then(r => {
                        if (!r.ok) return {error: r.status};
                        return r.json();
                    })
                    .catch(e => ({error: e.toString()}));
            """, match_id)

            if is_challenge_response(stats_data):
                logger.warning(f"Challenge encountered for match {match_id}. Sleeping 10s and skipping to next match...")
                time.sleep(10.0)
                continue

            time.sleep(1.0)

            # Fetch incidents via in-page JavaScript execution
            incidents_data = driver.execute_script("""
                return fetch('/api/v1/event/' + arguments[0] + '/incidents')
                    .then(r => {
                        if (!r.ok) return {error: r.status};
                        return r.json();
                    })
                    .catch(e => ({error: e.toString()}));
            """, match_id)

            if is_challenge_response(incidents_data):
                logger.warning(f"Challenge encountered for match {match_id}. Sleeping 10s and skipping to next match...")
                time.sleep(10.0)
                continue

            if not isinstance(stats_data, dict) or "error" in stats_data or "statistics" not in stats_data:
                err = stats_data.get("error", "No statistics field in response") if isinstance(stats_data, dict) else "Invalid response"
                logger.warning(f"Failed to fetch statistics for match {match_id}: {err}. Skipping to next iteration.")
                log_scrape(conn, resource_type, resource_key, "failed", error_message=str(err))
                continue

            periods_list = stats_data.get("statistics", [])
            incidents_list = incidents_data.get("incidents", []) if isinstance(incidents_data, dict) and "error" not in incidents_data else []

            # Parse goal incidents
            goal_records = []
            goals_by_period_team = {
                ("1ST", home_team_id): 0,
                ("1ST", away_team_id): 0,
                ("2ND", home_team_id): 0,
                ("2ND", away_team_id): 0,
                ("ALL", home_team_id): 0,
                ("ALL", away_team_id): 0,
            }

            for inc in incidents_list:
                if inc.get("incidentType") == "goal":
                    minute = inc.get("time")
                    real_minute = minute if minute is not None else inc.get("addedTime", 0)
                    period_code = "1T" if (real_minute is not None and real_minute <= 45) else "2T"
                    stats_period_key = "1ST" if period_code == "1T" else "2ND"

                    is_home = inc.get("isHome", True)
                    team_id = home_team_id if is_home else away_team_id
                    incident_class = inc.get("incidentClass", "regular")

                    player = inc.get("player", {})
                    player_name = player.get("name") or player.get("shortName") or "Unknown"
                    player_id = player.get("id")

                    # Check if goal originated from a corner
                    is_corner_origin = False
                    inc_from = str(inc.get("from", "")).lower()
                    inc_desc = str(inc.get("description", "")).lower()
                    inc_class = str(incident_class).lower()
                    if "corner" in inc_from or "corner" in inc_desc or "corner" in inc_class:
                        is_corner_origin = True
                    elif player_id:
                        shot_corner = conn.execute(
                            "SELECT 1 FROM player_shots WHERE match_id = ? AND player_id = ? AND shot_type = 'goal' AND situation = 'corner' LIMIT 1",
                            (match_id, player_id)
                        ).fetchone()
                        if shot_corner:
                            is_corner_origin = True

                    goal_records.append((
                        match_id,
                        team_id,
                        player_name,
                        real_minute,
                        period_code,
                        1 if is_corner_origin else 0,
                        incident_class
                    ))

                    goals_by_period_team[(stats_period_key, team_id)] = goals_by_period_team.get((stats_period_key, team_id), 0) + 1
                    goals_by_period_team[("ALL", team_id)] = goals_by_period_team.get(("ALL", team_id), 0) + 1

            # Insert goal incidents safely
            conn.execute("DELETE FROM match_goal_incidents WHERE match_id = ?", (match_id,))
            if goal_records:
                conn.executemany("""
                    INSERT INTO match_goal_incidents (
                        match_id, team_id, player_name, minute, period, is_corner_origin, incident_type
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """, goal_records)

            # Parse period statistics
            parsed_period_stats = {}
            for period_entry in periods_list:
                period_name = period_entry.get("period")
                if period_name not in ("ALL", "1ST", "2ND"):
                    continue

                home_metrics = {}
                away_metrics = {}

                for group in period_entry.get("groups", []):
                    for item in group.get("statisticsItems", []):
                        name = item.get("name", "").lower()
                        home_raw = item.get("homeValue") if item.get("homeValue") is not None else item.get("home")
                        away_raw = item.get("awayValue") if item.get("awayValue") is not None else item.get("away")

                        if "possession" in name:
                            home_metrics["possession"] = _parse_val(home_raw, as_float=True)
                            away_metrics["possession"] = _parse_val(away_raw, as_float=True)
                        elif "corner" in name:
                            home_metrics["corner_kicks"] = _parse_val(home_raw)
                            away_metrics["corner_kicks"] = _parse_val(away_raw)
                        elif "foul" in name:
                            home_metrics["fouls"] = _parse_val(home_raw)
                            away_metrics["fouls"] = _parse_val(away_raw)
                        elif "yellow card" in name:
                            home_metrics["yellow_cards"] = _parse_val(home_raw)
                            away_metrics["yellow_cards"] = _parse_val(away_raw)
                        elif "red card" in name:
                            home_metrics["red_cards"] = _parse_val(home_raw)
                            away_metrics["red_cards"] = _parse_val(away_raw)

                parsed_period_stats[(period_name, home_team_id)] = home_metrics
                parsed_period_stats[(period_name, away_team_id)] = away_metrics

            # Insert into match_period_stats
            for period_name in ("ALL", "1ST", "2ND"):
                for team_id in (home_team_id, away_team_id):
                    m_data = parsed_period_stats.get((period_name, team_id), {})
                    
                    g_count = goals_by_period_team.get((period_name, team_id), 0)
                    if period_name == "ALL":
                        if team_id == home_team_id and match.get("home_score") is not None:
                            g_count = match["home_score"]
                        elif team_id == away_team_id and match.get("away_score") is not None:
                            g_count = match["away_score"]

                    conn.execute("""
                        INSERT OR REPLACE INTO match_period_stats (
                            match_id, team_id, period, possession, corner_kicks, fouls, yellow_cards, red_cards, goals
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        match_id,
                        team_id,
                        period_name,
                        m_data.get("possession"),
                        m_data.get("corner_kicks", 0) if m_data.get("corner_kicks") is not None else 0,
                        m_data.get("fouls", 0) if m_data.get("fouls") is not None else 0,
                        m_data.get("yellow_cards", 0) if m_data.get("yellow_cards") is not None else 0,
                        m_data.get("red_cards", 0) if m_data.get("red_cards") is not None else 0,
                        g_count
                    ))

            log_scrape(conn, resource_type, resource_key, "success")
            
            # Execute conn.commit() IMMEDIATELY after each match
            conn.commit()
            total_processed += 1
            logger.info(f"Match {match_id} successfully saved to DB.")

            # Sleep naturally
            time.sleep(random.uniform(4.0, 7.0))

        except Exception as e:
            logger.error(f"Error scraping match {match_id}: {e}")
            log_scrape(conn, resource_type, resource_key, "failed", error_message=str(e))
            conn.commit()

    logger.info(f"Finished scraping match period stats. Total matches committed: {total_processed}")
    return total_processed
