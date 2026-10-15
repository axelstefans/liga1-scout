"""
Parser and database service for Flashscore match team statistics.

Handles parsing GraphQL pq_graphql payloads, mapping canonical team hashes,
resolving internal match fixtures, and persisting to SQLite.
"""

from typing import Any, Dict, List, Optional
import sqlite3
import logging

from .flashscore_mapping import (
    KNOWN_FLASHSCORE_TEAMS,
    FLASHSCORE_TO_TEAM_ID,
    get_flashscore_team_mapping,
)

logger = logging.getLogger(__name__)

# Mapping from Flashscore eventStageId to internal period string
STAGE_TO_PERIOD: Dict[int, str] = {
    74: "ALL",
    12: "1T",
    13: "2T",
}

# Mapping from Flashscore typeId to database column names in flashscore_match_team_stats
TYPE_ID_MAP: Dict[str, str] = {
    # Shot & Attacking metrics
    "expected_goals": "xg",
    "xg_on_target": "xgot",
    "goal_attempts": "shots_total",
    "shots_on_goal": "shots_on_target",
    "shots_off_goal": "shots_off_target",
    "blocked_shots": "shots_blocked",
    "shots_inside_box": "shots_inside_box",
    "shots_outside_box": "shots_outside_box",
    "big_chances": "big_chances",
    "big_chances_scored": "big_chances_scored",
    "big_chances_missed": "big_chances_missed",
    "hit_woodwork": "hit_woodwork",
    "headed_goals": "headed_goals",

    # Possession & Passing metrics
    "ball_possession": "possession",
    "total_passes": "passes_total",
    "calculated_completed_passes": "passes_completed",
    "passes_in_the_final_third": "passes_final_third_total",
    "calculated_passes_in_the_final_third_completed": "passes_final_third_completed",
    "total_crosses": "crosses_total",
    "calculated_crosses": "crosses_completed",
    "long_balls_total": "long_balls_total",
    "calculated_long_balls_completed": "long_balls_completed",
    "expected_assists": "xa",
    "key_passes": "key_passes",
    "touches_in_opposition_box": "touches_in_box",
    "throw_in": "throw_ins",

    # Defending & Duels metrics
    "fouls": "fouls",
    "free_kicks": "free_kicks",
    "duels_won": "duels_won",
    "total_tackles": "tackles_total",
    "calculated_tackles_won": "tackles_won",
    "interceptions": "interceptions",
    "clearances_total": "clearances",
    "offsides": "offsides",
    "corner_kicks": "corner_kicks",
    "errors_lead_to_a_shot": "errors_lead_to_shot",
    "errors_lead_to_a_goal": "errors_lead_to_goal",

    # Goalkeeping metrics
    "goalkeeper_saves": "saves",
    "xgot_faced": "xgot_faced",
    "goals_prevented": "goals_prevented",
    "goal_kicks": "goal_kicks",
    "result_against": "goals_conceded",

    # Discipline
    "yellow_cards": "yellow_cards",
    "red_cards": "red_cards",
}

# Explicit definition of columns expecting floating-point values
FLOAT_COLUMNS = {
    "xg",
    "xgot",
    "possession",
    "xa",
    "xgot_faced",
    "goals_prevented",
}

# All stat metric columns in flashscore_match_team_stats table
ALL_STAT_COLUMNS = [
    # Shot & Attacking
    "xg", "xgot", "shots_total", "shots_on_target", "shots_off_target",
    "shots_blocked", "shots_inside_box", "shots_outside_box", "big_chances",
    "big_chances_scored", "big_chances_missed", "hit_woodwork", "headed_goals",
    # Possession & Passing
    "possession", "passes_total", "passes_completed", "passes_final_third_total",
    "passes_final_third_completed", "crosses_total", "crosses_completed",
    "long_balls_total", "long_balls_completed", "xa", "key_passes",
    "touches_in_box", "throw_ins",
    # Defending & Duels
    "fouls", "free_kicks", "duels_won", "tackles_total", "tackles_won",
    "interceptions", "clearances", "offsides", "corner_kicks",
    "errors_lead_to_shot", "errors_lead_to_goal",
    # Goalkeeping
    "saves", "xgot_faced", "goals_prevented", "goal_kicks", "goals_conceded",
    # Discipline
    "yellow_cards", "red_cards"
]


