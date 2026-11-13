"""
FastAPI router for match-level statistics and analytics.
"""

import math
import sqlite3
import statistics
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from fastapi import APIRouter, Depends, HTTPException, status

from ..core.database import get_db
from ..schemas.match import MatchSheet02Response, MatchSheet03DataHubResponse
from .matches_sheet_03 import build_match_sheet_03_datahub, _build_sheet_03_datahub
from api.services.flashscore_service import get_match_flashscore_stats

router = APIRouter(prefix="/matches", tags=["Matches"])

# Standard FIFA pitch dimensions in meters used across the codebase
# (see scraper/sources/team_metrics.py and api/repositories/team_repo.py)
PITCH_LENGTH_M = 105.0
PITCH_WIDTH_M = 68.0
DEEP_COMPLETION_RADIUS_M = 20.0
DEEP_COMPLETION_RADIUS_SQ_M2 = DEEP_COMPLETION_RADIUS_M * DEEP_COMPLETION_RADIUS_M


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


def _split_base_minute_and_added_time(
    raw_minute: Optional[int],
    period: Optional[str],
    explicit_added_time: Optional[int] = None,
) -> Tuple[int, Optional[int]]:
    """
    Split a goal minute into (base_minute, added_time) without using floats.
    - If explicit_added_time is provided (and > 0), returns (raw_minute, explicit_added_time).
    - If period == '1T' and raw_minute > 45, returns (45, raw_minute - 45).
    - If raw_minute > 90, returns (90, raw_minute - 90).
    - Otherwise returns (raw_minute, None).
    """
    if raw_minute is None:
        base_min = 45 if period == "1T" else 90
    else:
        base_min = int(raw_minute)

    if explicit_added_time is not None and int(explicit_added_time) > 0:
        return base_min, int(explicit_added_time)

    if period == "1T" and base_min > 45:
        return 45, base_min - 45
    if base_min > 90:
        return 90, base_min - 90

    return base_min, None


