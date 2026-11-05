"""
Data Hub builder and helper logic for Match Report Sheet 03
('Data Hub Estadístico' / Statistical Consensus & Deep Metrics).
"""

import sqlite3
from typing import Any, Dict, List, Optional, Tuple, Union
from fastapi import HTTPException, status
from .matches_sheet_03_stadiums import get_stadium_info


def _safe_float(val: Any, default: float = 0.0, round_digits: Optional[int] = None) -> float:
    try:
        if val is None:
            return default
        f = float(val)
        return round(f, round_digits) if round_digits is not None else f
    except (ValueError, TypeError):
        return default


def _safe_int(val: Any, default: int = 0) -> int:
    try:
        if val is None:
            return default
        return int(round(float(val)))
    except (ValueError, TypeError):
        return default


def _safe_pct(num: float, den: float, round_digits: int = 1) -> float:
    return round((num * 100.0) / den, round_digits) if den and den > 0 else 0.0


def fmt_stat(val: Any, kind: str = "int") -> str:
    """Format statistical numbers strictly without losing fixed trailing decimals or signs."""
    if val is None:
        return "-"
    if kind == "float2":
        return f"{float(val):.2f}"
    if kind == "float1":
        return f"{float(val):.1f}"
    if kind == "pct":
        return f"{float(val):.1f}%"
    if kind == "dist":
        return f"{float(val):.1f} m"
    if kind == "prevented":
        f = float(val)
        return f"{f:+.2f}" if f != 0 else "+0.00"
    return str(val)


def format_player_name(name: str, max_len: int = 20) -> str:
    """Format player names, abbreviating to Initial + Surname if exceeding max_len."""
    name = (name or "N/A").strip()
    if len(name) <= max_len:
        return name
    parts = name.split()
    if len(parts) == 1:
        return name[:max_len]
    elif len(parts) == 2:
        abbr = f"{parts[0][0]}. {parts[1]}"
    elif len(parts) == 3:
        abbr = f"{parts[0][0]}.{parts[1][0]}. {parts[2]}"
    else:
        abbr = f"{''.join(p[0] + '.' for p in parts[:-1])} {parts[-1]}"
    if len(abbr) > max_len:
        abbr = f"{parts[0][0]}. {parts[-1]}"
    return abbr[:max_len]


def _row(key: str, label: str, home_val: Any, away_val: Any, source: str, unit: Optional[str] = None, higher_is_better: bool = True) -> Dict[str, Any]:
    return {"key": key, "label": label, "home_val": home_val, "away_val": away_val, "source": source, "unit": unit, "higher_is_better": higher_is_better}


def _get_team_player_performances(cursor: sqlite3.Cursor, match_id: int, team_id: int, is_home: bool, opponent_score: int) -> List[Dict[str, Any]]:
    try:
        pms_rows = cursor.execute(
            """
            SELECT pms.player_id, p.shirt_number, p.name, pms.position, pms.was_substitute, pms.minutes_played,
                   pms.replaced_player_id, pms.sofascore_rating, pms.goals, pms.assists, pms.expected_goals,
                   pms.total_shots, pms.shots_on_target, pms.key_passes, pms.accurate_passes, pms.accurate_passes_pct,
                   pms.tackles, pms.interceptions, pms.clearances, pms.saves,
                   COALESCE(pms.fouls, 0) AS fouls, COALESCE(pms.was_fouled, 0) AS was_fouled
            FROM player_match_stats pms
            JOIN players p ON pms.player_id = p.player_id
            WHERE pms.match_id = ? AND pms.team_id = ? AND pms.minutes_played IS NOT NULL AND pms.minutes_played > 0
            ORDER BY pms.was_substitute ASC, pms.minutes_played DESC, pms.id ASC
            """,
            (match_id, team_id),
        ).fetchall()
    except sqlite3.OperationalError:
        pms_rows = cursor.execute(
            """
            SELECT pms.player_id, p.shirt_number, p.name, pms.position, pms.was_substitute, pms.minutes_played,
                   pms.replaced_player_id, pms.sofascore_rating, pms.goals, pms.assists, pms.expected_goals,
                   pms.total_shots, pms.shots_on_target, pms.key_passes, pms.accurate_passes, pms.accurate_passes_pct,
                   pms.tackles, pms.interceptions, pms.clearances, pms.saves,
                   0 AS fouls, 0 AS was_fouled
            FROM player_match_stats pms
            JOIN players p ON pms.player_id = p.player_id
            WHERE pms.match_id = ? AND pms.team_id = ? AND pms.minutes_played IS NOT NULL AND pms.minutes_played > 0
            ORDER BY pms.was_substitute ASC, pms.minutes_played DESC, pms.id ASC
            """,
            (match_id, team_id),
        ).fetchall()

    raw_players = [dict(r) for r in pms_rows]
    starters_map = {p["player_id"]: p for p in raw_players if not bool(p["was_substitute"])}
    replaced_ids = {p["replaced_player_id"] for p in raw_players if p.get("replaced_player_id")}
    missing_ids = [rid for rid in replaced_ids if rid not in starters_map]
    replaced_names: Dict[int, str] = {}
    for r_id in missing_ids:
        r_row = cursor.execute("SELECT name FROM players WHERE player_id = ?", (r_id,)).fetchone()
        if r_row:
            replaced_names[r_id] = r_row["name"]

    p_counts = cursor.execute("SELECT player_id, COUNT(*) as tot, SUM(is_successful) as comp FROM player_passes WHERE match_id = ? GROUP BY player_id", (match_id,)).fetchall()
    passes_map = {r["player_id"]: (r["tot"], r["comp"]) for r in p_counts}

    rec_counts = cursor.execute("SELECT player_id, COUNT(*) as cnt FROM player_defensive_actions WHERE match_id = ? AND action_type = 'ball-recovery' GROUP BY player_id", (match_id,)).fetchall()
    recovery_map = {r["player_id"]: r["cnt"] for r in rec_counts}

    xg_counts = cursor.execute("SELECT ps.player_id, SUM(psx.calculated_xg) as xg_sum FROM player_shots ps JOIN player_shots_xg psx ON ps.shot_id = psx.shot_id WHERE ps.match_id = ? GROUP BY ps.player_id", (match_id,)).fetchall()
    xg_map = {r["player_id"]: r["xg_sum"] for r in xg_counts}

    opp_is_home = 0 if is_home else 1
    s_row = cursor.execute("SELECT COUNT(*) as cnt FROM player_shots WHERE match_id = ? AND is_home = ? AND shot_type = 'save'", (match_id, opp_is_home)).fetchone()
    team_saves = int(s_row["cnt"]) if s_row else 0

    result = []
    for p in raw_players:
        pid, mins, was_sub = p["player_id"], int(p["minutes_played"]), bool(p["was_substitute"])
        subbed_in_min, rep_name = None, None
        if was_sub:
            rep_id = p.get("replaced_player_id")
            if rep_id and rep_id in starters_map:
                rep_name = starters_map[rep_id]["name"]
                subbed_in_min = int(starters_map[rep_id]["minutes_played"])
            elif rep_id and rep_id in replaced_names:
                rep_name = replaced_names[rep_id]
            if subbed_in_min is None:
                subbed_in_min = max(0, 90 - mins)

        acc_pct, passes_comp, passes_tot = p.get("accurate_passes_pct"), p.get("accurate_passes") or 0, 0
        if pid in passes_map:
            p_tot, p_comp = passes_map[pid]
            passes_tot = p_tot
            if passes_comp == 0 and p_comp is not None:
                passes_comp = p_comp
        elif acc_pct is not None and acc_pct > 0 and passes_comp > 0:
            passes_tot = round((passes_comp * 100.0) / acc_pct)
        if passes_tot > 0 and acc_pct is None:
            acc_pct = round((passes_comp * 100.0) / passes_tot, 1)
        if passes_comp == 0 and acc_pct is not None and acc_pct > 0 and passes_tot > 0:
            passes_comp = round(passes_tot * (acc_pct / 100.0))

        pos = p.get("position") or "SUB"
        is_gk = pos.upper() == "GK" or pos.upper() == "G" or "GK" in pos.upper()
        if is_gk and not was_sub:
            saves_cnt = team_saves
        elif is_gk and was_sub:
            saves_cnt = int(p["saves"]) if p.get("saves") is not None else None
        else:
            saves_cnt = int(p["saves"]) if p.get("saves") is not None else None
        goals_conceded = opponent_score if is_gk else 0
        xg_val = p.get("expected_goals") if p.get("expected_goals") is not None else xg_map.get(pid, 0.0)

        result.append({
            "player_id": pid, "jersey_number": p.get("shirt_number"), "name": p["name"], "position": pos,
            "was_substitute": was_sub, "minutes_played": mins, "subbed_in_minute": subbed_in_min,
            "replaced_player_name": rep_name,
            "sofascore_rating": _safe_float(p.get("sofascore_rating"), None, 1) if p.get("sofascore_rating") is not None else None,
            "goals": int(p.get("goals") or 0), "assists": int(p.get("assists") or 0),
            "calculated_xg": round(float(xg_val or 0.0), 2),
            "total_shots": int(p["total_shots"]) if p.get("total_shots") is not None else 0,
            "shots_on_target": int(p["shots_on_target"]) if p.get("shots_on_target") is not None else None,
            "key_passes": int(p.get("key_passes") or 0),
            "passes_completed": int(passes_comp), "passes_total": int(passes_tot),
            "accurate_passes_pct": acc_pct, "tackles": int(p.get("tackles") or 0),
            "interceptions": int(p.get("interceptions") or 0), "recoveries": int(recovery_map.get(pid, 0)),
            "clearances": int(p.get("clearances") or 0), "saves": saves_cnt,
            "goals_conceded": goals_conceded,
            "fouls": int(p.get("fouls") or 0),
            "was_fouled": int(p.get("was_fouled") or 0),
        })
    return result