def _parse_entry_value(entry: Dict[str, Any], is_float: bool = False) -> Optional[Any]:
    """
    Parses a single TeamStatsEntry value, preferring rawValue when available.
    """
    raw_val = entry.get("rawValue")
    val = entry.get("value")

    # Pick rawValue first, fallback to value
    target = raw_val if raw_val is not None else val
    if target is None:
        return None

    if isinstance(target, (int, float)):
        return float(target) if is_float else int(target)

    if isinstance(target, str):
        cleaned = target.replace("%", "").strip()
        try:
            return float(cleaned) if is_float else int(float(cleaned))
        except (ValueError, TypeError):
            logger.debug(f"Could not convert value {target} to numeric")
            return None

    return None


def resolve_match_id(
    db_conn: Optional[sqlite3.Connection],
    flashscore_event_id: str,
    home_fs_id: str,
    away_fs_id: str,
    match_date: Optional[str] = None
) -> Optional[int]:
    """
    Resolves the internal matches.match_id given Flashscore event and team hashes.

    1. Translates home_fs_id and away_fs_id to internal team IDs via teams.flashscore_id
       (falling back to KNOWN_FLASHSCORE_TEAMS if not yet seeded).
    2. Searches the matches table for a match matching home_team_id and away_team_id.
       - If match_date is provided, narrows down by date prefix (YYYY-MM-DD).
       - If no match found by date or date is None, finds the most relevant match for the matchup.
    3. Returns the internal match_id integer, or None if unresolvable.
    """
    if db_conn is None:
        return None

    # Step 0: Check if match_id was already assigned in flashscore_match_team_stats
    try:
        cur = db_conn.cursor()
        existing = cur.execute(
            "SELECT match_id FROM flashscore_match_team_stats WHERE flashscore_event_id = ? AND match_id IS NOT NULL LIMIT 1",
            (flashscore_event_id,)
        ).fetchone()
        if existing and existing[0] is not None:
            return int(existing[0])
    except Exception:
        pass

    # Step 1: Look up internal team IDs
    team_mapping = get_flashscore_team_mapping(db_conn)
    home_team_id = team_mapping.get(home_fs_id)
    away_team_id = team_mapping.get(away_fs_id)

    if home_team_id is None or away_team_id is None:
        logger.warning(
            f"Could not resolve internal team IDs for match: "
            f"home_fs_id={home_fs_id} (team_id={home_team_id}), away_fs_id={away_fs_id} (team_id={away_team_id})"
        )
        return None

    cur = db_conn.cursor()

    # Step 2: Query matches table
    # 2a. If match_date is provided, try exact / date-prefix match first
    if match_date:
        date_prefix = match_date[:10]  # YYYY-MM-DD
        row = cur.execute(
            """
            SELECT match_id FROM matches
            WHERE home_team_id = ? AND away_team_id = ?
              AND match_date LIKE ?
            ORDER BY (CASE WHEN status = 'played' THEN 0 ELSE 1 END), match_date DESC LIMIT 1
            """,
            (home_team_id, away_team_id, f"{date_prefix}%")
        ).fetchone()
        if row:
            return int(row[0])

        # 2b. Try date proximity within 2 days (UTC timezone / local time variance)
        try:
            row = cur.execute(
                """
                SELECT match_id, abs(julianday(substr(match_date, 1, 10)) - julianday(?)) AS diff
                FROM matches
                WHERE home_team_id = ? AND away_team_id = ?
                ORDER BY (CASE WHEN status = 'played' THEN 0 ELSE 1 END), diff ASC LIMIT 1
                """,
                (date_prefix, home_team_id, away_team_id)
            ).fetchone()
            if row and row[1] is not None and float(row[1]) <= 2.0:
                return int(row[0])
        except Exception:
            pass

    # 2c. Fallback without date restriction (matchup between the two teams)
    row = cur.execute(
        """
        SELECT match_id FROM matches
        WHERE home_team_id = ? AND away_team_id = ?
        ORDER BY (CASE WHEN status = 'played' THEN 0 ELSE 1 END), match_date DESC LIMIT 1
        """,
        (home_team_id, away_team_id)
    ).fetchone()
    if row:
        return int(row[0])

    # 2d. Inverted home/away matchup with date prefix fallback (if perspective was swapped)
    if match_date:
        date_prefix = match_date[:10]
        row = cur.execute(
            """
            SELECT match_id FROM matches
            WHERE home_team_id = ? AND away_team_id = ?
              AND match_date LIKE ?
            ORDER BY (CASE WHEN status = 'played' THEN 0 ELSE 1 END), match_date DESC LIMIT 1
            """,
            (away_team_id, home_team_id, f"{date_prefix}%")
        ).fetchone()
        if row:
            return int(row[0])

    logger.warning(
        f"No matching fixture found in matches table for home_team_id={home_team_id}, "
        f"away_team_id={away_team_id}, match_date={match_date}"
    )
    return None