def _compute_spatial_box_and_deep_completions(
    cursor: sqlite3.Cursor,
    match_id: int,
    home_id: int,
    away_id: int,
    tmm_home: Dict[str, Any],
    tmm_away: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Compute Module 02 spatial metrics per Option 1A:
    - Passes into box: completed passes ending in penalty area (x_end >= 83.5, 21.1 <= y_end <= 78.9).
    - Carries into box: ball carries starting outside x < 83.5 and ending inside penalty area
      (x_start < 83.5 AND x_end >= 83.5 AND 21.1 <= y_end <= 78.9).
    - Deep completions: completed non-cross passes ending within <= 20.0m of the opponent goal center
      (x = 100, y = 50) on a 105m x 68m pitch.
      Crosses are excluded per scraper/sources/team_metrics.py:73:
      (y_start < 21.1 OR y_start > 78.9) AND x_start >= 60.0 AND x_end >= 83.5 AND y_end BETWEEN 21.1 AND 78.9.
    """
    pass_rows = cursor.execute(
        """
        SELECT
            pms.team_id AS team_id,
            COUNT(*) AS total_passes,
            SUM(
                CASE
                    WHEN pp.is_successful = 1
                     AND pp.x_end >= 83.5
                     AND pp.y_end BETWEEN 21.1 AND 78.9
                    THEN 1 ELSE 0
                END
            ) AS passes_into_box,
            SUM(
                CASE
                    WHEN pp.is_successful = 1
                     AND pp.x_end >= 66.7
                    THEN 1 ELSE 0
                END
            ) AS final_third_passes,
            SUM(
                CASE
                    WHEN pp.is_successful = 1
                     AND NOT (
                         (pp.y_start < 21.1 OR pp.y_start > 78.9)
                         AND pp.x_start >= 60.0
                         AND pp.x_end >= 83.5
                         AND pp.y_end BETWEEN 21.1 AND 78.9
                     )
                     AND (
                         ((100.0 - pp.x_end) * 1.05) * ((100.0 - pp.x_end) * 1.05)
                         + ((50.0 - pp.y_end) * 0.68) * ((50.0 - pp.y_end) * 0.68)
                     ) <= ?
                    THEN 1 ELSE 0
                END
            ) AS deep_completions
        FROM player_passes pp
        JOIN player_match_stats pms
          ON pp.match_id = pms.match_id AND pp.player_id = pms.player_id
        WHERE pp.match_id = ?
        GROUP BY pms.team_id
        """,
        (DEEP_COMPLETION_RADIUS_SQ_M2, match_id),
    ).fetchall()

    pass_by_team = {int(r["team_id"]): dict(r) for r in pass_rows if r["team_id"] is not None}
    has_raw_passes = sum(int(r.get("total_passes") or 0) for r in pass_by_team.values()) > 0

    carry_rows = cursor.execute(
        """
        SELECT
            COALESCE(pms.team_id, CASE WHEN pbc.is_home = 1 THEN ? ELSE ? END) AS team_id,
            COUNT(*) AS total_carries,
            SUM(
                CASE
                    WHEN pbc.x_start < 83.5
                     AND pbc.x_end >= 83.5
                     AND pbc.y_end BETWEEN 21.1 AND 78.9
                    THEN 1 ELSE 0
                END
            ) AS carries_into_box
        FROM player_ball_carries pbc
        LEFT JOIN player_match_stats pms
          ON pbc.match_id = pms.match_id AND pbc.player_id = pms.player_id
        WHERE pbc.match_id = ?
        GROUP BY COALESCE(pms.team_id, CASE WHEN pbc.is_home = 1 THEN ? ELSE ? END)
        """,
        (home_id, away_id, match_id, home_id, away_id),
    ).fetchall()

    carry_by_team = {int(r["team_id"]): dict(r) for r in carry_rows if r["team_id"] is not None}
    has_raw_carries = sum(int(r.get("total_carries") or 0) for r in carry_by_team.values()) > 0

    # Check if team_match_metrics has valid pass aggregates when raw player_passes are absent
    has_tmm_passes = bool(
        (tmm_home.get("passes_total") or 0) > 0
        or (tmm_away.get("passes_total") or 0) > 0
        or (tmm_home.get("final_third_passes_for") or 0) > 0
        or (tmm_away.get("final_third_passes_for") or 0) > 0
    )

    home_passes_box: Optional[int] = None
    away_passes_box: Optional[int] = None
    if has_raw_passes:
        home_passes_box = int(pass_by_team.get(home_id, {}).get("passes_into_box") or 0)
        away_passes_box = int(pass_by_team.get(away_id, {}).get("passes_into_box") or 0)
    elif has_tmm_passes and tmm_home.get("passes_into_box") is not None and tmm_away.get("passes_into_box") is not None:
        home_passes_box = int(tmm_home["passes_into_box"])
        away_passes_box = int(tmm_away["passes_into_box"])

    home_carries_box: Optional[int] = None
    away_carries_box: Optional[int] = None
    if has_raw_carries:
        home_carries_box = int(carry_by_team.get(home_id, {}).get("carries_into_box") or 0)
        away_carries_box = int(carry_by_team.get(away_id, {}).get("carries_into_box") or 0)

    if home_passes_box is not None and home_carries_box is not None and away_passes_box is not None and away_carries_box is not None:
        box_entries_source: Optional[str] = "passes_and_carries"
        home_box_entries: Optional[int] = home_passes_box + home_carries_box
        away_box_entries: Optional[int] = away_passes_box + away_carries_box
    elif home_passes_box is not None and away_passes_box is not None:
        box_entries_source = "passes_only"
        home_box_entries = home_passes_box
        away_box_entries = away_passes_box
    elif home_carries_box is not None and away_carries_box is not None:
        box_entries_source = "carries_only"
        home_box_entries = home_carries_box
        away_box_entries = away_carries_box
    else:
        box_entries_source = None
        home_box_entries = None
        away_box_entries = None

    # Deep completions require raw player_passes coordinates
    if has_raw_passes:
        home_deep_completions: Optional[int] = int(pass_by_team.get(home_id, {}).get("deep_completions") or 0)
        away_deep_completions: Optional[int] = int(pass_by_team.get(away_id, {}).get("deep_completions") or 0)
    else:
        home_deep_completions = None
        away_deep_completions = None

    # Field tilt % from final_third_passes_for (or raw player_passes when tmm is absent)
    ft_home: Optional[int] = None
    ft_away: Optional[int] = None
    if has_tmm_passes and tmm_home.get("final_third_passes_for") is not None and tmm_away.get("final_third_passes_for") is not None:
        ft_home = int(tmm_home["final_third_passes_for"])
        ft_away = int(tmm_away["final_third_passes_for"])
    elif has_raw_passes:
        ft_home = int(pass_by_team.get(home_id, {}).get("final_third_passes") or 0)
        ft_away = int(pass_by_team.get(away_id, {}).get("final_third_passes") or 0)

    if ft_home is not None and ft_away is not None and (ft_home + ft_away) > 0:
        total_ft = float(ft_home + ft_away)
        home_field_tilt_pct: Optional[float] = round((ft_home / total_ft) * 100.0, 1)
        away_field_tilt_pct: Optional[float] = round((ft_away / total_ft) * 100.0, 1)
    else:
        home_field_tilt_pct = None
        away_field_tilt_pct = None

    return {
        "box_entries_source": box_entries_source,
        "home_box_entries": home_box_entries,
        "away_box_entries": away_box_entries,
        "home_passes_into_box": home_passes_box,
        "away_passes_into_box": away_passes_box,
        "home_carries_into_box": home_carries_box,
        "away_carries_into_box": away_carries_box,
        "home_deep_completions": home_deep_completions,
        "away_deep_completions": away_deep_completions,
        "home_field_tilt_pct": home_field_tilt_pct,
        "away_field_tilt_pct": away_field_tilt_pct,
    }


def _ramer_douglas_peucker(
    points: List[Tuple[float, float]],
    epsilon: float,
) -> List[Tuple[float, float]]:
    """
    Ramer-Douglas-Peucker algorithm to simplify 2D polylines.
    """
    if len(points) <= 2:
        return points

    start_pt = points[0]
    end_pt = points[-1]
    dx = end_pt[0] - start_pt[0]
    dy = end_pt[1] - start_pt[1]
    seg_len_sq = dx * dx + dy * dy

    max_dist = 0.0
    index = 0

    for i in range(1, len(points) - 1):
        pt = points[i]
        if seg_len_sq == 0:
            dist = math.hypot(pt[0] - start_pt[0], pt[1] - start_pt[1])
        else:
            num = abs(dy * pt[0] - dx * pt[1] + end_pt[0] * start_pt[1] - end_pt[1] * start_pt[0])
            dist = num / math.sqrt(seg_len_sq)

        if dist > max_dist:
            max_dist = dist
            index = i

    if max_dist > epsilon:
        res1 = _ramer_douglas_peucker(points[: index + 1], epsilon)
        res2 = _ramer_douglas_peucker(points[index:], epsilon)
        return res1[:-1] + res2
    return [start_pt, end_pt]


def _simplify_closed_loop(
    loop: List[Tuple[float, float]],
    epsilon: float = 0.35,
) -> List[Tuple[float, float]]:
    """
    Simplify a closed polygon loop using Ramer-Douglas-Peucker.
    Splits at the vertex furthest from the start point to preserve topological closure.
    """
    if len(loop) < 4:
        return loop
    pts = list(loop)
    if pts[0] == pts[-1]:
        pts = pts[:-1]
    if len(pts) < 4:
        return loop

    dists = [math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]) for p in pts]
    split_idx = int(np.argmax(dists))
    if split_idx <= 1 or split_idx >= len(pts) - 2:
        split_idx = len(pts) // 2

    poly1 = pts[: split_idx + 1]
    poly2 = pts[split_idx:] + [pts[0]]

    simp1 = _ramer_douglas_peucker(poly1, epsilon)
    simp2 = _ramer_douglas_peucker(poly2, epsilon)
    return simp1[:-1] + simp2


def _compute_density_field(
    points: List[Tuple[float, float]],
    nx: int = 61,
    ny: int = 41,
    sigma_cells: float = 3.5,
) -> np.ndarray:
    """
    Compute a continuous 2D Gaussian-smoothed density field across [0, 100] x [0, 100].
    Points are splatted with bilinear weights and smoothed via separable 1D Gaussian kernels.
    """
    grid = np.zeros((ny, nx), dtype=np.float64)
    if not points:
        return grid

    for x, y in points:
        gx = (x / 100.0) * (nx - 1)
        gy = (y / 100.0) * (ny - 1)
        i0 = int(math.floor(gx))
        i1 = min(nx - 1, i0 + 1)
        j0 = int(math.floor(gy))
        j1 = min(ny - 1, j0 + 1)
        fx = gx - i0
        fy = gy - j0

        grid[j0, i0] += (1.0 - fx) * (1.0 - fy)
        grid[j0, i1] += fx * (1.0 - fy)
        grid[j1, i0] += (1.0 - fx) * fy
        grid[j1, i1] += fx * fy

    radius = int(math.ceil(3.0 * sigma_cells))
    k_range = np.arange(-radius, radius + 1)
    kernel = np.exp(-0.5 * (k_range / sigma_cells) ** 2)
    kernel_sum = kernel.sum()
    if kernel_sum > 0:
        kernel /= kernel_sum

    temp = np.apply_along_axis(lambda m: np.convolve(m, kernel, mode="same"), axis=1, arr=grid)
    smoothed = np.apply_along_axis(lambda m: np.convolve(m, kernel, mode="same"), axis=0, arr=temp)
    return smoothed


def _extract_contours_for_threshold(
    grid: np.ndarray,
    threshold: float,
    nx: int = 61,
    ny: int = 41,
    epsilon: float = 0.35,
) -> Tuple[str, int]:
    """
    Extract iso-contours for a scalar grid using Marching Squares with 1-cell zero-padding.
    Returns SVG path string ('M x y L x y ... Z') and total vertex count.
    """
    if threshold <= 0 or float(np.max(grid)) < threshold:
        return "", 0

    dx = 100.0 / (nx - 1)
    dy = 100.0 / (ny - 1)

    padded = np.zeros((ny + 2, nx + 2), dtype=np.float64)
    padded[1:-1, 1:-1] = grid
    p_ny, p_nx = padded.shape

    def get_x(c: int) -> float:
        return (c - 1) * dx

    def get_y(r: int) -> float:
        return (r - 1) * dy

    def interp_x(c0: int, c1: int, r: int, v0: float, v1: float) -> Tuple[float, float]:
        if abs(v1 - v0) < 1e-12:
            t = 0.5
        else:
            t = (threshold - v0) / (v1 - v0)
        t = max(0.0, min(1.0, t))
        raw_x = get_x(c0) + t * dx
        return min(100.0, max(0.0, raw_x)), min(100.0, max(0.0, get_y(r)))

    def interp_y(c: int, r0: int, r1: int, v0: float, v1: float) -> Tuple[float, float]:
        if abs(v1 - v0) < 1e-12:
            t = 0.5
        else:
            t = (threshold - v0) / (v1 - v0)
        t = max(0.0, min(1.0, t))
        raw_y = get_y(r0) + t * dy
        return min(100.0, max(0.0, get_x(c))), min(100.0, max(0.0, raw_y))

    edge_pt: Dict[Tuple[str, int, int], Tuple[float, float]] = {}
    edge_next: Dict[Tuple[str, int, int], Tuple[str, int, int]] = {}

    for r in range(p_ny - 1):
        for c in range(p_nx - 1):
            v0 = padded[r, c]
            v1 = padded[r, c + 1]
            v2 = padded[r + 1, c + 1]
            v3 = padded[r + 1, c]

            case = (
                (1 if v0 >= threshold else 0)
                | (2 if v1 >= threshold else 0)
                | (4 if v2 >= threshold else 0)
                | (8 if v3 >= threshold else 0)
            )

            if case == 0 or case == 15:
                continue

            e0 = ("H", r, c)
            e1 = ("V", r, c + 1)
            e2 = ("H", r + 1, c)
            e3 = ("V", r, c)

            if e0 not in edge_pt and case in (1, 2, 3, 5, 6, 9, 10, 12, 13, 14):
                edge_pt[e0] = interp_x(c, c + 1, r, v0, v1)
            if e1 not in edge_pt and case in (2, 3, 4, 5, 6, 7, 10, 11, 12, 13):
                edge_pt[e1] = interp_y(c + 1, r, r + 1, v1, v2)
            if e2 not in edge_pt and case in (4, 5, 6, 7, 8, 9, 10, 11, 12, 14):
                edge_pt[e2] = interp_x(c, c + 1, r + 1, v3, v2)
            if e3 not in edge_pt and case in (1, 3, 5, 7, 8, 9, 10, 11, 13, 14):
                edge_pt[e3] = interp_y(c, r, r + 1, v0, v3)

            center_val = 0.25 * (v0 + v1 + v2 + v3)

            if case == 1:
                edge_next[e3] = e0
            elif case == 2:
                edge_next[e0] = e1
            elif case == 3:
                edge_next[e3] = e1
            elif case == 4:
                edge_next[e1] = e2
            elif case == 5:
                if center_val >= threshold:
                    edge_next[e3] = e2
                    edge_next[e1] = e0
                else:
                    edge_next[e3] = e0
                    edge_next[e1] = e2
            elif case == 6:
                edge_next[e0] = e2
            elif case == 7:
                edge_next[e3] = e2
            elif case == 8:
                edge_next[e2] = e3
            elif case == 9:
                edge_next[e2] = e0
            elif case == 10:
                if center_val >= threshold:
                    edge_next[e0] = e3
                    edge_next[e2] = e1
                else:
                    edge_next[e0] = e1
                    edge_next[e2] = e3
            elif case == 11:
                edge_next[e2] = e1
            elif case == 12:
                edge_next[e1] = e3
            elif case == 13:
                edge_next[e1] = e0
            elif case == 14:
                edge_next[e0] = e3

    visited = set()
    loops: List[List[Tuple[float, float]]] = []

    for start_edge in list(edge_next.keys()):
        if start_edge in visited:
            continue
        loop: List[Tuple[float, float]] = []
        curr = start_edge
        stuck = False
        while curr not in visited:
            visited.add(curr)
            if curr in edge_pt:
                loop.append(edge_pt[curr])
            if curr in edge_next:
                curr = edge_next[curr]
            else:
                stuck = True
                break
            if curr == start_edge:
                break
        if not stuck and len(loop) >= 3:
            loops.append(loop)

    path_commands = []
    total_points = 0

    for loop in loops:
        simp = _simplify_closed_loop(loop, epsilon=epsilon)
        cleaned: List[Tuple[float, float]] = []
        for pt in simp:
            rpt = (round(pt[0], 1), round(pt[1], 1))
            if not cleaned or cleaned[-1] != rpt:
                cleaned.append(rpt)
        if len(cleaned) >= 3 and cleaned[0] == cleaned[-1]:
            cleaned.pop()
        if len(cleaned) < 3:
            continue

        total_points += len(cleaned)
        cmd = (
            f"M {cleaned[0][0]:.1f} {cleaned[0][1]:.1f} "
            + " ".join(f"L {pt[0]:.1f} {pt[1]:.1f}" for pt in cleaned[1:])
            + " Z"
        )
        path_commands.append(cmd)

    svg_path = " ".join(path_commands)
    return svg_path, total_points


def _compute_opponent_half_density_grids(
    cursor: sqlite3.Cursor,
    match_id: int,
    home_id: int,
    away_id: int,
    processed_shots: List[Dict[str, Any]],
) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
    """
    Compute 10x7 pre-aggregated density grids and smooth vector KDE contours across
    the ENTIRE regulation pitch (x in [0.0, 100.0], y in [0.0, 100.0], attacking -> toward x = 100.0)
    for Home and Away.
    Sources included in full_pitch_ball_actions:
    - player_passes: pass origin (x_start, y_start) + completed pass reception (x_end, y_end)
    - player_ball_carries: carry origin (x_start, y_start) only (do not duplicate with carry end)
    - player_dribbles: dribble location (x, y)
    - player_defensive_actions: defensive action location (x, y)
    - player_shots: normalized raw shot location (raw_x, y)
    Both teams are normalized to the maximum cell count / density peak of the match.
    If the match has no spatial pass/carry/dribble/defensive actions and no shots, returns (None, None).
    """
    rows_n = 7
    cols_n = 10
    col_step = 100.0 / float(cols_n)  # 10.0 units per column across [0, 100]
    row_step = 100.0 / float(rows_n)  # 14.2857... units per row across [0, 100]

    grids: Dict[int, List[List[int]]] = {
        home_id: [[0 for _ in range(cols_n)] for _ in range(rows_n)],
        away_id: [[0 for _ in range(cols_n)] for _ in range(rows_n)],
    }
    raw_points: Dict[int, List[Tuple[float, float]]] = {
        home_id: [],
        away_id: [],
    }

    def _add_point(team_id: int, x_val: Optional[float], y_val: Optional[float]) -> None:
        if team_id not in grids or x_val is None or y_val is None:
            return
        xf_clamped = min(100.0, max(0.0, float(x_val)))
        yf_clamped = min(100.0, max(0.0, float(y_val)))
        c_idx = min(cols_n - 1, max(0, int(xf_clamped / col_step)))
        r_idx = min(rows_n - 1, max(0, int(yf_clamped / row_step)))
        grids[team_id][r_idx][c_idx] += 1
        raw_points[team_id].append((xf_clamped, yf_clamped))

    # 1. Passes across entire pitch
    pass_pts = cursor.execute(
        """
        SELECT pms.team_id, pp.x_start, pp.y_start, pp.x_end, pp.y_end, pp.is_successful
        FROM player_passes pp
        JOIN player_match_stats pms
          ON pp.match_id = pms.match_id AND pp.player_id = pms.player_id
        WHERE pp.match_id = ?
        """,
        (match_id,),
    ).fetchall()
    for r in pass_pts:
        tid = int(r["team_id"])
        if r["x_start"] is not None and r["y_start"] is not None:
            _add_point(tid, r["x_start"], r["y_start"])
        if r["is_successful"] == 1 and r["x_end"] is not None and r["y_end"] is not None:
            _add_point(tid, r["x_end"], r["y_end"])

    # 2. Ball carries across entire pitch (carry origin only per Decision 1A)
    carry_pts = cursor.execute(
        """
        SELECT
            COALESCE(pms.team_id, CASE WHEN pbc.is_home = 1 THEN ? ELSE ? END) AS team_id,
            pbc.x_start, pbc.y_start
        FROM player_ball_carries pbc
        LEFT JOIN player_match_stats pms
          ON pbc.match_id = pms.match_id AND pbc.player_id = pms.player_id
        WHERE pbc.match_id = ?
        """,
        (home_id, away_id, match_id),
    ).fetchall()
    for r in carry_pts:
        tid = int(r["team_id"])
        if r["x_start"] is not None and r["y_start"] is not None:
            _add_point(tid, r["x_start"], r["y_start"])

    # 3. Dribbles across entire pitch
    dribble_pts = cursor.execute(
        """
        SELECT pms.team_id, pd.x, pd.y
        FROM player_dribbles pd
        JOIN player_match_stats pms
          ON pd.match_id = pms.match_id AND pd.player_id = pms.player_id
        WHERE pd.match_id = ?
        """,
        (match_id,),
    ).fetchall()
    for r in dribble_pts:
        if r["x"] is not None and r["y"] is not None:
            _add_point(int(r["team_id"]), r["x"], r["y"])

    # 4. Defensive actions across entire pitch (if table exists in SQLite schema)
    def_pts = []
    try:
        def_pts = cursor.execute(
            """
            SELECT
                COALESCE(pms.team_id, CASE WHEN pda.is_home = 1 THEN ? ELSE ? END) AS team_id,
                pda.x, pda.y
            FROM player_defensive_actions pda
            LEFT JOIN player_match_stats pms
              ON pda.match_id = pms.match_id AND pda.player_id = pms.player_id
            WHERE pda.match_id = ?
            """,
            (home_id, away_id, match_id),
        ).fetchall()
        for r in def_pts:
            if r["x"] is not None and r["y"] is not None:
                _add_point(int(r["team_id"]), r["x"], r["y"])
    except Exception:
        def_pts = []

    has_tracking_events = (len(pass_pts) + len(carry_pts) + len(dribble_pts) + len(def_pts)) > 0

    # 5. Shots across entire pitch
    if has_tracking_events:
        for s in processed_shots:
            raw_x_val = float(s.get("raw_x", s["x"]))
            _add_point(int(s["team_id"]), raw_x_val, float(s["y"]))

    if not has_tracking_events:
        return None, None

    home_max = max(max(row) for row in grids[home_id])
    away_max = max(max(row) for row in grids[away_id])
    match_max = max(home_max, away_max)

    # Compute continuous 2D KDE vector contours at 25%, 50%, and 75% of match density peak
    home_pts = raw_points[home_id]
    away_pts = raw_points[away_id]
    home_contours: Optional[List[Dict[str, Any]]] = None
    away_contours: Optional[List[Dict[str, Any]]] = None

    if len(home_pts) > 0 or len(away_pts) > 0:
        grid_home = _compute_density_field(home_pts, nx=61, ny=41, sigma_cells=3.5)
        grid_away = _compute_density_field(away_pts, nx=61, ny=41, sigma_cells=3.5)

        max_dens_h = float(np.max(grid_home)) if len(home_pts) > 0 else 0.0
        max_dens_a = float(np.max(grid_away)) if len(away_pts) > 0 else 0.0
        match_max_density = max(max_dens_h, max_dens_a)

        if match_max_density > 0:
            contour_levels = [0.25, 0.50, 0.75]
            home_contours = []
            away_contours = []
            for lvl in contour_levels:
                thresh = lvl * match_max_density
                svg_h, pts_h = _extract_contours_for_threshold(grid_home, thresh, nx=61, ny=41)
                home_contours.append({
                    "level": lvl,
                    "threshold": round(thresh, 4),
                    "svg_path": svg_h,
                    "point_count": pts_h,
                })
                svg_a, pts_a = _extract_contours_for_threshold(grid_away, thresh, nx=61, ny=41)
                away_contours.append({
                    "level": lvl,
                    "threshold": round(thresh, 4),
                    "svg_path": svg_a,
                    "point_count": pts_a,
                })

    def _serialize_grid(
        team_id: int,
        team_max: int,
        contours: Optional[List[Dict[str, Any]]],
    ) -> Dict[str, Any]:
        g = grids[team_id]
        total_actions = sum(sum(row) for row in g)
        norm_g: List[List[float]] = []
        cells: List[Dict[str, Any]] = []
        for r_idx in range(rows_n):
            norm_row: List[float] = []
            y_min = round(r_idx * row_step, 1)
            y_max = round((r_idx + 1) * row_step, 1)
            for c_idx in range(cols_n):
                cnt = g[r_idx][c_idx]
                intensity = round(cnt / float(match_max), 3) if match_max > 0 else 0.0
                norm_row.append(intensity)
                x_min = round(c_idx * col_step, 1)
                x_max = round((c_idx + 1) * col_step, 1)
                cells.append({
                    "row": r_idx,
                    "col": c_idx,
                    "x_min": x_min,
                    "x_max": x_max,
                    "y_min": y_min,
                    "y_max": y_max,
                    "count": cnt,
                    "intensity": intensity,
                })
            norm_g.append(norm_row)

        return {
            "rows": rows_n,
            "cols": cols_n,
            "grid": g,
            "normalized_grid": norm_g,
            "cells": cells,
            "max_count": match_max,
            "team_max_count": team_max,
            "total_actions": total_actions,
            "density_source": "full_pitch_ball_actions",
            "contours": contours,
        }

    return _serialize_grid(home_id, home_max, home_contours), _serialize_grid(away_id, away_max, away_contours)

_compute_full_pitch_density_grids = _compute_opponent_half_density_grids


def _build_sheet_01_chances(db: sqlite3.Connection, match_id: int) -> Dict[str, Any]:
    """
    Assemble complete tactical payload for Sheet 01 / 04 ('The result and the chances'):
    - Preserves all legacy Phase 1 fields (`metrics`, `xg_flow`, `shots`) for backwards compatibility.
    - Adds the 6-module Editorial Contract (`MatchSheet01EditorialResponse`):
      * `scoreboard_kpis`
      * `module_01_xg_flow`
      * `module_02_chance_balance` (Option 1A: passes + carries into box, deep completions <= 20m, field tilt %)
      * `module_03_home_shots` & `module_04_away_shots` (Option 3B: 6x5 density + Option 4A: own-half clamp x'=50)
      * `module_05_chance_to_goal` (`created_xg`, `on_frame_xg`, `struck_xgot` nullable, `scored_goals`)
      * `module_06_shot_outcomes` (Option 2A: `goals`, `saved`, `blocked`, `off_target`, `woodwork`)
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

    # 1. Fetch team_match_metrics rows for home and away (matched strictly by team_id)
    tmm_rows = cursor.execute(
        """
        SELECT *
        FROM team_match_metrics
        WHERE match_id = ?
        """,
        (match_id,),
    ).fetchall()
    tmm_by_team = {int(r["team_id"]): dict(r) for r in tmm_rows if r["team_id"] is not None}
    tmm_home = tmm_by_team.get(home_id, {})
    tmm_away = tmm_by_team.get(away_id, {})

    # 2. Fetch Flashscore stats ('ALL' period) if available (matched strictly by team_id)
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

    # 4. Fetch match goal incidents ordered by minute ASC, id DESC (true chronological order in SofaScore)
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
        ORDER BY minute ASC, id DESC
        """,
        (match_id,),
    ).fetchall()

    # Process shots and normalize coordinates (Option 4A: clamp x' < 50 to 50.0 with from_own_half = True)
    processed_shots: List[Dict[str, Any]] = []
    for idx, r in enumerate(shot_rows):
        if r["coord_x"] is not None:
            coord_x_m = float(r["coord_x"])
            raw_norm_x = round(max(0.0, min(100.0, 100.0 - (coord_x_m / PITCH_LENGTH_M) * 100.0)), 1)
        else:
            raw_norm_x = 85.0

        from_own_half = bool(raw_norm_x < 50.0)
        clamped_x = 50.0 if from_own_half else raw_norm_x

        if r["coord_y"] is not None:
            norm_y = round(max(0.0, min(100.0, float(r["coord_y"]))), 1)
        else:
            norm_y = 50.0

        raw_type = str(r["shot_type"] or "").strip().lower()
        if raw_type == "goal":
            result = "goal"
            outcome = "goal"
        elif raw_type in ("save", "saved"):
            result = "saved"
            outcome = "saved"
        elif raw_type in ("block", "blocked", "blocked-off-line"):
            result = "blocked"
            outcome = "blocked"
        else:
            # 'miss' or 'post' -> legacy `result` is 'miss', editorial `outcome` (Option 2A) is 'off_target'
            result = "miss"
            outcome = "off_target"

        is_woodwork = raw_type == "post"
        is_goal = result == "goal"

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
        p_name = r["player_name"] or "Jugador"

        processed_shots.append({
            "index": idx,
            "shot_id": int(r["shot_id"]),
            "is_home": is_home_shot,
            "team_id": home_id if is_home_shot else away_id,
            "x": clamped_x,
            "raw_x": raw_norm_x,
            "y": norm_y,
            "distance_m": round(float(r["distance_m"] or 0.0), 1),
            "xg": xg_val,
            "result": result,
            "outcome": outcome,
            "raw_outcome": raw_type or "miss",
            "is_goal": is_goal,
            "is_woodwork": is_woodwork,
            "from_own_half": from_own_half,
            "situation": situation,
            "body_part": body_part,
            "player": p_name,
            "player_name": p_name,
            "player_jersey": jersey,
            "minute": None,
            "added_time": None,
            "period": None,
            "incident_type": None,
        })

    # Pair goal shots with match_goal_incidents by team_id (matching player_name first, then chronological fallback)
    all_goal_incidents = [dict(g) for g in goal_rows]
    used_incident_ids: set[int] = set()

    for s in processed_shots:
        if s["is_goal"]:
            s_team_id = s["team_id"]
            # 1. Try exact player_name match among unused incidents for this team
            matched_inc = next(
                (
                    inc for inc in all_goal_incidents
                    if int(inc["id"]) not in used_incident_ids
                    and int(inc["team_id"]) == s_team_id
                    and (inc.get("player_name") or "").strip().lower() == s["player_name"].strip().lower()
                ),
                None,
            )
            # 2. Fallback to earliest unused non-ownGoal incident for this team
            if matched_inc is None:
                matched_inc = next(
                    (
                        inc for inc in all_goal_incidents
                        if int(inc["id"]) not in used_incident_ids
                        and int(inc["team_id"]) == s_team_id
                        and inc.get("incident_type") != "ownGoal"
                    ),
                    None,
                )
            # 3. Fallback to any unused incident for this team
            if matched_inc is None:
                matched_inc = next(
                    (
                        inc for inc in all_goal_incidents
                        if int(inc["id"]) not in used_incident_ids
                        and int(inc["team_id"]) == s_team_id
                    ),
                    None,
                )

            if matched_inc is not None:
                used_incident_ids.add(int(matched_inc["id"]))
                base_min, added_t = _split_base_minute_and_added_time(
                    matched_inc.get("minute"),
                    matched_inc.get("period"),
                )
                s["minute"] = base_min
                s["added_time"] = added_t
                s["period"] = matched_inc.get("period")
                s["incident_type"] = matched_inc.get("incident_type") or "regular"

    # Ensure anchored minutes are non-decreasing and interpolate remaining shots monotonically
    total_shots_n = len(processed_shots)
    anchors: List[Tuple[int, int]] = [(-1, 1)]
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

    # Any remaining unmatched ownGoal incidents (not represented as a row in player_shots)
    unmatched_own_goals = []
    for g in all_goal_incidents:
        if int(g["id"]) not in used_incident_ids and g.get("incident_type") == "ownGoal":
            base_min, added_t = _split_base_minute_and_added_time(g.get("minute"), g.get("period"))
            unmatched_own_goals.append({
                "id": int(g["id"]),
                "minute": base_min,
                "added_time": added_t,
                "period": g.get("period"),
                "team_id": int(g["team_id"]),
                "is_home": int(g["team_id"]) == home_id,
                "player_name": g.get("player_name") or "Autogol",
                "incident_type": "ownGoal",
            })

    timeline_events: List[Dict[str, Any]] = []
    for s in processed_shots:
        timeline_events.append({
            "minute": int(s["minute"] or 45),
            "added_time": int(s["added_time"] or 0),
            "order": s["index"],
            "kind": "shot",
            "shot": s,
        })
    for og_idx, og in enumerate(unmatched_own_goals):
        timeline_events.append({
            "minute": og["minute"],
            "added_time": int(og["added_time"] or 0),
            "order": 1000 + og_idx,
            "kind": "own_goal",
            "own_goal": og,
        })

    timeline_events.sort(key=lambda ev: (ev["minute"], ev["added_time"], ev["order"]))

    cum_home_xg = 0.0
    cum_away_xg = 0.0
    flow_points: List[Dict[str, Any]] = [
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
    editorial_goals: List[Dict[str, Any]] = []

    for ev in timeline_events:
        if ev["kind"] == "shot":
            s = ev["shot"]
            if s["is_home"]:
                cum_home_xg = round(cum_home_xg + s["xg"], 3)
            else:
                cum_away_xg = round(cum_away_xg + s["xg"], 3)

            is_og_shot = s.get("incident_type") == "ownGoal"
            flow_points.append({
                "minute": ev["minute"],
                "home_xg": round(cum_home_xg, 2),
                "away_xg": round(cum_away_xg, 2),
                "event_type": "own_goal" if is_og_shot else ("goal" if s["is_goal"] else "shot"),
                "is_home": s["is_home"],
                "shot_xg": round(s["xg"], 2),
                "player_name": f"{s['player_name']} (AG)" if is_og_shot else s["player_name"],
                "result": s["result"],
                "shot_id": s["shot_id"],
            })

            if s["is_goal"]:
                inc_type = s.get("incident_type") or ("penalty" if s["situation"] == "penalty" else "regular")
                editorial_goals.append({
                    "minute": int(s["minute"] or 45),
                    "added_time": s.get("added_time"),
                    "period": s.get("period") or ("1T" if int(s["minute"] or 45) <= 45 else "2T"),
                    "team_id": s["team_id"],
                    "is_home": s["is_home"],
                    "player_name": s["player_name"],
                    "incident_type": inc_type,
                    "shot_xg": round(s["xg"], 2),
                    "cum_team_xg": round(cum_home_xg if s["is_home"] else cum_away_xg, 2),
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
            editorial_goals.append({
                "minute": og["minute"],
                "added_time": og["added_time"],
                "period": og["period"] or ("1T" if og["minute"] <= 45 else "2T"),
                "team_id": og["team_id"],
                "is_home": og["is_home"],
                "player_name": og["player_name"],
                "incident_type": "ownGoal",
                "shot_xg": 0.0,
                "cum_team_xg": round(cum_home_xg if og["is_home"] else cum_away_xg, 2),
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

    # Comparative metrics (matched strictly by team_id)
    home_xg = round(float(tmm_home["xg_for"]) if tmm_home.get("xg_for") is not None else cum_home_xg, 2)
    away_xg = round(float(tmm_away["xg_for"]) if tmm_away.get("xg_for") is not None else cum_away_xg, 2)

    home_npxg = round(float(tmm_home["npxg_for"]) if tmm_home.get("npxg_for") is not None else home_xg, 2)
    away_npxg = round(float(tmm_away["npxg_for"]) if tmm_away.get("npxg_for") is not None else away_xg, 2)

    # Strict rule: xGOT is None when Flashscore is absent (never invented)
    home_xgot = round(float(fs_home["xgot"]), 2) if (fs_home is not None and fs_home.get("xgot") is not None) else None
    away_xgot = round(float(fs_away["xgot"]), 2) if (fs_away is not None and fs_away.get("xgot") is not None) else None
    has_xgot = bool(home_xgot is not None and away_xgot is not None)

    home_shots_total = int(tmm_home["shots_for"]) if tmm_home.get("shots_for") is not None else len(home_shots)
    away_shots_total = int(tmm_away["shots_for"]) if tmm_away.get("shots_for") is not None else len(away_shots)

    home_sot = int(
        tmm_home["shots_on_target_for"]
        if tmm_home.get("shots_on_target_for") is not None
        else sum(1 for s in home_shots if s["result"] in ("goal", "saved"))
    )
    away_sot = int(
        tmm_away["shots_on_target_for"]
        if tmm_away.get("shots_on_target_for") is not None
        else sum(1 for s in away_shots if s["result"] in ("goal", "saved"))
    )

    home_inside_box = int(
        tmm_home["shots_inside_box_for"]
        if tmm_home.get("shots_inside_box_for") is not None
        else sum(1 for s in home_shots if s["distance_m"] > 0 and s["distance_m"] <= 16.5)
    )
    away_inside_box = int(
        tmm_away["shots_inside_box_for"]
        if tmm_away.get("shots_inside_box_for") is not None
        else sum(1 for s in away_shots if s["distance_m"] > 0 and s["distance_m"] <= 16.5)
    )

    home_outside_box = int(
        tmm_home["shots_outside_box_for"]
        if tmm_home.get("shots_outside_box_for") is not None
        else max(0, home_shots_total - home_inside_box)
    )
    away_outside_box = int(
        tmm_away["shots_outside_box_for"]
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

    has_any_match_data = bool(len(processed_shots) > 0 or len(tmm_rows) > 0 or len(goal_rows) > 0)

    # -----------------------------------------------------------------------
    # Editorial Module Builders (each independently nullable)
    # -----------------------------------------------------------------------

    # Cabecera / Scoreboard KPIs
    scoreboard_kpis: Optional[Dict[str, Any]] = None
    if has_any_match_data:
        scoreboard_kpis = {
            "home": {
                "xg": home_xg if (len(home_shots) > 0 or tmm_home.get("xg_for") is not None) else None,
                "xgot": home_xgot,
                "shots": home_shots_total if (len(home_shots) > 0 or tmm_home.get("shots_for") is not None) else None,
                "on_target": home_sot if (len(home_shots) > 0 or tmm_home.get("shots_on_target_for") is not None) else None,
            },
            "away": {
                "xg": away_xg if (len(away_shots) > 0 or tmm_away.get("xg_for") is not None) else None,
                "xgot": away_xgot,
                "shots": away_shots_total if (len(away_shots) > 0 or tmm_away.get("shots_for") is not None) else None,
                "on_target": away_sot if (len(away_shots) > 0 or tmm_away.get("shots_on_target_for") is not None) else None,
            },
        }

    # Module 01: xG Flow Step Chart + Goals
    module_01_xg_flow: Optional[Dict[str, Any]] = None
    if len(processed_shots) > 0 or len(goal_rows) > 0:
        module_01_xg_flow = {
            "points": flow_points,
            "goals": editorial_goals,
        }

    # Module 02: Chance Balance (Option 1A)
    module_02_chance_balance: Optional[Dict[str, Any]] = None
    try:
        spatial_m02 = _compute_spatial_box_and_deep_completions(
            cursor=cursor,
            match_id=match_id,
            home_id=home_id,
            away_id=away_id,
            tmm_home=tmm_home,
            tmm_away=tmm_away,
        )
        if has_any_match_data or spatial_m02["box_entries_source"] is not None:
            module_02_chance_balance = {
                "home": {
                    "goals": home_score,
                    "xg_per_shot": round(home_xg / home_shots_total, 2) if home_shots_total > 0 else None,
                    "big_chances": home_big_chances if (has_fs_big_chances or len(processed_shots) > 0) else None,
                    "shots_inside_box": home_inside_box,
                    "shots_outside_box": home_outside_box,
                    "box_entries": spatial_m02["home_box_entries"],
                    "passes_into_box": spatial_m02["home_passes_into_box"],
                    "carries_into_box": spatial_m02["home_carries_into_box"],
                    "field_tilt_pct": spatial_m02["home_field_tilt_pct"],
                    "deep_completions": spatial_m02["home_deep_completions"],
                },
                "away": {
                    "goals": away_score,
                    "xg_per_shot": round(away_xg / away_shots_total, 2) if away_shots_total > 0 else None,
                    "big_chances": away_big_chances if (has_fs_big_chances or len(processed_shots) > 0) else None,
                    "shots_inside_box": away_inside_box,
                    "shots_outside_box": away_outside_box,
                    "box_entries": spatial_m02["away_box_entries"],
                    "passes_into_box": spatial_m02["away_passes_into_box"],
                    "carries_into_box": spatial_m02["away_carries_into_box"],
                    "field_tilt_pct": spatial_m02["away_field_tilt_pct"],
                    "deep_completions": spatial_m02["away_deep_completions"],
                },
                "box_entries_source": spatial_m02["box_entries_source"],
                "big_chances_source": (
                    "flashscore"
                    if has_fs_big_chances
                    else ("derived_xg_030" if len(processed_shots) > 0 else None)
                ),
            }
    except Exception:
        module_02_chance_balance = None

    # Modules 03 & 04: Shot Maps + 6x5 Opponent Half Ball Actions Density (Option 3B + Option 4A)
    module_03_home_shots: Optional[Dict[str, Any]] = None
    module_04_away_shots: Optional[Dict[str, Any]] = None
    try:
        home_density, away_density = _compute_opponent_half_density_grids(
            cursor=cursor,
            match_id=match_id,
            home_id=home_id,
            away_id=away_id,
            processed_shots=processed_shots,
        )
    except Exception:
        home_density, away_density = None, None

    if len(processed_shots) > 0 or home_density is not None:
        module_03_home_shots = {
            "shots": home_shots,
            "own_half_shots_count": sum(1 for s in home_shots if s["from_own_half"]),
            "density": home_density,
        }
    if len(processed_shots) > 0 or away_density is not None:
        module_04_away_shots = {
            "shots": away_shots,
            "own_half_shots_count": sum(1 for s in away_shots if s["from_own_half"]),
            "density": away_density,
        }

    # Module 05: From Chance to Goal & Module 06: Shot Outcomes (Option 2A)
    module_05_chance_to_goal: Optional[Dict[str, Any]] = None
    module_06_shot_outcomes: Optional[Dict[str, Any]] = None

    if len(processed_shots) > 0 or len(tmm_rows) > 0:
        def _build_outcomes_and_funnel(
            team_shots: List[Dict[str, Any]],
            team_id_val: int,
            official_goals: int,
            team_xg_fallback: float,
            team_xgot_val: Optional[float],
        ) -> Tuple[Dict[str, Any], Dict[str, Any]]:
            goals_cnt = sum(1 for s in team_shots if s["outcome"] == "goal")
            saved_cnt = sum(1 for s in team_shots if s["outcome"] == "saved")
            blocked_cnt = sum(1 for s in team_shots if s["outcome"] == "blocked")
            off_target_cnt = sum(1 for s in team_shots if s["outcome"] == "off_target")
            woodwork_cnt = sum(1 for s in team_shots if s["is_woodwork"])
            total_cnt = goals_cnt + saved_cnt + blocked_cnt + off_target_cnt

            created_xg_val = (
                round(float(team_xg_fallback), 2)
                if team_xg_fallback is not None and (len(team_shots) == 0 or team_xg_fallback > 0)
                else round(sum(float(s["xg"]) for s in team_shots), 2)
            )
            on_frame_xg_raw = round(
                sum(float(s["xg"]) for s in team_shots if s["outcome"] in ("goal", "saved")),
                2,
            )
            on_frame_xg_val = min(created_xg_val, on_frame_xg_raw)

            og_for_cnt = sum(
                1 for g in all_goal_incidents
                if int(g["team_id"]) == team_id_val and g.get("incident_type") == "ownGoal"
            )

            m05_team = {
                "created_xg": created_xg_val,
                "on_frame_xg": on_frame_xg_val,
                "struck_xgot": team_xgot_val,
                "scored_goals": official_goals,
                "shot_goals": goals_cnt,
                "own_goals_for": og_for_cnt,
            }
            m06_team = {
                "total": total_cnt,
                "goals": goals_cnt,
                "saved": saved_cnt,
                "blocked": blocked_cnt,
                "off_target": off_target_cnt,
                "woodwork": woodwork_cnt,
            }
            return m05_team, m06_team

        m05_home, m06_home = _build_outcomes_and_funnel(
            home_shots, home_id, home_score, home_xg, home_xgot
        )
        m05_away, m06_away = _build_outcomes_and_funnel(
            away_shots, away_id, away_score, away_xg, away_xgot
        )

        module_05_chance_to_goal = {
            "home": m05_home,
            "away": m05_away,
        }
        if len(processed_shots) > 0:
            module_06_shot_outcomes = {
                "home": m06_home,
                "away": m06_away,
            }

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
        # 6-Module Editorial Contract (nullable per module)
        "scoreboard_kpis": scoreboard_kpis,
        "module_01_xg_flow": module_01_xg_flow,
        "module_02_chance_balance": module_02_chance_balance,
        "module_03_home_shots": module_03_home_shots,
        "module_04_away_shots": module_04_away_shots,
        "module_05_chance_to_goal": module_05_chance_to_goal,
        "module_06_shot_outcomes": module_06_shot_outcomes,
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


def _build_sheet_02_buildup(db: sqlite3.Connection, match_id: int) -> Dict[str, Any]:
    """
    Assemble complete tactical payload for Sheet 02 / 04 ('Build-up and penalty-area access'):
    - Metadata: match info and team info
    - 4 KPIs: field_tilt, progressive_passes, line_breaking_passes, box_entries
    - Module 01: Home Passing Shape (16-sector polar rose & summary)
    - Module 02: Away Passing Shape (16-sector polar rose & summary)
    """
    cursor = db.cursor()

    # 1. Fetch match and teams metadata
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
            m.season_id,
            ht.name AS home_name,
            ht.short_name AS home_short_name,
            ht.logo_url AS home_logo_url,
            ht.primary_color AS home_primary_color,
            at.name AS away_name,
            at.short_name AS away_short_name,
            at.logo_url AS away_logo_url,
            at.primary_color AS away_primary_color
        FROM matches m
        LEFT JOIN teams ht ON m.home_team_id = ht.team_id
        LEFT JOIN teams at ON m.away_team_id = at.team_id
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

    # 2. Tournament info & team_match_metrics
    tmm_rows = cursor.execute(
        "SELECT * FROM team_match_metrics WHERE match_id = ?",
        (match_id,),
    ).fetchall()
    tmm_by_team = {int(r["team_id"]): dict(r) for r in tmm_rows if r["team_id"] is not None}
    tmm_home = tmm_by_team.get(home_id, {})
    tmm_away = tmm_by_team.get(away_id, {})

    tournament = tmm_home.get("tournament") or tmm_away.get("tournament") or "Liga 1 Te Apuesto"

    metadata = {
        "match_id": match_id,
        "tournament": tournament,
        "round": match_row["round"],
        "match_date": match_row["match_date"],
        "home_team": {
            "team_id": home_id,
            "name": match_row["home_name"] or "Local",
            "short_name": match_row["home_short_name"],
            "score": int(match_row["home_score"] or 0),
            "logo_url": match_row["home_logo_url"],
            "primary_color": match_row["home_primary_color"],
        },
        "away_team": {
            "team_id": away_id,
            "name": match_row["away_name"] or "Visitante",
            "short_name": match_row["away_short_name"],
            "score": int(match_row["away_score"] or 0),
            "logo_url": match_row["away_logo_url"],
            "primary_color": match_row["away_primary_color"],
        },
    }

    # 3. Retrieve raw passes
    pass_rows = cursor.execute(
        """
        SELECT
            pp.id,
            COALESCE(pms.team_id, CASE WHEN pp.player_id IN (SELECT player_id FROM player_match_stats WHERE match_id = ? AND team_id = ?) THEN ? ELSE ? END) AS team_id,
            pp.player_id,
            pp.x_start,
            pp.y_start,
            pp.x_end,
            pp.y_end,
            pp.is_successful
        FROM player_passes pp
        LEFT JOIN player_match_stats pms
          ON pp.match_id = pms.match_id AND pp.player_id = pms.player_id
        WHERE pp.match_id = ?
        """,
        (match_id, home_id, home_id, away_id, match_id),
    ).fetchall()

    passes_by_team: Dict[int, List[Dict[str, Any]]] = {home_id: [], away_id: []}
    for r in pass_rows:
        tid = r["team_id"]
        if tid in passes_by_team:
            passes_by_team[tid].append(dict(r))

    # 4. Retrieve raw carries
    carry_rows = cursor.execute(
        """
        SELECT
            pbc.id,
            COALESCE(pms.team_id, CASE WHEN pbc.is_home = 1 THEN ? ELSE ? END) AS team_id,
            pbc.x_start,
            pbc.y_start,
            pbc.x_end,
            pbc.y_end
        FROM player_ball_carries pbc
        LEFT JOIN player_match_stats pms
          ON pbc.match_id = pms.match_id AND pbc.player_id = pms.player_id
        WHERE pbc.match_id = ?
        """,
        (home_id, away_id, match_id),
    ).fetchall()

    carries_by_team: Dict[int, List[Dict[str, Any]]] = {home_id: [], away_id: []}
    for r in carry_rows:
        tid = r["team_id"]
        if tid in carries_by_team:
            carries_by_team[tid].append(dict(r))

    # 5. Calculate the 4 KPIs
    # KPI 1: Field Tilt (% of final third passes/touches x >= 66.7)
    ft_home = sum(1 for p in passes_by_team[home_id] if p.get("is_successful") == 1 and p.get("x_end") is not None and p["x_end"] >= 66.7)
    ft_away = sum(1 for p in passes_by_team[away_id] if p.get("is_successful") == 1 and p.get("x_end") is not None and p["x_end"] >= 66.7)

    if (ft_home + ft_away) == 0 and (tmm_home.get("final_third_passes_for") or tmm_away.get("final_third_passes_for")):
        ft_home = int(tmm_home.get("final_third_passes_for") or 0)
        ft_away = int(tmm_away.get("final_third_passes_for") or 0)

    total_ft = float(ft_home + ft_away)
    if total_ft > 0:
        field_tilt_home = round((ft_home / total_ft) * 100.0, 1)
        field_tilt_away = round((ft_away / total_ft) * 100.0, 1)
    else:
        field_tilt_home = 50.0
        field_tilt_away = 50.0

    # KPI 2: Progressive Passes (Opta/StatsBomb formula: distance to (100, 50) decreases by >= 25%)
    def count_prog_passes(passes: List[Dict[str, Any]], tmm_val: Optional[int]) -> int:
        if passes:
            count = 0
            for p in passes:
                if p.get("is_successful") == 1 and p.get("x_start") is not None and p.get("x_end") is not None and p.get("y_start") is not None and p.get("y_end") is not None:
                    d_start_sq = (100.0 - p["x_start"]) ** 2 + (50.0 - p["y_start"]) ** 2
                    d_end_sq = (100.0 - p["x_end"]) ** 2 + (50.0 - p["y_end"]) ** 2
                    if d_end_sq <= 0.5625 * d_start_sq:
                        count += 1
            return count
        return int(tmm_val or 0)

    prog_home = count_prog_passes(passes_by_team[home_id], tmm_home.get("progressive_passes"))
    prog_away = count_prog_passes(passes_by_team[away_id], tmm_away.get("progressive_passes"))

    # KPI 3: Line-breaking Passes (Completed forward pass: x_start <= 60.0, x_end >= 65.0, dx >= 15.0)
    def count_line_breaking(passes: List[Dict[str, Any]]) -> int:
        count = 0
        for p in passes:
            if p.get("is_successful") == 1 and p.get("x_start") is not None and p.get("x_end") is not None:
                if p["x_start"] <= 60.0 and p["x_end"] >= 65.0 and (p["x_end"] - p["x_start"]) >= 15.0:
                    count += 1
        return count

    line_break_home = count_line_breaking(passes_by_team[home_id])
    line_break_away = count_line_breaking(passes_by_team[away_id])

    # KPI 4: Box Entries (Passes into box + Carries into box)
    def count_box_entries(
        passes: List[Dict[str, Any]],
        carries: List[Dict[str, Any]],
        tmm_passes_box: Optional[int],
        tmm_carries_box: Optional[int],
    ) -> int:
        passes_box = 0
        if passes:
            for p in passes:
                if p.get("is_successful") == 1 and p.get("x_start") is not None and p.get("x_end") is not None and p.get("y_start") is not None and p.get("y_end") is not None:
                    is_start_outside = p["x_start"] < 83.5 or p["y_start"] < 21.1 or p["y_start"] > 78.9
                    is_end_inside = p["x_end"] >= 83.5 and 21.1 <= p["y_end"] <= 78.9
                    if is_start_outside and is_end_inside:
                        passes_box += 1
        else:
            passes_box = int(tmm_passes_box or 0)

        carries_box = 0
        if carries:
            for c in carries:
                if c.get("x_start") is not None and c.get("x_end") is not None and c.get("y_start") is not None and c.get("y_end") is not None:
                    is_start_outside = c["x_start"] < 83.5 or c["y_start"] < 21.1 or c["y_start"] > 78.9
                    is_end_inside = c["x_end"] >= 83.5 and 21.1 <= c["y_end"] <= 78.9
                    if is_start_outside and is_end_inside:
                        carries_box += 1
        else:
            carries_box = int(tmm_carries_box or 0)

        return passes_box + carries_box

    box_entries_home = count_box_entries(
        passes_by_team[home_id],
        carries_by_team[home_id],
        tmm_home.get("passes_into_box"),
        tmm_home.get("progressive_carries"),
    )
    box_entries_away = count_box_entries(
        passes_by_team[away_id],
        carries_by_team[away_id],
        tmm_away.get("passes_into_box"),
        tmm_away.get("progressive_carries"),
    )

    kpis = {
        "field_tilt": {"home": field_tilt_home, "away": field_tilt_away},
        "progressive_passes": {"home": prog_home, "away": prog_away},
        "line_breaking_passes": {"home": line_break_home, "away": line_break_away},
        "box_entries": {"home": box_entries_home, "away": box_entries_away},
        "home": {
            "field_tilt": field_tilt_home,
            "progressive_passes": prog_home,
            "line_breaking_passes": line_break_home,
            "box_entries": box_entries_home,
        },
        "away": {
            "field_tilt": field_tilt_away,
            "progressive_passes": prog_away,
            "line_breaking_passes": line_break_away,
            "box_entries": box_entries_away,
        },
    }

    # 6. Passing Shape Modules (16 Sectors Polar Rose)
    def build_passing_shape(
        team_id: int,
        team_name: str,
        is_home: bool,
        passes: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        total_p = len(passes)
        comp_count = sum(1 for p in passes if p.get("is_successful") == 1)
        fwd_count = sum(
            1
            for p in passes
            if p.get("x_start") is not None and p.get("x_end") is not None and (p["x_end"] - p["x_start"]) > 0
        )

        summary = {
            "total_passes": total_p,
            "forward_pct": round((fwd_count / total_p) * 100.0, 1) if total_p > 0 else 0.0,
            "completed_pct": round((comp_count / total_p) * 100.0, 1) if total_p > 0 else 0.0,
        }

        # 16 sectors centered at k * 22.5 deg (k = 0..15)
        raw_sectors = [
            {"angle_deg": round(k * 22.5, 1), "distances_m": [], "successful": 0, "total": 0}
            for k in range(16)
        ]

        for p in passes:
            if (
                p.get("x_start") is None
                or p.get("x_end") is None
                or p.get("y_start") is None
                or p.get("y_end") is None
            ):
                continue

            dx = p["x_end"] - p["x_start"]
            # Mathematical orientation: North/Left is positive dy
            dy = -(p["y_end"] - p["y_start"])

            angle_rad = math.atan2(dy, dx)
            angle_deg = (math.degrees(angle_rad) + 360.0) % 360.0

            sec_idx = int((angle_deg + 11.25) // 22.5) % 16

            # Scaled distance in meters: 105m length, 68m width
            dx_m = dx * 1.05
            dy_m = (p["y_end"] - p["y_start"]) * 0.68
            dist_m = math.hypot(dx_m, dy_m)

            raw_sectors[sec_idx]["total"] += 1
            raw_sectors[sec_idx]["distances_m"].append(dist_m)
            if p.get("is_successful") == 1:
                raw_sectors[sec_idx]["successful"] += 1

        sectors = []
        for s in raw_sectors:
            cnt = s["total"]
            comp_pct = round((s["successful"] / cnt) * 100.0, 1) if cnt > 0 else 0.0
            med_dist = round(statistics.median(s["distances_m"]), 1) if cnt > 0 else 0.0
            sectors.append({
                "angle_deg": s["angle_deg"],
                "pass_count": cnt,
                "completion_pct": comp_pct,
                "median_distance_m": med_dist,
            })

        return {
            "team_id": team_id,
            "team_name": team_name,
            "is_home": is_home,
            "summary": summary,
            "sectors": sectors,
        }

    m01_home = build_passing_shape(
        home_id,
        metadata["home_team"]["name"],
        True,
        passes_by_team[home_id],
    )
    m02_away = build_passing_shape(
        away_id,
        metadata["away_team"]["name"],
        False,
        passes_by_team[away_id],
    )

    # 7. Modules 03 & 04: Box Entries and Density Contours
    home_density: Optional[Dict[str, Any]] = None
    away_density: Optional[Dict[str, Any]] = None
    try:
        shot_rows = cursor.execute(
            """
            SELECT is_home, coord_x, coord_y
            FROM player_shots
            WHERE match_id = ?
            """,
            (match_id,),
        ).fetchall()
        density_shots = []
        for r in shot_rows:
            if r["coord_x"] is not None:
                coord_x_m = float(r["coord_x"])
                raw_norm_x = round(max(0.0, min(100.0, 100.0 - (coord_x_m / PITCH_LENGTH_M) * 100.0)), 1)
            else:
                raw_norm_x = 85.0
            norm_y = round(max(0.0, min(100.0, float(r["coord_y"]))), 1) if r["coord_y"] is not None else 50.0
            tid = home_id if bool(r["is_home"]) else away_id
            density_shots.append({"team_id": tid, "raw_x": raw_norm_x, "x": raw_norm_x, "y": norm_y})

        home_density, away_density = _compute_full_pitch_density_grids(
            cursor,
            match_id,
            home_id,
            away_id,
            density_shots,
        )
    except Exception:
        home_density, away_density = None, None

    def build_box_entries(
        team_id: int,
        team_name: str,
        is_home: bool,
        passes: List[Dict[str, Any]],
        carries: List[Dict[str, Any]],
        density: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        entries = []
        for p in passes:
            if (
                p.get("is_successful") == 1
                and p.get("x_start") is not None
                and p.get("x_end") is not None
                and p.get("y_start") is not None
                and p.get("y_end") is not None
            ):
                is_start_outside = p["x_start"] < 83.5 or p["y_start"] < 21.1 or p["y_start"] > 78.9
                is_end_inside = p["x_end"] >= 83.5 and 21.1 <= p["y_end"] <= 78.9
                if is_start_outside and is_end_inside:
                    entry_type = "cross" if (p["y_start"] < 21.1 or p["y_start"] > 78.9) else "pass"
                    entries.append({
                        "id": int(p["id"]),
                        "entry_type": entry_type,
                        "x_start": round(float(p["x_start"]), 1),
                        "y_start": round(float(p["y_start"]), 1),
                        "x_end": round(float(p["x_end"]), 1),
                        "y_end": round(float(p["y_end"]), 1),
                    })

        for c in carries:
            if (
                c.get("x_start") is not None
                and c.get("x_end") is not None
                and c.get("y_start") is not None
                and c.get("y_end") is not None
            ):
                is_start_outside = c["x_start"] < 83.5 or c["y_start"] < 21.1 or c["y_start"] > 78.9
                is_end_inside = c["x_end"] >= 83.5 and 21.1 <= c["y_end"] <= 78.9
                if is_start_outside and is_end_inside:
                    entries.append({
                        "id": int(c["id"]),
                        "entry_type": "carry",
                        "x_start": round(float(c["x_start"]), 1),
                        "y_start": round(float(c["y_start"]), 1),
                        "x_end": round(float(c["x_end"]), 1),
                        "y_end": round(float(c["y_end"]), 1),
                    })

        entries.sort(key=lambda item: item["id"])

        return {
            "team_id": team_id,
            "team_name": team_name,
            "is_home": is_home,
            "total_entries": len(entries),
            "entries": entries,
            "density": density,
        }

    m03_home = build_box_entries(
        home_id,
        metadata["home_team"]["name"],
        True,
        passes_by_team[home_id],
        carries_by_team[home_id],
        home_density,
    )
    m04_away = build_box_entries(
        away_id,
        metadata["away_team"]["name"],
        False,
        passes_by_team[away_id],
        carries_by_team[away_id],
        away_density,
    )

    # 8. Module 06: Entry Origin Lane (Left / Centre / Right)
    home_entries = m03_home["entries"]
    away_entries = m04_away["entries"]

    home_lane_left = sum(1 for e in home_entries if e["y_start"] < 33.33)
    home_lane_centre = sum(1 for e in home_entries if 33.33 <= e["y_start"] <= 66.67)
    home_lane_right = sum(1 for e in home_entries if e["y_start"] > 66.67)

    away_lane_left = sum(1 for e in away_entries if e["y_start"] < 33.33)
    away_lane_centre = sum(1 for e in away_entries if 33.33 <= e["y_start"] <= 66.67)
    away_lane_right = sum(1 for e in away_entries if e["y_start"] > 66.67)

    m06_lanes = [
        {"key": "left", "label": "Left", "home_val": home_lane_left, "away_val": away_lane_left},
        {"key": "centre", "label": "Centre", "home_val": home_lane_centre, "away_val": away_lane_centre},
        {"key": "right", "label": "Right", "home_val": home_lane_right, "away_val": away_lane_right},
    ]
    m06_max = max(
        home_lane_left,
        away_lane_left,
        home_lane_centre,
        away_lane_centre,
        home_lane_right,
        away_lane_right,
        1,
    )
    module_06_entry_origin_lane = {
        "lanes": m06_lanes,
        "max_val": m06_max,
    }

    # 9. Module 05: Nested Possession Stages (Monotonic Funnel)
    def calc_raw_stages(
        tmm: Dict[str, Any],
        passes: List[Dict[str, Any]],
        carries: List[Dict[str, Any]],
        box_entries_count: int,
        is_home_val: int,
    ) -> tuple[int, int, int, int, int]:
        # 1. Possessions
        p_tot = int(tmm.get("passes_total") or len(passes) or 0)
        def_act = int(tmm.get("defensive_actions") or 0)
        sh_for = int(tmm.get("shots_for") or 0)
        raw_pos = round(p_tot / 4.2 + def_act + sh_for)

        # 2. Reached third
        p_into_third = sum(
            1 for p in passes
            if p.get("is_successful") == 1
            and p.get("x_start") is not None
            and p.get("x_end") is not None
            and p["x_start"] < 66.7
            and p["x_end"] >= 66.7
        )
        c_into_third = sum(
            1 for c in carries
            if c.get("x_start") is not None
            and c.get("x_end") is not None
            and c["x_start"] < 66.7
            and c["x_end"] >= 66.7
        )
        raw_third = p_into_third + c_into_third
        if raw_third == 0 and tmm.get("final_third_passes_for"):
            raw_third = int(tmm.get("final_third_passes_for") or 0)

        # 3. Then box
        raw_box = box_entries_count

        # 4 & 5. Shots inside box & on target
        raw_shots = 0
        raw_on_target = 0
        try:
            shot_rows_match = cursor.execute(
                """
                SELECT coord_x, coord_y, distance_m, shot_type
                FROM player_shots
                WHERE match_id = ? AND is_home = ?
                """,
                (match_id, is_home_val),
            ).fetchall()
            if shot_rows_match:
                for sr in shot_rows_match:
                    cx = sr["coord_x"]
                    cy = sr["coord_y"]
                    dist = sr["distance_m"]
                    is_in_box = False
                    if dist is not None and float(dist) <= 16.5:
                        is_in_box = True
                    elif cx is not None and cy is not None and float(cx) <= 16.5 and 21.1 <= float(cy) <= 78.9:
                        is_in_box = True
                    if is_in_box:
                        raw_shots += 1
                        if str(sr["shot_type"]).lower() in ("goal", "save", "saved"):
                            raw_on_target += 1
            else:
                raw_shots = int(tmm.get("shots_inside_box_for") or 0)
                raw_on_target = int(tmm.get("shots_on_target_for") or 0)
        except Exception:
            raw_shots = int(tmm.get("shots_inside_box_for") or 0)
            raw_on_target = int(tmm.get("shots_on_target_for") or 0)

        # Monotonic clamping: possessions >= reached_third >= then_box >= then_shot >= on_target
        clamped_shot = min(raw_shots, raw_box)
        clamped_on_target = min(raw_on_target, clamped_shot)
        clamped_third = max(raw_third, raw_box)
        clamped_pos = max(raw_pos, clamped_third)

        return clamped_pos, clamped_third, raw_box, clamped_shot, clamped_on_target

    home_pos, home_third, home_box, home_shot, home_ontarget = calc_raw_stages(
        tmm_home,
        passes_by_team[home_id],
        carries_by_team[home_id],
        m03_home["total_entries"],
        1,
    )
    away_pos, away_third, away_box, away_shot, away_ontarget = calc_raw_stages(
        tmm_away,
        passes_by_team[away_id],
        carries_by_team[away_id],
        m04_away["total_entries"],
        0,
    )

    m05_stages = [
        {"key": "possessions", "label": "Possessions", "home_val": home_pos, "away_val": away_pos},
        {"key": "reached_third", "label": "Reached third", "home_val": home_third, "away_val": away_third},
        {"key": "then_box", "label": "Then box", "home_val": home_box, "away_val": away_box},
        {"key": "then_shot", "label": "Then shot", "home_val": home_shot, "away_val": away_shot},
        {"key": "on_target", "label": "On target", "home_val": home_ontarget, "away_val": away_ontarget},
    ]
    m05_max = max(
        home_pos,
        away_pos,
        home_third,
        away_third,
        home_box,
        away_box,
        home_shot,
        away_shot,
        home_ontarget,
        away_ontarget,
        1,
    )
    module_05_nested_possession_stages = {
        "stages": m05_stages,
        "max_val": m05_max,
    }

    return {
        "match_id": match_id,
        "metadata": metadata,
        "kpis": kpis,
        "module_01_home_passing_shape": m01_home,
        "module_02_away_passing_shape": m02_away,
        "module_03_home_box_entries": m03_home,
        "module_04_away_box_entries": m04_away,
        "module_05_nested_possession_stages": module_05_nested_possession_stages,
        "module_06_entry_origin_lane": module_06_entry_origin_lane,
    }


@router.get("/{match_id}/sheet-02", response_model=MatchSheet02Response)
@router.get("/{match_id}/sheet-02-buildup", response_model=MatchSheet02Response)
def get_match_sheet_02_endpoint(
    match_id: int,
    db: sqlite3.Connection = Depends(get_db),
):
    """
    Get complete tactical data for Match Report Sheet 02 / 04 ('Build-up and penalty-area access').
    """
    return _build_sheet_02_buildup(db, match_id=match_id)


@router.get("/{match_id}/sheet-03", response_model=MatchSheet03DataHubResponse)
@router.get("/{match_id}/sheet-03-datahub", response_model=MatchSheet03DataHubResponse)
def get_match_sheet_03_endpoint(
    match_id: int,
    db: sqlite3.Connection = Depends(get_db),
):
    """
    Get consolidated statistical data for Match Report Sheet 03 (Data Hub).
    """
    return build_match_sheet_03_datahub(db, match_id=match_id)