def _format_player_section_for_clipboard(
    players: List[Dict[str, Any]],
    team_name: str,
    role_label: str,
    is_last: bool = False,
) -> str:
    sep_72 = "=" * 72
    header = f"{'DOR':>3}  {'JUGADOR':<20}  {'POS':<3}  {'MIN':>4}  {'RAT':>4}  {'G':>2}  {'A':>2}  {'xG':>5}  {'TIROS':>5}  {'PASES(%)':>9}  {'REC/ENT':>7}"

    lines = [
        sep_72,
        f"RENDIMIENTO INDIVIDUAL: {team_name.upper()} ({role_label})",
        sep_72,
        "TITULARES",
        header,
    ]

    starters = [p for p in players if not p["was_substitute"]]
    subs = [p for p in players if p["was_substitute"]]

    def _format_row(p: Dict[str, Any]) -> str:
        dor = str(p["jersey_number"]) if p.get("jersey_number") is not None else "-"
        name = format_player_name(p.get("name") or "N/A", max_len=20)
        pos = (p.get("position") or "N/A").strip()
        mins = f"{p['minutes_played']}'"
        rat = f"{p['sofascore_rating']:.1f}" if p.get("sofascore_rating") is not None else "-"
        g = str(p["goals"])
        a = str(p["assists"])
        xg = f"{p['calculated_xg']:.2f}"
        tot = p.get("total_shots")
        sot = p.get("shots_on_target")
        if tot is None and sot is None:
            sh = "-"
        elif tot == 0:
            sh = "0"
        elif tot is not None and tot > 0:
            if sot is not None:
                sh = f"{tot}({sot})"
            else:
                sh = f"{tot}(-)"
        else:
            sh = str(tot) if tot is not None else "-"

        p_comp = p.get("passes_completed") or 0
        p_tot = p.get("passes_total") or 0
        pct = p.get("accurate_passes_pct")

        pct_val = None
        if pct is not None:
            try:
                pct_val = int(round(float(pct)))
            except (ValueError, TypeError):
                pct_val = None

        if p_tot > 0 and p_comp > 0:
            pct_display = pct_val if pct_val is not None else int(round(p_comp * 100.0 / p_tot))
            pas = f"{p_comp} ({pct_display}%)"
        elif p_tot > 0 and p_comp == 0:
            if pct_val is not None and pct_val > 0:
                est = max(1, int(round(p_tot * (pct_val / 100.0))))
                pas = f"{est} ({pct_val}%)"
            else:
                pas = "0 (0%)"
        elif p_tot == 0 and p_comp > 0:
            if pct_val is not None and pct_val > 0:
                pas = f"{p_comp} ({pct_val}%)"
            else:
                pas = str(p_comp)
        else:  # p_tot == 0 and p_comp == 0
            if pct_val is not None and pct_val > 0:
                pas = f"{pct_val}%"
            elif pct_val == 0 and pct is not None:
                pas = "0 (0%)"
            else:
                pas = "-"

        recent = f"{p['recoveries']}/{p['tackles']}"
        is_gk = pos.upper() == "GK" or pos.upper() == "G" or "GK" in pos.upper()
        if is_gk:
            saves = p.get("saves")
            if saves is None:
                gk_suffix = "  [- Paradas]"
            elif saves == 1:
                gk_suffix = "  [1 Parada]"
            else:
                gk_suffix = f"  [{saves} Paradas]"
        else:
            gk_suffix = ""

        return f"{dor:>3}  {name:<20}  {pos[:3]:<3}  {mins:>4}  {rat:>4}  {g:>2}  {a:>2}  {xg:>5}  {sh:>5}  {pas:>9}  {recent:>7}{gk_suffix}"

    for p in starters:
        lines.append(_format_row(p))

    lines.append("SUPLENTES CON MINUTOS")
    if not subs:
        lines.append("(Sin sustituciones registradas)")
    else:
        for p in subs:
            lines.append(_format_row(p))
            if p.get("replaced_player_name") and p.get("subbed_in_minute") is not None:
                lines.append(f"     (Entro al {p['subbed_in_minute']}' por {p['replaced_player_name']})")
            elif p.get("subbed_in_minute") is not None:
                lines.append(f"     (Entro al {p['subbed_in_minute']}')")

    if is_last:
        lines.append(sep_72)
    return "\n".join(lines)


def _get_venue_and_referee(cursor: sqlite3.Cursor, match_row: sqlite3.Row, home_id: int):
    venue = get_stadium_info(home_id)
    ref_id = match_row["referee_id"]
    if ref_id is None:
        return venue, None
    r_row = cursor.execute("SELECT name, country, total_games_sofa, total_yellows_sofa, total_reds_sofa FROM referees WHERE referee_id = ?", (ref_id,)).fetchone()
    if r_row:
        games, yc, rc = r_row["total_games_sofa"] or 0, r_row["total_yellows_sofa"] or 0, r_row["total_reds_sofa"] or 0
        return venue, {
            "referee_id": ref_id, "name": r_row["name"], "country": r_row["country"], "sample_matches": games,
            "yellow_cards_per_match": round(yc / games, 2) if games > 0 else None,
            "red_cards_per_match": round(rc / games, 2) if games > 0 else None, "is_small_sample": games < 10,
        }
    return venue, {"referee_id": ref_id, "name": None, "country": None, "sample_matches": 0, "yellow_cards_per_match": None, "red_cards_per_match": None, "is_small_sample": True}