def parse_flashscore_team_stats(
    raw_data: Any,
    match_id: Optional[int] = None,
    flashscore_event_id: Optional[str] = None,
    team_mapping: Optional[Dict[str, int]] = None,
    db_conn: Optional[sqlite3.Connection] = None,
    match_date: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Iterates over the entries in the raw Flashscore GraphQL teamStats payload,
    groups by (flashscore_team_id, period), maps the typeId values, and returns
    structured dictionaries matching the flashscore_match_team_stats table schema.

    Args:
        raw_data: Raw JSON dict or list from Flashscore.
        match_id: Optional internal integer match_id to associate.
        flashscore_event_id: Optional event ID string (e.g. 'QPinjf7b').
        team_mapping: Optional dict mapping flashscore_team_id to internal team_id integer.
        db_conn: Optional SQLite connection used for automatic team and match resolution.
        match_date: Optional date string used when resolving match_id against the database.

    Returns:
        List of structured dictionaries ready for insertion into SQLite.
    """
    # Extract entries list gracefully across potential payload nestings
    entries = []
    if isinstance(raw_data, dict):
        if "data" in raw_data and isinstance(raw_data["data"], dict):
            find_event = raw_data["data"].get("findEventById") or {}
            team_stats = find_event.get("teamStats") or {}
            entries = team_stats.get("entries") or []
        elif "findEventById" in raw_data and isinstance(raw_data["findEventById"], dict):
            team_stats = raw_data["findEventById"].get("teamStats") or {}
            entries = team_stats.get("entries") or []
        elif "teamStats" in raw_data and isinstance(raw_data["teamStats"], dict):
            entries = raw_data["teamStats"].get("entries") or []
        elif "entries" in raw_data and isinstance(raw_data["entries"], list):
            entries = raw_data["entries"]
    elif isinstance(raw_data, list):
        entries = raw_data

    if not entries:
        logger.warning("No team stats entries found in Flashscore raw data.")
        return []

    # If event_id not supplied, check if present in root (when raw_data is a dict)
    event_id = flashscore_event_id
    if not event_id and isinstance(raw_data, dict):
        event_id = raw_data.get("eventId")
    if not event_id:
        event_id = "UNKNOWN_EVENT"

    # Resolve team mapping: passed dictionary > db lookup > static fallback
    if team_mapping is not None:
        team_map = dict(team_mapping)
    elif db_conn is not None:
        team_map = get_flashscore_team_mapping(db_conn)
    else:
        team_map = dict(FLASHSCORE_TO_TEAM_ID)

    # Collect unique teams in appearance order (home team appears first in Flashscore)
    unique_teams: List[str] = []
    for entry in entries:
        tid = entry.get("teamId")
        if tid and tid not in unique_teams:
            unique_teams.append(tid)

    # Automatically resolve match_id if not explicitly provided and db_conn is available
    resolved_match_id = match_id
    if resolved_match_id is None and db_conn is not None and len(unique_teams) >= 2:
        home_fs = unique_teams[0]
        away_fs = unique_teams[1]
        resolved_match_id = resolve_match_id(
            db_conn=db_conn,
            flashscore_event_id=event_id,
            home_fs_id=home_fs,
            away_fs_id=away_fs,
            match_date=match_date,
        )

    # Group entries by (team_id, period)
    # Target groups: (team_id, 'ALL'), (team_id, '1T'), (team_id, '2T')
    grouped_stats: Dict[tuple, Dict[str, Any]] = {}

    for entry in entries:
        stage_id = entry.get("eventStageId")
        period = STAGE_TO_PERIOD.get(stage_id)
        if not period:
            # Skip unknown stages outside 74 (ALL), 12 (1T), 13 (2T)
            continue

        fs_team_id = entry.get("teamId")
        if not fs_team_id:
            continue

        group_key = (fs_team_id, period)
        if group_key not in grouped_stats:
            row: Dict[str, Any] = {
                "match_id": resolved_match_id,
                "flashscore_event_id": event_id,
                "team_id": team_map.get(fs_team_id),
                "flashscore_team_id": fs_team_id,
                "period": period,
            }
            # Initialize all metrics to None
            for col in ALL_STAT_COLUMNS:
                row[col] = None
            grouped_stats[group_key] = row

        type_id = entry.get("typeId")
        col_name = TYPE_ID_MAP.get(type_id)
        if col_name:
            is_float = col_name in FLOAT_COLUMNS
            parsed_val = _parse_entry_value(entry, is_float=is_float)
            grouped_stats[group_key][col_name] = parsed_val

    # Return list of mapped records
    return list(grouped_stats.values())


def insert_flashscore_team_stats(
    db_conn: sqlite3.Connection,
    rows: List[Dict[str, Any]],
) -> int:
    """
    Inserts or replaces rows into flashscore_match_team_stats table.

    Args:
        db_conn: SQLite database connection.
        rows: List of dictionaries matching the flashscore_match_team_stats schema.

    Returns:
        Number of rows inserted.
    """
    if not rows:
        return 0

    cols = [
        "match_id",
        "flashscore_event_id",
        "team_id",
        "flashscore_team_id",
        "period",
    ] + ALL_STAT_COLUMNS

    col_names = ", ".join(cols)
    placeholders = ", ".join(["?"] * len(cols))
    sql = f"INSERT OR REPLACE INTO flashscore_match_team_stats ({col_names}) VALUES ({placeholders})"

    records = [[r.get(c) for c in cols] for r in rows]
    cursor = db_conn.cursor()
    cursor.executemany(sql, records)
    db_conn.commit()
    logger.info(f"Successfully inserted/updated {len(records)} rows in flashscore_match_team_stats.")
    return len(records)


def process_and_save_flashscore_stats(
    db_conn: sqlite3.Connection,
    raw_data: Any,
    match_id: Optional[int] = None,
    flashscore_event_id: Optional[str] = None,
    match_date: Optional[str] = None,
    team_mapping: Optional[Dict[str, int]] = None,
) -> List[Dict[str, Any]]:
    """
    Parses Flashscore stats payload, resolving team_id and match_id against the database,
    and inserts them into flashscore_match_team_stats.

    Args:
        db_conn: SQLite connection.
        raw_data: Raw JSON payload.
        match_id: Optional override for internal match ID.
        flashscore_event_id: Optional event ID.
        match_date: Optional match date string (e.g. '2026-10-11').
        team_mapping: Optional override mapping dictionary.

    Returns:
        List of parsed and saved rows.
    """
    rows = parse_flashscore_team_stats(
        raw_data=raw_data,
        match_id=match_id,
        flashscore_event_id=flashscore_event_id,
        team_mapping=team_mapping,
        db_conn=db_conn,
        match_date=match_date,
    )
    insert_flashscore_team_stats(db_conn, rows)
    return rows
