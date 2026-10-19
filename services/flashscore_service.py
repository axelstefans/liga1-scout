"""
Service layer for Flashscore match analytics and statistics queries.
"""

from typing import Any, Dict, Optional, List
import sqlite3
import logging

from scraper.flashscore_parser import ALL_STAT_COLUMNS

logger = logging.getLogger(__name__)


def get_match_flashscore_stats(
    db_conn: sqlite3.Connection,
    match_id: int
) -> Optional[Dict[str, Any]]:
    """
    Queries matches joined with teams and flashscore_match_team_stats
    to structure match-level statistics segregated by period ('1T', '2T', 'ALL')
    and team ('home', 'away').

    Args:
        db_conn: SQLite database connection.
        match_id: Internal match identifier.

    Returns:
        Structured dictionary if found, None if no statistics exist for this match.
    """
    cursor = db_conn.cursor()

    # 1. Fetch match metadata & teams
    match_row = cursor.execute(
        """
        SELECT
            m.match_id,
            m.home_team_id,
            m.away_team_id,
            th.name AS home_name,
            th.short_name AS home_short_name,
            th.flashscore_id AS home_fs,
            ta.name AS away_name,
            ta.short_name AS away_short_name,
            ta.flashscore_id AS away_fs
        FROM matches m
        LEFT JOIN teams th ON m.home_team_id = th.team_id
        LEFT JOIN teams ta ON m.away_team_id = ta.team_id
        WHERE m.match_id = ?
        """,
        (match_id,)
    ).fetchone()

    # 2. Query flashscore_match_team_stats by match_id
    stats_rows = cursor.execute(
        """
        SELECT *
        FROM flashscore_match_team_stats
        WHERE match_id = ?
        """,
        (match_id,)
    ).fetchall()

    # Fallback: if no rows by match_id, check if match exists with a flashscore_event_id or flashscore_id column
    if not stats_rows and match_row:
        keys = match_row.keys() if hasattr(match_row, "keys") else []
        for col_name in ("flashscore_event_id", "flashscore_id"):
            if col_name in keys and match_row[col_name]:
                stats_rows = cursor.execute(
                    """
                    SELECT *
                    FROM flashscore_match_team_stats
                    WHERE flashscore_event_id = ?
                    """,
                    (match_row[col_name],)
                ).fetchall()
                if stats_rows:
                    break

    if not stats_rows:
        return None

    # Derive event_id from rows
    flashscore_event_id = stats_rows[0]["flashscore_event_id"] if stats_rows else None

    # Determine home and away identifiers
    if match_row:
        home_team_id = match_row["home_team_id"]
        away_team_id = match_row["away_team_id"]
        home_team = {
            "team_id": home_team_id,
            "name": match_row["home_name"],
            "flashscore_id": match_row["home_fs"],
        }
        away_team = {
            "team_id": away_team_id,
            "name": match_row["away_name"],
            "flashscore_id": match_row["away_fs"],
        }
    else:
        # Fallback if match row is missing from matches table: extract from rows and teams
        unique_tids = []
        for r in stats_rows:
            tid = r["team_id"]
            if tid and tid not in unique_tids:
                unique_tids.append(tid)

        home_team_id = unique_tids[0] if len(unique_tids) > 0 else None
        away_team_id = unique_tids[1] if len(unique_tids) > 1 else None

        def _lookup_team(t_id):
            if not t_id:
                return {"team_id": None, "name": None, "flashscore_id": None}
            t_row = cursor.execute("SELECT name, flashscore_id FROM teams WHERE team_id = ?", (t_id,)).fetchone()
            if t_row:
                return {"team_id": t_id, "name": t_row["name"], "flashscore_id": t_row["flashscore_id"]}
            return {"team_id": t_id, "name": None, "flashscore_id": None}

        home_team = _lookup_team(home_team_id)
        away_team = _lookup_team(away_team_id)

    # 3. Structure periods mapping
    periods: Dict[str, Dict[str, Optional[Dict[str, Any]]]] = {
        "1T": {"home": None, "away": None},
        "2T": {"home": None, "away": None},
        "ALL": {"home": None, "away": None},
    }

    for row in stats_rows:
        period_key = row["period"]
        if period_key not in periods:
            continue

        # Extract all 44 metrics
        metrics: Dict[str, Any] = {}
        for col in ALL_STAT_COLUMNS:
            metrics[col] = row[col]

        # Classify as home or away
        is_home = False
        if home_team["team_id"] is not None and row["team_id"] == home_team["team_id"]:
            is_home = True
        elif home_team["flashscore_id"] is not None and row["flashscore_team_id"] == home_team["flashscore_id"]:
            is_home = True

        if is_home:
            periods[period_key]["home"] = metrics
        else:
            periods[period_key]["away"] = metrics

    return {
        "match_id": match_id,
        "flashscore_event_id": flashscore_event_id,
        "home_team": home_team,
        "away_team": away_team,
        "periods": periods,
    }