def _get_goals_and_game_state(cursor: sqlite3.Cursor, match_id: int, home_id: int, away_id: int, home_name: str, away_name: str):
    raw = cursor.execute("SELECT minute, period, team_id, player_name, incident_type, is_corner_origin FROM match_goal_incidents WHERE match_id = ? ORDER BY minute ASC, period ASC", (match_id,)).fetchall()
    goals_list, rh, ra = [], 0, 0
    timeline = [(0, 0, 0)]
    for g in raw:
        min_val, per, t_id, p_name, inc_t, is_corn = int(g["minute"]), str(g["period"]), int(g["team_id"]), str(g["player_name"]), str(g["incident_type"]), bool(g["is_corner_origin"])
        disp = "Autogol" if inc_t == "ownGoal" else ("Penalti" if inc_t == "penalty" else ("Corner" if is_corn else "Jugada"))
        if t_id == home_id:
            rh += 1
        else:
            ra += 1
        goals_list.append({"minute": min_val, "minute_display": f"{min_val}'", "period": per, "team_id": t_id, "player_name": p_name, "incident_type": disp, "assister_name": None, "score": f"{rh}-{ra}"})
        timeline.append((min_val, rh, ra))
    timeline.append((90, rh, ra))

    lm, dm, tm = 0, 0, 0
    for i in range(len(timeline) - 1):
        cur_min, hs, ascore = timeline[i]
        dur = max(0, timeline[i + 1][0] - cur_min)
        if hs > ascore:
            lm += dur
        elif hs < ascore:
            tm += dur
        else:
            dm += dur

    return goals_list, {
        "total_duration_minutes": 90, "lead_minutes": lm, "lead_pct": round(lm * 100.0 / 90, 1),
        "draw_minutes": dm, "draw_pct": round(dm * 100.0 / 90, 1), "trail_minutes": tm, "trail_pct": round(tm * 100.0 / 90, 1),
        "criterion": "Tiempo reglamentario estandar (90 min)",
    }


def _get_cards_and_substitutions(cursor: sqlite3.Cursor, match_id: int) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    card_incidents = []
    try:
        card_rows = cursor.execute(
            """
            SELECT id, match_id, team_id, player_id, player_name, minute, extra_minute, card_type, reason, rescinded
            FROM match_card_incidents
            WHERE match_id = ?
            ORDER BY minute ASC, extra_minute ASC
            """,
            (match_id,),
        ).fetchall()
        for c in card_rows:
            min_val = int(c["minute"])
            extra_min = int(c["extra_minute"] or 0)
            disp = f"{min_val}'" if extra_min == 0 else f"{min_val}+{extra_min}'"
            card_incidents.append({
                "id": c["id"],
                "minute": min_val,
                "minute_display": disp,
                "extra_minute": extra_min,
                "team_id": int(c["team_id"]),
                "player_id": int(c["player_id"]),
                "player_name": c["player_name"],
                "card_type": c["card_type"],
                "reason": c["reason"],
                "rescinded": bool(c["rescinded"]),
            })
    except sqlite3.OperationalError:
        card_incidents = []

    substitution_incidents = []
    try:
        sub_rows = cursor.execute(
            """
            SELECT id, match_id, team_id, player_in_id, player_in_name, player_out_id, player_out_name, minute, extra_minute
            FROM match_substitution_incidents
            WHERE match_id = ?
            ORDER BY minute ASC, extra_minute ASC
            """,
            (match_id,),
        ).fetchall()
        for s in sub_rows:
            min_val = int(s["minute"])
            extra_min = int(s["extra_minute"] or 0)
            disp = f"{min_val}'" if extra_min == 0 else f"{min_val}+{extra_min}'"
            substitution_incidents.append({
                "id": s["id"],
                "minute": min_val,
                "minute_display": disp,
                "extra_minute": extra_min,
                "team_id": int(s["team_id"]),
                "player_in_id": int(s["player_in_id"]),
                "player_in_name": s["player_in_name"],
                "player_out_id": int(s["player_out_id"]),
                "player_out_name": s["player_out_name"],
            })
    except sqlite3.OperationalError:
        substitution_incidents = []

    return card_incidents, substitution_incidents


def _get_half_period_stats(cursor: sqlite3.Cursor, match_id: int, home_id: int, away_id: int) -> Tuple[List[Dict[str, Any]], Optional[str], Optional[str]]:
    mps_rows = cursor.execute("SELECT period, team_id, goals, corner_kicks, fouls, yellow_cards, possession FROM match_period_stats WHERE match_id = ? AND period IN ('1ST', '2ND')", (match_id,)).fetchall()
    fs_rows = cursor.execute("SELECT * FROM flashscore_match_team_stats WHERE match_id = ? AND period IN ('1T', '2T')", (match_id,)).fetchall()

    fs_map = {("1ST" if r["period"] == "1T" else "2ND", int(r["team_id"])): dict(r) for r in fs_rows}
    mps_map = {(r["period"], int(r["team_id"])): dict(r) for r in mps_rows}

    # Decide fouls source per-match (primary: Flashscore if 1T and 2T exist with non-null fouls for both teams)
    fs_h1, fs_a1 = fs_map.get(("1ST", home_id), {}), fs_map.get(("1ST", away_id), {})
    fs_h2, fs_a2 = fs_map.get(("2ND", home_id), {}), fs_map.get(("2ND", away_id), {})
    has_fs_fouls = (
        fs_h1.get("fouls") is not None
        and fs_a1.get("fouls") is not None
        and fs_h2.get("fouls") is not None
        and fs_a2.get("fouls") is not None
    )

    mps_h1, mps_a1 = mps_map.get(("1ST", home_id), {}), mps_map.get(("1ST", away_id), {})
    mps_h2, mps_a2 = mps_map.get(("2ND", home_id), {}), mps_map.get(("2ND", away_id), {})
    has_mps_fouls = (
        mps_h1.get("fouls") is not None
        or mps_a1.get("fouls") is not None
        or mps_h2.get("fouls") is not None
        or mps_a2.get("fouls") is not None
    )

    if has_fs_fouls:
        fouls_source = "flashscore"
    elif has_mps_fouls:
        fouls_source = "sofascore"
    else:
        fouls_source = None

    # Decide shots source per-match (Flashscore if 1T and 2T exist with non-null shots_total for both teams)
    has_fs_shots = (
        fs_h1.get("shots_total") is not None
        and fs_a1.get("shots_total") is not None
        and fs_h2.get("shots_total") is not None
        and fs_a2.get("shots_total") is not None
    )
    shots_source = "flashscore" if has_fs_shots else None

    halves = []
    for per in ["1ST", "2ND"]:
        hm, am = mps_map.get((per, home_id), {}), mps_map.get((per, away_id), {})
        hf, af = fs_map.get((per, home_id), {}), fs_map.get((per, away_id), {})

        if fouls_source == "flashscore":
            h_fouls = int(hf["fouls"]) if hf.get("fouls") is not None else None
            a_fouls = int(af["fouls"]) if af.get("fouls") is not None else None
        elif fouls_source == "sofascore":
            h_fouls = int(hm["fouls"]) if hm.get("fouls") is not None else None
            a_fouls = int(am["fouls"]) if am.get("fouls") is not None else None
        else:
            h_fouls = None
            a_fouls = None

        halves.append({
            "period": per,
            "home_goals": int(hm.get("goals") or 0),
            "away_goals": int(am.get("goals") or 0),
            "home_corners": int(hm.get("corner_kicks") or 0),
            "away_corners": int(am.get("corner_kicks") or 0),
            "home_fouls": h_fouls,
            "away_fouls": a_fouls,
            "home_yellow_cards": int(hm.get("yellow_cards") or 0),
            "away_yellow_cards": int(am.get("yellow_cards") or 0),
            "home_possession": float(hm.get("possession") or 50.0),
            "away_possession": float(am.get("possession") or 50.0),
            "home_shots": int(hf["shots_total"]) if hf.get("shots_total") is not None else None,
            "away_shots": int(af["shots_total"]) if af.get("shots_total") is not None else None,
            "home_shots_on_target": int(hf["shots_on_target"]) if hf.get("shots_on_target") is not None else None,
            "away_shots_on_target": int(af["shots_on_target"]) if af.get("shots_on_target") is not None else None,
            "home_xg": round(float(hf["xg"]), 2) if hf.get("xg") is not None else None,
            "away_xg": round(float(af["xg"]), 2) if af.get("xg") is not None else None,
            "home_xgot": round(float(hf["xgot"]), 2) if hf.get("xgot") is not None else None,
            "away_xgot": round(float(af["xgot"]), 2) if af.get("xgot") is not None else None,
            "fouls_source": fouls_source,
            "shots_source": shots_source,
        })
    return halves, fouls_source, shots_source


