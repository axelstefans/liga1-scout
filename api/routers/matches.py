"""
FastAPI router for match-level statistics and analytics.
"""

import sqlite3
from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status

from ..core.database import get_db
from services.flashscore_service import get_match_flashscore_stats

router = APIRouter(prefix="/matches", tags=["Matches"])


@router.get("/{match_id}/flashscore-stats", response_model=Dict[str, Any])
def get_match_flashscore_stats_endpoint(
    match_id: int,
    db: sqlite3.Connection = Depends(get_db),
):
    """
    Get detailed Flashscore team statistics for a specific match.
    Returns segregated home/away stats across 1T, 2T, and ALL match periods.
    """
    stats = get_match_flashscore_stats(db, match_id=match_id)
    if stats is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flashscore stats not found for this match",
        )
    return stats


def _build_sheet_01_chances(db: sqlite3.Connection, match_id: int) -> Dict[str, Any]:
    """
    Assemble complete tactical payload for Sheet 01 / 04 ('The result and the chances'):
    - Match metadata & scoreboard (home/away teams, scores, tournament, round, date)
    - 4 comparative header KPIs (xG, xGOT with npxG fallback, Shots, On Target)
    - Continuous 0'-90'+ xG Flow step chart anchored on goal incidents & chronological shots
    - Bidirectional Chance Balance metrics (Goals, xG/shot, Big chances, Inside box, Outside box)
    - Mirrored Shot Maps with normalized coordinates (x, y), xG, result, situation, body part
    """
    cursor = db.cursor()

    match_row = cursor.execute(
        """
        SELECT
            m.match_id,
            m.match_date,
            m.round,
            m.home_team_id,
            m.away_team_id,
            m.home_score,
            m.away_score,
            m.status,
            CASE WHEN strftime('%m', m.match_date) >= '06' THEN 'Clausura' ELSE 'Apertura' END AS tournament,
            ht.name AS home_name,
            ht.short_name AS home_short_name,
            ht.logo_url AS home_logo_url,
            ht.primary_color AS home_primary_color,
            at.name AS away_name,
            at.short_name AS away_short_name,
            at.logo_url AS away_logo_url,
            at.primary_color AS away_primary_color
        FROM matches m
        JOIN teams ht ON m.home_team_id = ht.team_id
        JOIN teams at ON m.away_team_id = at.team_id
        WHERE m.match_id = ?
        """,
        (match_id,),
    ).fetchone()

    if not match_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Match {match_id} not found",
        )

    home_id = int(match_row["home_team_id"])
    away_id = int(match_row["away_team_id"])
    home_score = int(match_row["home_score"] or 0)
    away_score = int(match_row["away_score"] or 0)

    # 1. Fetch team_match_metrics rows for home and away
    tmm_rows = cursor.execute(
        """
        SELECT *
        FROM team_match_metrics
        WHERE match_id = ?
        """,
        (match_id,),
    ).fetchall()
    tmm_by_team = {int(r["team_id"]): dict(r) for r in tmm_rows}
    tmm_home = tmm_by_team.get(home_id, {})
    tmm_away = tmm_by_team.get(away_id, {})

    # 2. Fetch Flashscore stats ('ALL' period) if available
    fs_rows = cursor.execute(
        """
        SELECT *
        FROM flashscore_match_team_stats
        WHERE match_id = ? AND period = 'ALL'
        """,
        (match_id,),
    ).fetchall()
    fs_by_team = {int(r["team_id"]): dict(r) for r in fs_rows if r["team_id"] is not None}
    fs_home = fs_by_team.get(home_id)
    fs_away = fs_by_team.get(away_id)

    # 3. Fetch all shots ordered chronologically by shot_id ASC
    shot_rows = cursor.execute(
        """
        SELECT
            ps.shot_id,
            ps.player_id,
            ps.is_home,
            ps.shot_type,
            ps.situation,
            ps.body_part,
            ps.coord_x,
            ps.coord_y,
            ps.distance_m,
            ps.goal_mouth_y,
            ps.goal_mouth_z,
            COALESCE(psx.calculated_xg, 0.0) AS xg,
            p.name AS player_name,
            p.shirt_number AS player_jersey
        FROM player_shots ps
        LEFT JOIN player_shots_xg psx ON ps.shot_id = psx.shot_id
        LEFT JOIN players p ON ps.player_id = p.player_id
        WHERE ps.match_id = ?
        ORDER BY ps.shot_id ASC
        """,
        (match_id,),
    ).fetchall()

    # 4. Fetch match goal incidents ordered by minute ASC, id ASC
    goal_rows = cursor.execute(
        """
        SELECT
            id,
            team_id,
            player_name,
            minute,
            period,
            is_corner_origin,
            incident_type
        FROM match_goal_incidents
        WHERE match_id = ?
        ORDER BY minute ASC, id ASC
        """,
        (match_id,),
    ).fetchall()

    # Process shots and normalize coordinates
    processed_shots = []
    for idx, r in enumerate(shot_rows):
        if r["coord_x"] is not None:
            raw_x = float(r["coord_x"])
            norm_x = round(max(0.0, min(100.0, 100.0 - (raw_x / 105.0) * 100.0)), 1)
        else:
            norm_x = 85.0

        if r["coord_y"] is not None:
            norm_y = round(max(0.0, min(100.0, float(r["coord_y"]))), 1)
        else:
            norm_y = 50.0

        raw_type = str(r["shot_type"] or "").strip().lower()
        if raw_type == "goal":
            result = "goal"
        elif raw_type in ("save", "saved"):
            result = "saved"
        elif raw_type in ("block", "blocked"):
            result = "blocked"
        else:
            result = "miss"

        raw_bp = str(r["body_part"] or "").strip().lower()
        if "right" in raw_bp:
            body_part = "right_foot"
        elif "left" in raw_bp:
            body_part = "left_foot"
        elif "head" in raw_bp:
            body_part = "head"
        else:
            body_part = "other"

        raw_sit = str(r["situation"] or "").strip().lower()
        if "fast-break" in raw_sit or "fast_break" in raw_sit:
            situation = "fast_break"
        elif "penalty" in raw_sit:
            situation = "penalty"
        elif "corner" in raw_sit:
            situation = "corner"
        elif any(k in raw_sit for k in ("set-piece", "set_piece", "free-kick", "throw-in")):
            situation = "set_piece"
        else:
            situation = "open_play"

        is_home_shot = bool(r["is_home"])
        xg_val = round(float(r["xg"] or 0.0), 3)
        jersey = int(r["player_jersey"]) if r["player_jersey"] is not None and int(r["player_jersey"]) > 0 else None

        processed_shots.append({
            "index": idx,
            "shot_id": int(r["shot_id"]),
            "is_home": is_home_shot,
            "team_id": home_id if is_home_shot else away_id,
            "x": norm_x,
            "y": norm_y,
            "distance_m": round(float(r["distance_m"] or 0.0), 1),
            "xg": xg_val,
            "result": result,
            "situation": situation,
            "body_part": body_part,
            "player_name": r["player_name"] or "Jugador",
            "player_jersey": jersey,
            "minute": None,
        })

    # Match goal shots to non-ownGoal incidents to anchor minutes accurately
    non_og_incidents_home = [dict(g) for g in goal_rows if int(g["team_id"]) == home_id and g["incident_type"] != "ownGoal"]
    non_og_incidents_away = [dict(g) for g in goal_rows if int(g["team_id"]) == away_id and g["incident_type"] != "ownGoal"]

    home_goal_cursor = 0
    away_goal_cursor = 0
    for s in processed_shots:
        if s["result"] == "goal":
            if s["is_home"] and home_goal_cursor < len(non_og_incidents_home):
                inc = non_og_incidents_home[home_goal_cursor]
                s["minute"] = int(inc["minute"] or 45)
                home_goal_cursor += 1
            elif (not s["is_home"]) and away_goal_cursor < len(non_og_incidents_away):
                inc = non_og_incidents_away[away_goal_cursor]
                s["minute"] = int(inc["minute"] or 45)
                away_goal_cursor += 1

    # Ensure anchored minutes are non-decreasing and interpolate remaining shots monotonically
    total_shots_n = len(processed_shots)
    anchors = [(-1, 1)]
    last_anchor_min = 1
    for s in processed_shots:
        if s["minute"] is not None:
            clamped_min = max(last_anchor_min, int(s["minute"]))
            s["minute"] = clamped_min
            anchors.append((s["index"], clamped_min))
            last_anchor_min = clamped_min

    max_goal_min = max([int(g["minute"] or 90) for g in goal_rows], default=90)
    final_minute = max(90, max_goal_min, last_anchor_min)
    anchors.append((total_shots_n, final_minute))

    for a_idx in range(len(anchors) - 1):
        i_start, m_start = anchors[a_idx]
        i_end, m_end = anchors[a_idx + 1]
        span_i = i_end - i_start
        span_m = max(0, m_end - m_start)
        for j in range(i_start + 1, i_end):
            ratio = (j - i_start) / float(span_i)
            interp_min = int(round(m_start + ratio * span_m))
            processed_shots[j]["minute"] = max(1, min(final_minute, interp_min))

    # Build cumulative xG flow points (0' to final_minute)
    own_goals = [
        {
            "minute": int(g["minute"] or 45),
            "is_home": int(g["team_id"]) == home_id,
            "player_name": g["player_name"] or "Autogol",
            "incident_type": "ownGoal",
        }
        for g in goal_rows
        if g["incident_type"] == "ownGoal"
    ]

    timeline_events = []
    for s in processed_shots:
        timeline_events.append({
            "minute": int(s["minute"] or 45),
            "order": s["index"],
            "kind": "shot",
            "shot": s,
        })
    for og_idx, og in enumerate(own_goals):
        timeline_events.append({
            "minute": og["minute"],
            "order": 1000 + og_idx,
            "kind": "own_goal",
            "own_goal": og,
        })

    timeline_events.sort(key=lambda ev: (ev["minute"], ev["order"]))

    cum_home_xg = 0.0
    cum_away_xg = 0.0
    flow_points = [
        {
            "minute": 0,
            "home_xg": 0.0,
            "away_xg": 0.0,
            "event_type": "start",
            "is_home": None,
            "shot_xg": 0.0,
            "player_name": None,
            "result": None,
            "shot_id": None,
        }
    ]

    for ev in timeline_events:
        if ev["kind"] == "shot":
            s = ev["shot"]
            if s["is_home"]:
                cum_home_xg = round(cum_home_xg + s["xg"], 3)
            else:
                cum_away_xg = round(cum_away_xg + s["xg"], 3)
            flow_points.append({
                "minute": ev["minute"],
                "home_xg": round(cum_home_xg, 2),
                "away_xg": round(cum_away_xg, 2),
                "event_type": "goal" if s["result"] == "goal" else "shot",
                "is_home": s["is_home"],
                "shot_xg": round(s["xg"], 2),
                "player_name": s["player_name"],
                "result": s["result"],
                "shot_id": s["shot_id"],
            })
        else:
            og = ev["own_goal"]
            flow_points.append({
                "minute": ev["minute"],
                "home_xg": round(cum_home_xg, 2),
                "away_xg": round(cum_away_xg, 2),
                "event_type": "own_goal",
                "is_home": og["is_home"],
                "shot_xg": 0.0,
                "player_name": f"{og['player_name']} (AG)",
                "result": "goal",
                "shot_id": None,
            })

    flow_points.append({
        "minute": final_minute,
        "home_xg": round(cum_home_xg, 2),
        "away_xg": round(cum_away_xg, 2),
        "event_type": "end",
        "is_home": None,
        "shot_xg": 0.0,
        "player_name": None,
        "result": None,
        "shot_id": None,
    })

    home_shots = [s for s in processed_shots if s["is_home"]]
    away_shots = [s for s in processed_shots if not s["is_home"]]

    # Compute comparative metrics (consistent between header, step chart, and chance balance)
    home_xg = round(float(tmm_home.get("xg_for") if tmm_home.get("xg_for") is not None else cum_home_xg), 2)
    away_xg = round(float(tmm_away.get("xg_for") if tmm_away.get("xg_for") is not None else cum_away_xg), 2)

    home_npxg = round(float(tmm_home.get("npxg_for") if tmm_home.get("npxg_for") is not None else home_xg), 2)
    away_npxg = round(float(tmm_away.get("npxg_for") if tmm_away.get("npxg_for") is not None else away_xg), 2)

    has_xgot = bool(
        fs_home is not None
        and fs_home.get("xgot") is not None
        and fs_away is not None
        and fs_away.get("xgot") is not None
    )
    home_xgot = round(float(fs_home["xgot"]), 2) if has_xgot and fs_home else None
    away_xgot = round(float(fs_away["xgot"]), 2) if has_xgot and fs_away else None

    home_shots_total = int(tmm_home.get("shots_for") if tmm_home.get("shots_for") is not None else len(home_shots))
    away_shots_total = int(tmm_away.get("shots_for") if tmm_away.get("shots_for") is not None else len(away_shots))

    home_sot = int(
        tmm_home.get("shots_on_target_for")
        if tmm_home.get("shots_on_target_for") is not None
        else sum(1 for s in home_shots if s["result"] in ("goal", "saved"))
    )
    away_sot = int(
        tmm_away.get("shots_on_target_for")
        if tmm_away.get("shots_on_target_for") is not None
        else sum(1 for s in away_shots if s["result"] in ("goal", "saved"))
    )

    home_inside_box = int(
        tmm_home.get("shots_inside_box_for")
        if tmm_home.get("shots_inside_box_for") is not None
        else sum(1 for s in home_shots if s["x"] >= 84.0 and 21.0 <= s["y"] <= 79.0)
    )
    away_inside_box = int(
        tmm_away.get("shots_inside_box_for")
        if tmm_away.get("shots_inside_box_for") is not None
        else sum(1 for s in away_shots if s["x"] >= 84.0 and 21.0 <= s["y"] <= 79.0)
    )

    home_outside_box = int(
        tmm_home.get("shots_outside_box_for")
        if tmm_home.get("shots_outside_box_for") is not None
        else max(0, home_shots_total - home_inside_box)
    )
    away_outside_box = int(
        tmm_away.get("shots_outside_box_for")
        if tmm_away.get("shots_outside_box_for") is not None
        else max(0, away_shots_total - away_inside_box)
    )

    home_xg_per_shot = round(home_xg / home_shots_total, 2) if home_shots_total > 0 else 0.0
    away_xg_per_shot = round(away_xg / away_shots_total, 2) if away_shots_total > 0 else 0.0

    has_fs_big_chances = bool(
        fs_home is not None
        and fs_home.get("big_chances") is not None
        and fs_away is not None
        and fs_away.get("big_chances") is not None
    )
    home_big_chances = (
        int(fs_home["big_chances"])
        if has_fs_big_chances and fs_home
        else sum(1 for s in home_shots if s["xg"] >= 0.30)
    )
    away_big_chances = (
        int(fs_away["big_chances"])
        if has_fs_big_chances and fs_away
        else sum(1 for s in away_shots if s["xg"] >= 0.30)
    )

    return {
        "match_id": int(match_row["match_id"]),
        "match_date": (match_row["match_date"] or "")[:10],
        "round": int(match_row["round"]) if match_row["round"] is not None else None,
        "tournament": match_row["tournament"],
        "season": "Liga 1 2026",
        "has_xgot": has_xgot,
        "has_flashscore_big_chances": has_fs_big_chances,
        "final_minute": final_minute,
        "home_team": {
            "team_id": home_id,
            "name": match_row["home_name"],
            "short_name": match_row["home_short_name"] or match_row["home_name"],
            "logo_url": match_row["home_logo_url"],
            "primary_color": match_row["home_primary_color"],
            "score": home_score,
        },
        "away_team": {
            "team_id": away_id,
            "name": match_row["away_name"],
            "short_name": match_row["away_short_name"] or match_row["away_name"],
            "logo_url": match_row["away_logo_url"],
            "primary_color": match_row["away_primary_color"],
            "score": away_score,
        },
        "metrics": {
            "home": {
                "goals": home_score,
                "xg": home_xg,
                "npxg": home_npxg,
                "xgot": home_xgot,
                "shots_total": home_shots_total,
                "shots_on_target": home_sot,
                "shots_inside_box": home_inside_box,
                "shots_outside_box": home_outside_box,
                "xg_per_shot": home_xg_per_shot,
                "big_chances": home_big_chances,
            },
            "away": {
                "goals": away_score,
                "xg": away_xg,
                "npxg": away_npxg,
                "xgot": away_xgot,
                "shots_total": away_shots_total,
                "shots_on_target": away_sot,
                "shots_inside_box": away_inside_box,
                "shots_outside_box": away_outside_box,
                "xg_per_shot": away_xg_per_shot,
                "big_chances": away_big_chances,
            },
        },
        "xg_flow": flow_points,
        "shots": {
            "home": home_shots,
            "away": away_shots,
        },
    }


@router.get("/{match_id}/sheet-01-chances", response_model=Dict[str, Any])
def get_match_sheet_01_chances_endpoint(
    match_id: int,
    db: sqlite3.Connection = Depends(get_db),
):
    """
    Get complete tactical data for Match Report Sheet 01 / 04 ('The result and the chances').
    """
    return _build_sheet_01_chances(db, match_id=match_id)