def get_team_flashscore_summary(
    db_conn: sqlite3.Connection,
    team_id: int,
    tournament: Optional[str] = "all",
) -> Optional[Dict[str, Any]]:
    """
    Aggregates Flashscore statistics for a team across all synced matches,
    breaking down 1T vs 2T performance, territory metrics, and goalkeeper shot-stopping efficiency.

    Args:
        db_conn: SQLite database connection.
        team_id: Internal team ID.
        tournament: Filter by tournament ('all', 'Apertura', or 'Clausura').

    Returns:
        Structured dictionary if team exists, None if team_id not found in teams table.
    """
    cursor = db_conn.cursor()

    # 1. Validate team existence in teams table
    team_row = cursor.execute(
        "SELECT team_id, name FROM teams WHERE team_id = ?",
        (team_id,)
    ).fetchone()

    if not team_row:
        return None

    team_name = team_row["name"]

    # Tournament filter clause
    norm_tourn = tournament.strip().lower() if tournament else "all"
    tourn_clause = ""
    tourn_params: List[Any] = []
    if norm_tourn in ("apertura", "clausura"):
        target_tourn = "Apertura" if norm_tourn == "apertura" else "Clausura"
        tourn_clause = "AND CASE WHEN strftime('%m', m.match_date) >= '06' THEN 'Clausura' ELSE 'Apertura' END = ?"
        tourn_params = [target_tourn]

    # 2. Query aggregated metrics grouped by period, joining opponent's metrics
    agg_query = f"""
    SELECT
        t.period,
        COUNT(DISTINCT t.flashscore_event_id) AS match_count,
        AVG(t.xg) AS avg_xg,
        AVG(opp.xg) AS avg_xg_conceded,
        AVG(t.shots_total) AS avg_shots_total,
        AVG(t.shots_on_target) AS avg_shots_on_target,
        AVG(t.corner_kicks) AS avg_corner_kicks,
        AVG(t.xgot) AS avg_xgot,
        AVG(t.possession) AS avg_possession,
        AVG(t.passes_completed) AS avg_passes_completed,
        AVG(t.passes_final_third_completed) AS avg_passes_final_third_completed,
        AVG(t.touches_in_box) AS avg_touches_in_box,
        AVG(t.crosses_total) AS avg_crosses_total,
        AVG(t.crosses_completed) AS avg_crosses_completed,
        COALESCE(SUM(t.headed_goals), 0) AS total_headed_goals,
        COALESCE(SUM(t.big_chances), 0) AS total_big_chances,
        COALESCE(SUM(t.big_chances_scored), 0) AS total_big_chances_scored,
        COALESCE(SUM(t.big_chances_missed), 0) AS total_big_chances_missed,
        COALESCE(SUM(COALESCE(t.xgot_faced, opp.xgot, 0)), 0) AS total_xgot_faced,
        COALESCE(SUM(COALESCE(t.goals_conceded, 0)), 0) AS total_goals_conceded,
        COALESCE(SUM(COALESCE(t.goals_prevented, 0)), 0) AS total_goals_prevented
    FROM flashscore_match_team_stats t
    JOIN matches m ON t.match_id = m.match_id
    LEFT JOIN flashscore_match_team_stats opp
        ON t.flashscore_event_id = opp.flashscore_event_id
       AND t.period = opp.period
       AND t.flashscore_team_id != opp.flashscore_team_id
    WHERE t.team_id = ?
      AND m.status = 'played'
      AND (m.season_id = 88529 OR strftime('%Y', m.match_date) = '2026')
      {tourn_clause}
    GROUP BY t.period
    """
    agg_params = [team_id] + tourn_params
    agg_rows = cursor.execute(agg_query, tuple(agg_params)).fetchall()
    rows_by_period = {r["period"]: r for r in agg_rows}

    # Matches analyzed: distinct matches with 'ALL' period (or max of periods)
    matches_analyzed = (
        rows_by_period["ALL"]["match_count"]
        if "ALL" in rows_by_period
        else (max((r["match_count"] for r in agg_rows), default=0))
    )

    empty_period = {
        "avg_xg": 0.0,
        "avg_xg_conceded": 0.0,
        "avg_shots_total": 0.0,
        "avg_shots_on_target": 0.0,
        "avg_corner_kicks": 0.0,
        "avg_xgot": 0.0,
        "avg_possession": 0.0,
        "avg_passes_completed": 0.0,
        "avg_passes_final_third_completed": 0.0,
        "avg_touches_in_box": 0.0,
        "xgot_faced": 0.0,
        "goals_conceded": 0,
        "goals_prevented": 0.0,
        "avg_crosses_total": 0.0,
        "avg_crosses_completed": 0.0,
        "cross_accuracy_pct": 0.0,
        "total_headed_goals": 0,
        "total_big_chances": 0,
        "total_big_chances_scored": 0,
        "total_big_chances_missed": 0,
        "big_chances_conversion_pct": 0.0,
    }

    if matches_analyzed == 0:
        return {
            "team_id": team_id,
            "team_name": team_name,
            "tournament": tournament or "all",
            "matches_analyzed": 0,
            "periods": {
                "1T": dict(empty_period),
                "2T": dict(empty_period),
                "ALL": dict(empty_period),
            },
            "goalkeeper_efficiency": {
                "xgot_faced": 0.0,
                "goals_conceded": 0,
                "goals_prevented": 0.0,
                "prevented_per_match": 0.0,
            },
        }

    def _format_period(r):
        if not r:
            return dict(empty_period)
        total_xgot = round(float(r["total_xgot_faced"] or 0.0), 4)
        total_gc = int(r["total_goals_conceded"] or 0)
        crosses_tot = round(float(r["avg_crosses_total"] or 0.0), 1) if "avg_crosses_total" in r.keys() else 0.0
        crosses_comp = round(float(r["avg_crosses_completed"] or 0.0), 1) if "avg_crosses_completed" in r.keys() else 0.0
        cross_acc = round((crosses_comp * 100.0) / crosses_tot, 1) if crosses_tot > 0 else 0.0
        headed_g = int(r["total_headed_goals"] or 0) if "total_headed_goals" in r.keys() else 0
        big_ch = int(r["total_big_chances"] or 0) if "total_big_chances" in r.keys() else 0
        big_ch_sc = int(r["total_big_chances_scored"] or 0) if "total_big_chances_scored" in r.keys() else 0
        big_ch_ms = int(r["total_big_chances_missed"] or 0) if "total_big_chances_missed" in r.keys() else 0
        big_ch_conv = round((big_ch_sc * 100.0) / big_ch, 1) if big_ch > 0 else 0.0
        return {
            "avg_xg": round(float(r["avg_xg"] or 0.0), 4),
            "avg_xg_conceded": round(float(r["avg_xg_conceded"] or 0.0), 4),
            "avg_shots_total": round(float(r["avg_shots_total"] or 0.0), 2),
            "avg_shots_on_target": round(float(r["avg_shots_on_target"] or 0.0), 2),
            "avg_corner_kicks": round(float(r["avg_corner_kicks"] or 0.0), 2) if "avg_corner_kicks" in r.keys() else 0.0,
            "avg_xgot": round(float(r["avg_xgot"] or 0.0), 4),
            "avg_possession": round(float(r["avg_possession"] or 0.0), 1),
            "avg_passes_completed": round(float(r["avg_passes_completed"] or 0.0), 1),
            "avg_passes_final_third_completed": round(float(r["avg_passes_final_third_completed"] or 0.0), 1),
            "avg_touches_in_box": round(float(r["avg_touches_in_box"] or 0.0), 1),
            "xgot_faced": total_xgot,
            "goals_conceded": total_gc,
            "goals_prevented": round(total_xgot - total_gc, 4),
            "avg_crosses_total": crosses_tot,
            "avg_crosses_completed": crosses_comp,
            "cross_accuracy_pct": cross_acc,
            "total_headed_goals": headed_g,
            "total_big_chances": big_ch,
            "total_big_chances_scored": big_ch_sc,
            "total_big_chances_missed": big_ch_ms,
            "big_chances_conversion_pct": big_ch_conv,
        }

    periods = {
        "1T": _format_period(rows_by_period.get("1T")),
        "2T": _format_period(rows_by_period.get("2T")),
        "ALL": _format_period(rows_by_period.get("ALL")),
    }

    all_p = periods["ALL"]
    xgot_faced = all_p["xgot_faced"]
    goals_conceded = all_p["goals_conceded"]
    goals_prevented = all_p["goals_prevented"]
    prevented_per_match = round(goals_prevented / matches_analyzed, 4) if matches_analyzed > 0 else 0.0

    goalkeeper_efficiency = {
        "xgot_faced": xgot_faced,
        "goals_conceded": goals_conceded,
        "goals_prevented": goals_prevented,
        "prevented_per_match": prevented_per_match,
    }

    return {
        "team_id": team_id,
        "team_name": team_name,
        "tournament": tournament or "all",
        "matches_analyzed": matches_analyzed,
        "periods": periods,
        "goalkeeper_efficiency": goalkeeper_efficiency,
    }