def _get_attack_channels(cursor: sqlite3.Cursor, match_id: int, team_id: int) -> Dict[str, Any]:
    raw = cursor.execute("SELECT p.y_end, p.is_successful FROM player_passes p JOIN player_match_stats pms ON p.match_id = pms.match_id AND p.player_id = pms.player_id WHERE p.match_id = ? AND pms.team_id = ? AND p.x_end >= 66.67", (match_id, team_id)).fetchall()
    lt = lc = ct = cc = rt = rc = 0
    for r in raw:
        y, succ = float(r["y_end"]), (1 if r["is_successful"] else 0)
        if y > 66.67:
            lt += 1; lc += succ
        elif y < 33.33:
            rt += 1; rc += succ
        else:
            ct += 1; cc += succ
    tot = len(raw)
    return {
        "left_passes": lt, "left_passes_completed": lc, "left_pct": round(lc * 100.0 / lt, 1) if lt > 0 else None,
        "center_passes": ct, "center_passes_completed": cc, "center_pct": round(cc * 100.0 / ct, 1) if ct > 0 else None,
        "right_passes": rt, "right_passes_completed": rc, "right_pct": round(rc * 100.0 / rt, 1) if rt > 0 else None,
        "total_passes": tot,
    }


def _get_shot_typology(cursor: sqlite3.Cursor, match_id: int, is_home: bool) -> Dict[str, Any]:
    rows = cursor.execute("SELECT situation, count(*) as cnt FROM player_shots WHERE match_id = ? AND is_home = ? GROUP BY situation", (match_id, 1 if is_home else 0)).fetchall()
    op = sp = ca = pen = oth = 0
    for r in rows:
        sit, cnt = r["situation"], int(r["cnt"])
        if sit in ("assisted", "regular"):
            op += cnt
        elif sit in ("corner", "set-piece", "free-kick", "throw-in-set-piece"):
            sp += cnt
        elif sit == "fast-break":
            ca += cnt
        elif sit == "penalty":
            pen += cnt
        else:
            oth += cnt
    return {"open_play": op, "set_piece": sp, "counter_attack": ca, "penalty": pen, "other": oth, "total": op + sp + ca + pen + oth}


def build_match_sheet_03_datahub(db: sqlite3.Connection, match_id: int) -> Dict[str, Any]:
    cursor = db.cursor()
    cursor.row_factory = sqlite3.Row

    match_row = cursor.execute(
        """
        SELECT m.match_id, m.home_team_id, m.away_team_id, m.home_score, m.away_score, m.round, m.match_date, m.referee_id,
               ht.name as home_name, ht.short_name as home_short_name, ht.logo_url as home_logo_url, ht.primary_color as home_primary_color,
               at.name as away_name, at.short_name as away_short_name, at.logo_url as away_logo_url, at.primary_color as away_primary_color
        FROM matches m
        JOIN teams ht ON m.home_team_id = ht.team_id
        JOIN teams at ON m.away_team_id = at.team_id
        WHERE m.match_id = ?
        """,
        (match_id,),
    ).fetchone()

    if not match_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Match {match_id} not found")

    home_id, away_id = int(match_row["home_team_id"]), int(match_row["away_team_id"])
    home_name, away_name = match_row["home_name"] or "Local", match_row["away_name"] or "Visitante"

    tmm_by_team = {int(r["team_id"]): dict(r) for r in cursor.execute("SELECT * FROM team_match_metrics WHERE match_id = ?", (match_id,)).fetchall() if r["team_id"] is not None}
    tmm_h, tmm_a = tmm_by_team.get(home_id, {}), tmm_by_team.get(away_id, {})

    fs_by_team = {int(r["team_id"]): dict(r) for r in cursor.execute("SELECT * FROM flashscore_match_team_stats WHERE match_id = ? AND period = 'ALL'", (match_id,)).fetchall() if r["team_id"] is not None}
    fs_h, fs_a = fs_by_team.get(home_id, {}), fs_by_team.get(away_id, {})

    mps_by_team = {int(r["team_id"]): dict(r) for r in cursor.execute("SELECT * FROM match_period_stats WHERE match_id = ? AND period = 'ALL'", (match_id,)).fetchall() if r["team_id"] is not None}
    mps_h, mps_a = mps_by_team.get(home_id, {}), mps_by_team.get(away_id, {})

    metadata = {
        "match_id": match_id,
        "tournament": tmm_h.get("tournament") or tmm_a.get("tournament") or "Liga 1 Te Apuesto",
        "round": match_row["round"], "match_date": match_row["match_date"],
        "home_team": {"team_id": home_id, "name": home_name, "short_name": match_row["home_short_name"], "score": int(match_row["home_score"] or 0), "logo_url": match_row["home_logo_url"], "primary_color": match_row["home_primary_color"]},
        "away_team": {"team_id": away_id, "name": away_name, "short_name": match_row["away_short_name"], "score": int(match_row["away_score"] or 0), "logo_url": match_row["away_logo_url"], "primary_color": match_row["away_primary_color"]},
    }

    venue, referee = _get_venue_and_referee(cursor, match_row, home_id)
    goals_chronology, game_state = _get_goals_and_game_state(cursor, match_id, home_id, away_id, home_name, away_name)
    card_incidents, substitution_incidents = _get_cards_and_substitutions(cursor, match_id)
    half_period_stats, fouls_source, shots_source = _get_half_period_stats(cursor, match_id, home_id, away_id)
    home_attack_channels = _get_attack_channels(cursor, match_id, home_id)
    away_attack_channels = _get_attack_channels(cursor, match_id, away_id)
    home_shot_typology = _get_shot_typology(cursor, match_id, True)
    away_shot_typology = _get_shot_typology(cursor, match_id, False)

    h_dist_sum, h_dist_cnt = _safe_float(tmm_h.get("shot_dist_sum_for"), 0.0), _safe_int(tmm_h.get("shot_dist_count_for"), 0)
    h_avg_dist = round(h_dist_sum / h_dist_cnt, 1) if h_dist_cnt > 0 else 0.0
    a_dist_sum, a_dist_cnt = _safe_float(tmm_a.get("shot_dist_sum_for"), 0.0), _safe_int(tmm_a.get("shot_dist_count_for"), 0)
    a_avg_dist = round(a_dist_sum / a_dist_cnt, 1) if a_dist_cnt > 0 else 0.0

    attack_metrics = [
        _row("xg_sofascore", "Goles Esperados (xG - Sofascore)", _safe_float(tmm_h.get("xg_for"), 0.0, 2), _safe_float(tmm_a.get("xg_for"), 0.0, 2), "sofascore"),
        _row("xg_flashscore", "Goles Esperados (xG - Flashscore)", _safe_float(fs_h.get("xg"), 0.0, 2), _safe_float(fs_a.get("xg"), 0.0, 2), "flashscore"),
        _row("npxg", "xG Sin Penaltis (np-xG)", _safe_float(tmm_h.get("npxg_for"), 0.0, 2), _safe_float(tmm_a.get("npxg_for"), 0.0, 2), "sofascore"),
        _row("xgot", "xG a Puerta (xGOT)", _safe_float(fs_h.get("xgot"), 0.0, 2), _safe_float(fs_a.get("xgot"), 0.0, 2), "flashscore"),
        _row("goals", "Goles Reales", int(match_row["home_score"] or 0), int(match_row["away_score"] or 0), "consensus"),
        _row("shots_total", "Tiros Totales", _safe_int(fs_h.get("shots_total") if fs_h.get("shots_total") is not None else tmm_h.get("shots_for")), _safe_int(fs_a.get("shots_total") if fs_a.get("shots_total") is not None else tmm_a.get("shots_for")), "consensus"),
        _row("shots_on_target", "Tiros a Puerta", _safe_int(fs_h.get("shots_on_target") if fs_h.get("shots_on_target") is not None else tmm_h.get("shots_on_target_for")), _safe_int(fs_a.get("shots_on_target") if fs_a.get("shots_on_target") is not None else tmm_a.get("shots_on_target_for")), "consensus"),
        _row("shots_off_target", "Tiros Desviados", _safe_int(fs_h.get("shots_off_target")), _safe_int(fs_a.get("shots_off_target")), "flashscore", higher_is_better=False),
        _row("shots_blocked", "Tiros Bloqueados", _safe_int(fs_h.get("shots_blocked")), _safe_int(fs_a.get("shots_blocked")), "flashscore", higher_is_better=False),
        _row("shots_inside_box", "Tiros Dentro del Area", _safe_int(fs_h.get("shots_inside_box") if fs_h.get("shots_inside_box") is not None else tmm_h.get("shots_inside_box_for")), _safe_int(fs_a.get("shots_inside_box") if fs_a.get("shots_inside_box") is not None else tmm_a.get("shots_inside_box_for")), "flashscore"),
        _row("shots_outside_box", "Tiros Fuera del Area", _safe_int(fs_h.get("shots_outside_box") if fs_h.get("shots_outside_box") is not None else tmm_h.get("shots_outside_box_for")), _safe_int(fs_a.get("shots_outside_box") if fs_a.get("shots_outside_box") is not None else tmm_a.get("shots_outside_box_for")), "flashscore"),
        _row("hit_woodwork", "Tiros al Poste", _safe_int(fs_h.get("hit_woodwork")), _safe_int(fs_a.get("hit_woodwork")), "flashscore"),
        _row("avg_shot_distance", "Distancia Promedio de Tiro", h_avg_dist, a_avg_dist, "sofascore", unit="m", higher_is_better=False),
        _row("big_chances", "Grandes Ocasiones", _safe_int(fs_h.get("big_chances")), _safe_int(fs_a.get("big_chances")), "flashscore"),
        _row("big_chances_breakdown", "Grandes Ocasiones (Anotadas / Falladas)", f"{_safe_int(fs_h.get('big_chances_scored'))}/{_safe_int(fs_h.get('big_chances_missed'))}", f"{_safe_int(fs_a.get('big_chances_scored'))}/{_safe_int(fs_a.get('big_chances_missed'))}", "flashscore"),
    ]

    h_poss = _safe_float(fs_h.get("possession") if fs_h.get("possession") is not None else mps_h.get("possession"), 50.0, 1)
    a_poss = _safe_float(fs_a.get("possession") if fs_a.get("possession") is not None else mps_a.get("possession"), 50.0, 1)
    h_p_comp = _safe_int(tmm_h.get("passes_completed") if tmm_h.get("passes_completed") is not None else fs_h.get("passes_completed"))
    h_p_tot = _safe_int(tmm_h.get("passes_total") if tmm_h.get("passes_total") is not None else fs_h.get("passes_total"))
    a_p_comp = _safe_int(tmm_a.get("passes_completed") if tmm_a.get("passes_completed") is not None else fs_a.get("passes_completed"))
    a_p_tot = _safe_int(tmm_a.get("passes_total") if tmm_a.get("passes_total") is not None else fs_a.get("passes_total"))
    h_ft_comp = _safe_int(fs_h.get("passes_final_third_completed") if fs_h.get("passes_final_third_completed") is not None else tmm_h.get("final_third_passes_for"))
    h_ft_tot = _safe_int(fs_h.get("passes_final_third_total"))
    a_ft_comp = _safe_int(fs_a.get("passes_final_third_completed") if fs_a.get("passes_final_third_completed") is not None else tmm_a.get("final_third_passes_for"))
    a_ft_tot = _safe_int(fs_a.get("passes_final_third_total"))
    h_cross_comp, h_cross_tot = _safe_int(fs_h.get("crosses_completed") if fs_h.get("crosses_completed") is not None else tmm_h.get("crosses_completed")), _safe_int(fs_h.get("crosses_total"))
    a_cross_comp, a_cross_tot = _safe_int(fs_a.get("crosses_completed") if fs_a.get("crosses_completed") is not None else tmm_a.get("crosses_completed")), _safe_int(fs_a.get("crosses_total"))
    h_long_comp, h_long_tot = _safe_int(fs_h.get("long_balls_completed")), _safe_int(fs_h.get("long_balls_total"))
    a_long_comp, a_long_tot = _safe_int(fs_a.get("long_balls_completed")), _safe_int(fs_a.get("long_balls_total"))

    passing_metrics = [
        _row("possession", "Posesion de Balon", h_poss, a_poss, "consensus", unit="%"),
        _row("passes_total", "Pases Totales (Intentados)", h_p_tot, a_p_tot, "sofascore"),
        _row("passes_completed", "Pases Completados", f"{h_p_comp} ({_safe_pct(h_p_comp, h_p_tot, 1)}%)", f"{a_p_comp} ({_safe_pct(a_p_comp, a_p_tot, 1)}%)", "sofascore"),
        _row("pass_accuracy_pct", "Precision de Pases", _safe_pct(h_p_comp, h_p_tot, 1), _safe_pct(a_p_comp, a_p_tot, 1), "consensus", unit="%"),
        _row("forward_passes", "Pases Hacia Adelante", _safe_int(tmm_h.get("forward_passes")), _safe_int(tmm_a.get("forward_passes")), "sofascore"),
        _row("passes_final_third", "Pases en Ultimo Tercio", f"{h_ft_comp}/{h_ft_tot}", f"{a_ft_comp}/{a_ft_tot}", "flashscore"),
        _row("passes_into_box", "Pases al Area", _safe_int(tmm_h.get("passes_into_box")), _safe_int(tmm_a.get("passes_into_box")), "sofascore"),
        _row("progressive_passes", "Pases Progresivos", _safe_int(tmm_h.get("progressive_passes")), _safe_int(tmm_a.get("progressive_passes")), "sofascore"),
        _row("progressive_carries", "Conducciones Progresivas", _safe_int(tmm_h.get("progressive_carries")), _safe_int(tmm_a.get("progressive_carries")), "sofascore"),
        _row("key_passes", "Pases Clave", _safe_int(fs_h.get("key_passes")), _safe_int(fs_a.get("key_passes")), "flashscore"),
        _row("crosses_breakdown", "Centros (Completados / Intentados)", f"{h_cross_comp}/{h_cross_tot}", f"{a_cross_comp}/{a_cross_tot}", "flashscore"),
        _row("long_balls_breakdown", "Balones Largos (Completados / Intentados)", f"{h_long_comp}/{h_long_tot}", f"{a_long_comp}/{a_long_tot}", "flashscore"),
        _row("touches_in_box", "Toques en el Area", _safe_int(fs_h.get("touches_in_box")), _safe_int(fs_a.get("touches_in_box")), "flashscore"),
        _row("successful_dribbles", "Regates Exitosos", _safe_int(tmm_h.get("successful_dribbles")), _safe_int(tmm_a.get("successful_dribbles")), "sofascore"),
    ]

    h_f3, a_f3 = _safe_int(tmm_h.get("final_third_passes_for")), _safe_int(tmm_a.get("final_third_passes_for"))
    tot_f3 = h_f3 + a_f3
    h_tilt_val = round(h_f3 * 100.0 / tot_f3, 1) if tot_f3 > 0 else 50.0
    a_tilt_val = round(100.0 - h_tilt_val, 1) if tot_f3 > 0 else 50.0
    h_tw, h_tt = _safe_int(fs_h.get("tackles_won")), _safe_int(fs_h.get("tackles_total") if fs_h.get("tackles_total") is not None else tmm_h.get("tackles"))
    a_tw, a_tt = _safe_int(fs_a.get("tackles_won")), _safe_int(fs_a.get("tackles_total") if fs_a.get("tackles_total") is not None else tmm_a.get("tackles"))

    defense_metrics = [
        _row("field_tilt", "Inclinacion de Campo (Field Tilt)", h_tilt_val, a_tilt_val, "derived", unit="%"),
        _row("duels_won", "Duelos Ganados", _safe_int(fs_h.get("duels_won")), _safe_int(fs_a.get("duels_won")), "flashscore"),
        _row("tackles_breakdown", "Entradas Ganadas (Exitosas / Totales)", f"{h_tw}/{h_tt}", f"{a_tw}/{a_tt}", "flashscore"),
        _row("interceptions", "Intercepciones", _safe_int(fs_h.get("interceptions") if fs_h.get("interceptions") is not None else tmm_h.get("interceptions")), _safe_int(fs_a.get("interceptions") if fs_a.get("interceptions") is not None else tmm_a.get("interceptions")), "consensus"),
        _row("clearances", "Despejes", _safe_int(fs_h.get("clearances") if fs_h.get("clearances") is not None else tmm_h.get("clearances")), _safe_int(fs_a.get("clearances") if fs_a.get("clearances") is not None else tmm_a.get("clearances")), "consensus"),
        _row("defensive_actions", "Total Acciones Defensivas", _safe_int(tmm_h.get("defensive_actions")), _safe_int(tmm_a.get("defensive_actions")), "sofascore"),
        _row("defensive_actions_high", "Acciones Defensivas Altas", _safe_int(tmm_h.get("defensive_actions_high")), _safe_int(tmm_a.get("defensive_actions_high")), "sofascore"),
        _row("high_recoveries", "Recuperaciones Altas", _safe_int(tmm_h.get("high_recoveries")), _safe_int(tmm_a.get("high_recoveries")), "sofascore"),
        _row("saves", "Paradas del Portero", _safe_int(fs_h.get("saves")), _safe_int(fs_a.get("saves")), "flashscore"),
        _row("goals_prevented", "Goles Prevenidos", _safe_float(fs_h.get("goals_prevented"), 0.0, 2), _safe_float(fs_a.get("goals_prevented"), 0.0, 2), "flashscore"),
    ]

    if fouls_source == "flashscore":
        h_f_tot = fs_h.get("fouls")
        a_f_tot = fs_a.get("fouls")
        sum_h = (half_period_stats[0]["home_fouls"] or 0) + (half_period_stats[1]["home_fouls"] or 0)
        sum_a = (half_period_stats[0]["away_fouls"] or 0) + (half_period_stats[1]["away_fouls"] or 0)
        home_fouls_total = int(h_f_tot) if h_f_tot is not None else sum_h
        away_fouls_total = int(a_f_tot) if a_f_tot is not None else sum_a
    elif fouls_source == "sofascore":
        h_f_tot = mps_h.get("fouls")
        a_f_tot = mps_a.get("fouls")
        sum_h = (half_period_stats[0]["home_fouls"] or 0) + (half_period_stats[1]["home_fouls"] or 0)
        sum_a = (half_period_stats[0]["away_fouls"] or 0) + (half_period_stats[1]["away_fouls"] or 0)
        home_fouls_total = int(h_f_tot) if h_f_tot is not None else sum_h
        away_fouls_total = int(a_f_tot) if a_f_tot is not None else sum_a
    else:
        home_fouls_total = None
        away_fouls_total = None

    discipline_metrics = [
        _row("fouls", "Faltas Cometidas", home_fouls_total, away_fouls_total, fouls_source or "consensus", higher_is_better=False),
        _row("yellow_cards", "Tarjetas Amarillas", _safe_int(fs_h.get("yellow_cards") if fs_h.get("yellow_cards") is not None else mps_h.get("yellow_cards")), _safe_int(fs_a.get("yellow_cards") if fs_a.get("yellow_cards") is not None else mps_a.get("yellow_cards")), "consensus", higher_is_better=False),
        _row("red_cards", "Tarjetas Rojas", _safe_int(fs_h.get("red_cards") if fs_h.get("red_cards") is not None else mps_h.get("red_cards")), _safe_int(fs_a.get("red_cards") if fs_a.get("red_cards") is not None else mps_a.get("red_cards")), "consensus", higher_is_better=False),
        _row("corner_kicks", "Tiros de Esquina", _safe_int(fs_h.get("corner_kicks") if fs_h.get("corner_kicks") is not None else mps_h.get("corner_kicks")), _safe_int(fs_a.get("corner_kicks") if fs_a.get("corner_kicks") is not None else mps_a.get("corner_kicks")), "consensus"),
        _row("offsides", "Fueras de Juego", _safe_int(fs_h.get("offsides")), _safe_int(fs_a.get("offsides")), "flashscore", higher_is_better=False),
        _row("free_kicks", "Tiros Libres Concedidos", _safe_int(fs_h.get("free_kicks")), _safe_int(fs_a.get("free_kicks")), "flashscore"),
        _row("throw_ins", "Saques de Banda", _safe_int(fs_h.get("throw_ins")), _safe_int(fs_a.get("throw_ins")), "flashscore"),
        _row("goal_kicks", "Saques de Meta", _safe_int(fs_h.get("goal_kicks")), _safe_int(fs_a.get("goal_kicks")), "flashscore"),
    ]

    sep_52 = "=" * 52
    sep_52_dash = "-" * 52
    r_fmt = lambda h, lbl, a: f"{('-' if h is None else str(h)):>8}    {lbl:<28}    {('-' if a is None else str(a)):>8}"

    header_lines = [
        f"REPORTE ESTADISTICO: {home_name} {match_row['home_score']} - {match_row['away_score']} {away_name}",
        f"Competicion: {metadata['tournament']} | Jornada: {match_row['round']} | Fecha: {match_row['match_date'][:10]}",
        f"Sede: {venue['stadium']} ({venue['city']}, {venue['altitude']} m, {venue['surface']})" if venue and venue.get("stadium") else "Sede: -",
        f"Arbitro: {referee['name']} ({referee['sample_matches']} partidos, {referee['yellow_cards_per_match']} AM/p, {referee['red_cards_per_match']} RO/p)" if referee and referee.get("name") else "Arbitro: -",
    ]

    team_lines = header_lines + [
        sep_52, "   LOCAL    METRICA                         VISITANTE", sep_52,
        "-- CALIDAD DE OCASIONES Y REMATE -----------------",
        r_fmt(fmt_stat(tmm_h.get("xg_for"), "float2"), "xG (Sofascore)", fmt_stat(tmm_a.get("xg_for"), "float2")),
        r_fmt(fmt_stat(fs_h.get("xg"), "float2"), "xG (Flashscore)", fmt_stat(fs_a.get("xg"), "float2")),
        r_fmt(fmt_stat(tmm_h.get("npxg_for"), "float2"), "npxG (Sin Penales)", fmt_stat(tmm_a.get("npxg_for"), "float2")),
        r_fmt(fmt_stat(fs_h.get("xgot"), "float2"), "xGOT", fmt_stat(fs_a.get("xgot"), "float2")),
        r_fmt(str(match_row["home_score"]), "Goles Reales", str(match_row["away_score"])),
        r_fmt(str(_safe_int(fs_h.get("shots_total") if fs_h.get("shots_total") is not None else tmm_h.get("shots_for"))), "Tiros Totales", str(_safe_int(fs_a.get("shots_total") if fs_a.get("shots_total") is not None else tmm_a.get("shots_for")))),
        r_fmt(str(_safe_int(fs_h.get("shots_on_target") if fs_h.get("shots_on_target") is not None else tmm_h.get("shots_on_target_for"))), "Tiros a Puerta", str(_safe_int(fs_a.get("shots_on_target") if fs_a.get("shots_on_target") is not None else tmm_a.get("shots_on_target_for")))),
        r_fmt(str(_safe_int(fs_h.get("shots_off_target"))), "Tiros Desviados", str(_safe_int(fs_a.get("shots_off_target")))),
        r_fmt(str(_safe_int(fs_h.get("shots_blocked"))), "Tiros Bloqueados", str(_safe_int(fs_a.get("shots_blocked")))),
        r_fmt(str(_safe_int(fs_h.get("shots_inside_box") if fs_h.get("shots_inside_box") is not None else tmm_h.get("shots_inside_box_for"))), "Tiros Dentro del Area", str(_safe_int(fs_a.get("shots_inside_box") if fs_a.get("shots_inside_box") is not None else tmm_a.get("shots_inside_box_for")))),
        r_fmt(str(_safe_int(fs_h.get("shots_outside_box") if fs_h.get("shots_outside_box") is not None else tmm_h.get("shots_outside_box_for"))), "Tiros Fuera del Area", str(_safe_int(fs_a.get("shots_outside_box") if fs_a.get("shots_outside_box") is not None else tmm_a.get("shots_outside_box_for")))),
        r_fmt(str(_safe_int(fs_h.get("hit_woodwork"))), "Tiros al Poste", str(_safe_int(fs_a.get("hit_woodwork")))),
        r_fmt(fmt_stat(h_avg_dist, "dist"), "Distancia Media Tiro", fmt_stat(a_avg_dist, "dist")),
        r_fmt(str(_safe_int(fs_h.get("big_chances"))), "Grandes Ocasiones", str(_safe_int(fs_a.get("big_chances")))),
        r_fmt(f"{_safe_int(fs_h.get('big_chances_scored'))}/{_safe_int(fs_h.get('big_chances_missed'))}", "G. Ocasiones Anot/Fall", f"{_safe_int(fs_a.get('big_chances_scored'))}/{_safe_int(fs_a.get('big_chances_missed'))}"),
        "-- CONSTRUCCION Y DISTRIBUCION -------------------",
        r_fmt(fmt_stat(h_poss, "pct"), "Posesion", fmt_stat(a_poss, "pct")),
        r_fmt(str(h_p_tot), "Pases Totales", str(a_p_tot)),
        r_fmt(str(h_p_comp), "Pases Completados", str(a_p_comp)),
        r_fmt(fmt_stat(_safe_pct(h_p_comp, h_p_tot, 1), "pct"), "Precision de Pases", fmt_stat(_safe_pct(a_p_comp, a_p_tot, 1), "pct")),
        r_fmt(str(_safe_int(tmm_h.get("forward_passes"))), "Pases Hacia Adelante", str(_safe_int(tmm_a.get("forward_passes")))),
        r_fmt(f"{h_ft_comp}/{h_ft_tot}", "Pases Ultimo Tercio (Acc)", f"{a_ft_comp}/{a_ft_tot}"),
        r_fmt(str(_safe_int(tmm_h.get("passes_into_box"))), "Pases al Area", str(_safe_int(tmm_a.get("passes_into_box")))),
        r_fmt(str(_safe_int(tmm_h.get("progressive_passes"))), "Pases Progresivos", str(_safe_int(tmm_a.get("progressive_passes")))),
        r_fmt(str(_safe_int(tmm_h.get("progressive_carries"))), "Conducciones Progresivas", str(_safe_int(tmm_a.get("progressive_carries")))),
        r_fmt(str(_safe_int(fs_h.get("key_passes"))), "Pases Clave", str(_safe_int(fs_a.get("key_passes")))),
        r_fmt(str(_safe_int(fs_h.get("touches_in_box"))), "Toques en el Area", str(_safe_int(fs_a.get("touches_in_box")))),
        r_fmt(f"{h_cross_comp}/{h_cross_tot}", "Centros (Comp/Tot)", f"{a_cross_comp}/{a_cross_tot}"),
        r_fmt(f"{h_long_comp}/{h_long_tot}", "Balones Largos (Comp/Tot)", f"{a_long_comp}/{a_long_tot}"),
        r_fmt(str(_safe_int(tmm_h.get("successful_dribbles"))), "Regates Exitosos", str(_safe_int(tmm_a.get("successful_dribbles")))),
        "-- PRESION, DUELOS Y PORTERIA --------------------",
        r_fmt(fmt_stat(h_tilt_val, "pct"), "Field Tilt", fmt_stat(a_tilt_val, "pct")),
        r_fmt(str(_safe_int(fs_h.get("duels_won"))), "Duelos Ganados", str(_safe_int(fs_a.get("duels_won")))),
        r_fmt(f"{h_tw}/{h_tt}", "Entradas Ganadas (Tot)", f"{a_tw}/{a_tt}"),
        r_fmt(str(_safe_int(fs_h.get("interceptions") if fs_h.get("interceptions") is not None else tmm_h.get("interceptions"))), "Intercepciones", str(_safe_int(fs_a.get("interceptions") if fs_a.get("interceptions") is not None else tmm_a.get("interceptions")))),
        r_fmt(str(_safe_int(fs_h.get("clearances") if fs_h.get("clearances") is not None else tmm_h.get("clearances"))), "Despejes", str(_safe_int(fs_a.get("clearances") if fs_a.get("clearances") is not None else tmm_a.get("clearances")))),
        r_fmt(str(_safe_int(tmm_h.get("defensive_actions"))), "Total Acciones Defensivas", str(_safe_int(tmm_a.get("defensive_actions")))),
        r_fmt(str(_safe_int(tmm_h.get("defensive_actions_high"))), "Acciones Defensivas Altas", str(_safe_int(tmm_a.get("defensive_actions_high")))),
        r_fmt(str(_safe_int(tmm_h.get("high_recoveries"))), "Recuperaciones Altas", str(_safe_int(tmm_a.get("high_recoveries")))),
        r_fmt(str(_safe_int(fs_h.get("saves"))), "Paradas del Portero", str(_safe_int(fs_a.get("saves")))),
        r_fmt(fmt_stat(_safe_float(fs_h.get("goals_prevented"), 0.0), "prevented"), "Goles Prevenidos", fmt_stat(_safe_float(fs_a.get("goals_prevented"), 0.0), "prevented")),
        "-- DISCIPLINA Y PELOTA PARADA --------------------",
        r_fmt(str(home_fouls_total) if home_fouls_total is not None else "-", "Faltas Cometidas", str(away_fouls_total) if away_fouls_total is not None else "-"),
        r_fmt(str(_safe_int(fs_h.get("yellow_cards") if fs_h.get("yellow_cards") is not None else mps_h.get("yellow_cards"))), "Tarjetas Amarillas", str(_safe_int(fs_a.get("yellow_cards") if fs_a.get("yellow_cards") is not None else mps_a.get("yellow_cards")))),
        r_fmt(str(_safe_int(fs_h.get("red_cards") if fs_h.get("red_cards") is not None else mps_h.get("red_cards"))), "Tarjetas Rojas", str(_safe_int(fs_a.get("red_cards") if fs_a.get("red_cards") is not None else mps_a.get("red_cards")))),
        r_fmt(str(_safe_int(fs_h.get("corner_kicks") if fs_h.get("corner_kicks") is not None else mps_h.get("corner_kicks"))), "Tiros de Esquina", str(_safe_int(fs_a.get("corner_kicks") if fs_a.get("corner_kicks") is not None else mps_a.get("corner_kicks")))),
        r_fmt(str(_safe_int(fs_h.get("offsides"))), "Fueras de Juego", str(_safe_int(fs_a.get("offsides")))),
        r_fmt(str(_safe_int(fs_h.get("free_kicks"))), "Tiros Libres Concedidos", str(_safe_int(fs_a.get("free_kicks")))),
        r_fmt(str(_safe_int(fs_h.get("throw_ins"))), "Saques de Banda", str(_safe_int(fs_a.get("throw_ins")))),
        r_fmt(str(_safe_int(fs_h.get("goal_kicks"))), "Saques de Meta", str(_safe_int(fs_a.get("goal_kicks")))),
        sep_52,
    ]

    goals_lines = ["CRONOLOGIA DE GOLES Y ESTADO DE JUEGO", sep_52]
    if not goals_chronology:
        goals_lines.append("Sin goles en el partido.")
    else:
        for g in goals_chronology:
            t_label = home_name if g["team_id"] == home_id else away_name
            goals_lines.append(f"{g['minute']:>2}'  [{g['score']}]  {g['player_name']} ({t_label}) - {g['incident_type']}")
    goals_lines.extend([
        sep_52_dash,
        f"ESTADO DE JUEGO ({game_state['total_duration_minutes']} min reglamentarios):",
        f"  Ventaja Local:     {game_state['lead_minutes']:>2} min  ({game_state['lead_pct']:>5.1f}%)",
        f"  Empate:            {game_state['draw_minutes']:>2} min  ({game_state['draw_pct']:>5.1f}%)",
        f"  Ventaja Visitante: {game_state['trail_minutes']:>2} min  ({game_state['trail_pct']:>5.1f}%)",
        sep_52,
    ])

    halves_lines = ["DESGLOSE POR PERIODOS (1T / 2T)", sep_52]
    for h in half_period_stats:
        p_label = "PRIMER TIEMPO" if h["period"] == "1ST" else "SEGUNDO TIEMPO"
        halves_lines.extend([
            f"   LOCAL    {p_label:<28}   VISITANTE", sep_52_dash,
            r_fmt(fmt_stat(h["home_xg"], "float2") if h.get("home_xg") is not None else "-", "xG (Flashscore)", fmt_stat(h["away_xg"], "float2") if h.get("away_xg") is not None else "-"),
            r_fmt(str(h["home_goals"]), "Goles", str(h["away_goals"])),
            r_fmt(str(h["home_shots"]) if h.get("home_shots") is not None else "-", "Tiros Totales", str(h["away_shots"]) if h.get("away_shots") is not None else "-"),
            r_fmt(str(h["home_shots_on_target"]) if h.get("home_shots_on_target") is not None else "-", "Tiros a Puerta", str(h["away_shots_on_target"]) if h.get("away_shots_on_target") is not None else "-"),
            r_fmt(str(h["home_corners"]), "Tiros de Esquina", str(h["away_corners"])),
            r_fmt(str(h["home_fouls"]) if h.get("home_fouls") is not None else "-", "Faltas", str(h["away_fouls"]) if h.get("away_fouls") is not None else "-"),
            r_fmt(str(h["home_yellow_cards"]), "Tarjetas Amarillas", str(h["away_yellow_cards"])),
            r_fmt(fmt_stat(h["home_possession"], "pct"), "Posesion", fmt_stat(h["away_possession"], "pct")),
            sep_52_dash,
        ])

    tactics_lines = [
        "CANALES DE ATAQUE (PASES ULTIMO TERCIO)", sep_52,
        "   LOCAL    ZONA / PASILLO                  VISITANTE", sep_52_dash,
        r_fmt(f"{home_attack_channels['left_passes_completed']} ({home_attack_channels['left_pct']:.0f}%)" if home_attack_channels['left_pct'] is not None else "-", "Banda Izquierda", f"{away_attack_channels['left_passes_completed']} ({away_attack_channels['left_pct']:.0f}%)" if away_attack_channels['left_pct'] is not None else "-"),
        r_fmt(f"{home_attack_channels['center_passes_completed']} ({home_attack_channels['center_pct']:.0f}%)" if home_attack_channels['center_pct'] is not None else "-", "Pasillo Central", f"{away_attack_channels['center_passes_completed']} ({away_attack_channels['center_pct']:.0f}%)" if away_attack_channels['center_pct'] is not None else "-"),
        r_fmt(f"{home_attack_channels['right_passes_completed']} ({home_attack_channels['right_pct']:.0f}%)" if home_attack_channels['right_pct'] is not None else "-", "Banda Derecha", f"{away_attack_channels['right_passes_completed']} ({away_attack_channels['right_pct']:.0f}%)" if away_attack_channels['right_pct'] is not None else "-"),
        sep_52_dash,
        "   LOCAL    TIPOLOGIA DE REMATES            VISITANTE", sep_52_dash,
        r_fmt(str(home_shot_typology["open_play"]), "Jugada Abierta", str(away_shot_typology["open_play"])),
        r_fmt(str(home_shot_typology["set_piece"]), "Balon Parado", str(away_shot_typology["set_piece"])),
        r_fmt(str(home_shot_typology["counter_attack"]), "Contraataque", str(away_shot_typology["counter_attack"])),
        r_fmt(str(home_shot_typology["penalty"]), "Penalti", str(away_shot_typology["penalty"])),
        r_fmt(str(home_shot_typology["total"]), "Total Remates", str(away_shot_typology["total"])),
    ]

    clipboard_text = "\n".join(team_lines + goals_lines + halves_lines + tactics_lines)

    home_players = _get_team_player_performances(cursor=cursor, match_id=match_id, team_id=home_id, is_home=True, opponent_score=int(match_row["away_score"] or 0))
    away_players = _get_team_player_performances(cursor=cursor, match_id=match_id, team_id=away_id, is_home=False, opponent_score=int(match_row["home_score"] or 0))
    home_player_text = _format_player_section_for_clipboard(home_players, home_name, "LOCAL", is_last=False)
    away_player_text = _format_player_section_for_clipboard(away_players, away_name, "VISITANTE", is_last=True)
    full_clipboard_text = f"{clipboard_text}\n{home_player_text}\n{away_player_text}"

    return {
        "match_id": match_id,
        "metadata": metadata,
        "attack_metrics": attack_metrics,
        "passing_metrics": passing_metrics,
        "defense_metrics": defense_metrics,
        "discipline_metrics": discipline_metrics,
        "clipboard_text": full_clipboard_text,
        "home_players": home_players,
        "away_players": away_players,
        "venue": venue,
        "referee": referee,
        "goals_chronology": goals_chronology,
        "card_incidents": card_incidents,
        "substitution_incidents": substitution_incidents,
        "game_state": game_state,
        "half_period_stats": half_period_stats,
        "home_attack_channels": home_attack_channels,
        "away_attack_channels": away_attack_channels,
        "home_shot_typology": home_shot_typology,
        "away_shot_typology": away_shot_typology,
        "fouls_source": fouls_source,
        "shots_source": shots_source,
    }


# Convenient alias
_build_sheet_03_datahub = build_match_sheet_03_datahub
