import sqlite3
from typing import List, Optional, Dict, Any
from ..schemas.referee import RefereeSummary, RefereeMatchItem, RefereeDetailResponse, TeamRef, YellowCardsSplit


def get_referees_summary(
    db: sqlite3.Connection,
    season_id: Optional[int] = 88529,
    tournament: Optional[str] = None
) -> List[RefereeSummary]:
    """
    Aggregates cards, fouls, and penalties for each referee across played/finished matches.
    Computes cards_avg, cards_1t_avg, cards_2t_avg, over_1_5_cards_1t_pct,
    over_4_5_cards_pct, penalties_avg, fouls_avg, and home_cards_pct.
    """
    # 1. Build filter conditions
    conditions = ["m.referee_id IS NOT NULL", "m.status IN ('played', 'finished', 'FT')"]
    params: List[Any] = []

    if season_id is not None:
        conditions.append("m.season_id = ?")
        params.append(season_id)

    if tournament:
        conditions.append("""
            (COALESCE(tmm.tournament, CASE WHEN m.match_date < '2026-06-01' THEN 'Apertura' ELSE 'Clausura' END) = ?)
        """)
        params.append(tournament)

    where_clause = " AND ".join(conditions)

    # We extract metrics per match first to calculate over_4_5_cards and over_1_5_cards_1t accurately
    query = f"""
    WITH filtered_matches AS (
        SELECT DISTINCT
            m.match_id,
            m.referee_id,
            m.home_team_id,
            m.away_team_id
        FROM matches m
        LEFT JOIN team_match_metrics tmm ON m.match_id = tmm.match_id
        WHERE {where_clause}
    ),
    match_discipline AS (
        SELECT 
            fm.match_id,
            fm.referee_id,
            fm.home_team_id,
            COALESCE(SUM(mps_all.yellow_cards), 0) AS match_yellows,
            COALESCE(SUM(mps_all.red_cards), 0) AS match_reds,
            COALESCE(SUM(mps_all.fouls), 0) AS match_fouls,
            COALESCE(SUM(CASE WHEN mps_all.team_id = fm.home_team_id THEN (mps_all.yellow_cards + mps_all.red_cards) ELSE 0 END), 0) AS home_cards,
            COALESCE(SUM(mps_all.yellow_cards + mps_all.red_cards), 0) AS total_cards,
            COALESCE(SUM(mps_1t.yellow_cards + mps_1t.red_cards), 0) AS total_cards_1t,
            COALESCE(SUM(mps_2t.yellow_cards + mps_2t.red_cards), 0) AS total_cards_2t
        FROM filtered_matches fm
        LEFT JOIN match_period_stats mps_all ON fm.match_id = mps_all.match_id AND mps_all.period = 'ALL'
        LEFT JOIN match_period_stats mps_1t ON fm.match_id = mps_1t.match_id AND mps_1t.period = '1ST' AND mps_1t.team_id = mps_all.team_id
        LEFT JOIN match_period_stats mps_2t ON fm.match_id = mps_2t.match_id AND mps_2t.period = '2ND' AND mps_2t.team_id = mps_all.team_id
        GROUP BY fm.match_id, fm.referee_id, fm.home_team_id
    ),
    match_penalties AS (
        SELECT 
            fm.match_id,
            COUNT(ps.shot_id) AS match_pens
        FROM filtered_matches fm
        JOIN player_shots ps ON fm.match_id = ps.match_id AND ps.situation = 'penalty'
        GROUP BY fm.match_id
    )
    SELECT 
        r.referee_id,
        r.name,
        r.slug,
        COALESCE(r.country, 'Peru') AS country,
        COUNT(md.match_id) AS matches_count,
        COALESCE(SUM(md.match_yellows), 0) AS yellow_cards_total,
        COALESCE(SUM(md.match_reds), 0) AS red_cards_total,
        COALESCE(SUM(md.total_cards), 0) AS total_cards_sum,
        COALESCE(SUM(md.total_cards_1t), 0) AS total_cards_1t_sum,
        COALESCE(SUM(md.total_cards_2t), 0) AS total_cards_2t_sum,
        COALESCE(SUM(mp.match_pens), 0) AS penalties_total,
        COALESCE(SUM(md.match_fouls), 0) AS fouls_total,
        COALESCE(SUM(CASE WHEN md.total_cards > 4.5 THEN 1 ELSE 0 END), 0) AS over_4_5_count,
        COALESCE(SUM(CASE WHEN md.total_cards_1t > 1.5 THEN 1 ELSE 0 END), 0) AS over_1_5_1t_count,
        COALESCE(SUM(md.home_cards), 0) AS home_cards_sum
    FROM referees r
    JOIN match_discipline md ON r.referee_id = md.referee_id
    LEFT JOIN match_penalties mp ON md.match_id = mp.match_id
    GROUP BY r.referee_id, r.name, r.slug, r.country
    HAVING matches_count > 0
    ORDER BY matches_count DESC, (CAST(total_cards_sum AS FLOAT) / matches_count) DESC;
    """

    cursor = db.cursor()
    rows = cursor.execute(query, params).fetchall()

    results: List[RefereeSummary] = []
    for row in rows:
        (
            ref_id, name, slug, country,
            m_count, y_total, r_total, total_cards,
            cards_1t_sum, cards_2t_sum,
            pens_total, fouls_total,
            over_4_5_count, over_1_5_1t_count, home_cards_sum
        ) = row

        y_avg = round(y_total / m_count, 2) if m_count > 0 else 0.0
        r_avg = round(r_total / m_count, 2) if m_count > 0 else 0.0
        cards_avg = round(total_cards / m_count, 2) if m_count > 0 else 0.0
        cards_1t_avg = round(cards_1t_sum / m_count, 1) if m_count > 0 else 0.0
        cards_2t_avg = round(cards_2t_sum / m_count, 1) if m_count > 0 else 0.0
        over_1_5_1t_pct = round((over_1_5_1t_count / m_count) * 100.0, 1) if m_count > 0 else 0.0
        pens_avg = round(pens_total / m_count, 2) if m_count > 0 else 0.0
        fouls_avg = round(fouls_total / m_count, 1) if m_count > 0 else 0.0
        over_4_5_pct = round((over_4_5_count / m_count) * 100.0, 1) if m_count > 0 else 0.0
        home_cards_pct = round((home_cards_sum / total_cards) * 100.0, 1) if total_cards > 0 else 50.0

        results.append(
            RefereeSummary(
                referee_id=ref_id,
                name=name,
                slug=slug,
                country=country,
                category="FIFA / CONAR",
                matches_count=m_count,
                yellow_cards_total=y_total,
                yellow_cards_avg=y_avg,
                red_cards_total=r_total,
                red_cards_avg=r_avg,
                cards_avg=cards_avg,
                cards_1t_avg=cards_1t_avg,
                cards_2t_avg=cards_2t_avg,
                over_1_5_cards_1t_pct=over_1_5_1t_pct,
                over_1_5_cards_1t_count=over_1_5_1t_count,
                penalties_total=pens_total,
                penalties_avg=pens_avg,
                fouls_avg=fouls_avg,
                over_4_5_cards_pct=over_4_5_pct,
                home_cards_pct=home_cards_pct
            )
        )

    return results


def get_referee_matches(
    db: sqlite3.Connection,
    referee_id: int,
    limit: Optional[int] = None
) -> List[RefereeMatchItem]:
    """
    Retrieves match history for a specific referee ordered by date DESC.
    Includes 1T / 2T yellow cards breakdown, red cards, fouls, and penalties.
    """
    limit_clause = f"LIMIT {int(limit)}" if limit is not None and limit > 0 else ""

    query = f"""
    SELECT 
        m.match_id,
        m.match_date,
        m.round,
        COALESCE(tmm.tournament, CASE WHEN m.match_date < '2026-06-01' THEN 'Apertura' ELSE 'Clausura' END) AS tournament,
        m.home_score,
        m.away_score,
        ht.team_id AS home_id,
        ht.name AS home_name,
        ht.short_name AS home_short_name,
        ht.logo_url AS home_logo,
        at.team_id AS away_id,
        at.name AS away_name,
        at.short_name AS away_short_name,
        at.logo_url AS away_logo,
        COALESCE(mps_all.yellows, 0) AS yellows_all,
        COALESCE(mps_1t.yellows, 0) AS yellows_1t,
        COALESCE(mps_2t.yellows, 0) AS yellows_2t,
        COALESCE(mps_all.reds, 0) AS reds_all,
        COALESCE(mps_all.fouls, 0) AS fouls_all,
        COALESCE(pens.penalties, 0) AS penalties
    FROM matches m
    JOIN teams ht ON m.home_team_id = ht.team_id
    JOIN teams at ON m.away_team_id = at.team_id
    LEFT JOIN (
        SELECT match_id, tournament FROM team_match_metrics GROUP BY match_id
    ) tmm ON m.match_id = tmm.match_id
    LEFT JOIN (
        SELECT match_id, SUM(yellow_cards) AS yellows, SUM(red_cards) AS reds, SUM(fouls) AS fouls
        FROM match_period_stats WHERE period = 'ALL' GROUP BY match_id
    ) mps_all ON m.match_id = mps_all.match_id
    LEFT JOIN (
        SELECT match_id, SUM(yellow_cards) AS yellows
        FROM match_period_stats WHERE period = '1ST' GROUP BY match_id
    ) mps_1t ON m.match_id = mps_1t.match_id
    LEFT JOIN (
        SELECT match_id, SUM(yellow_cards) AS yellows
        FROM match_period_stats WHERE period = '2ND' GROUP BY match_id
    ) mps_2t ON m.match_id = mps_2t.match_id
    LEFT JOIN (
        SELECT match_id, COUNT(*) AS penalties
        FROM player_shots WHERE situation = 'penalty' GROUP BY match_id
    ) pens ON m.match_id = pens.match_id
    WHERE m.referee_id = ? AND m.status IN ('played', 'finished', 'FT')
    ORDER BY m.match_date DESC
    {limit_clause};
    """

    cursor = db.cursor()
    rows = cursor.execute(query, (referee_id,)).fetchall()

    match_items: List[RefereeMatchItem] = []
    for row in rows:
        (
            m_id, m_date, m_round, tourn, h_score, a_score,
            h_id, h_name, h_short, h_logo,
            a_id, a_name, a_short, a_logo,
            y_all, y_1t, y_2t, r_all, fouls_all, pens_count
        ) = row

        total_cards = y_all + r_all
        match_items.append(
            RefereeMatchItem(
                match_id=m_id,
                date=m_date,
                tournament=tourn,
                round=m_round,
                home_team=TeamRef(id=h_id, name=h_name, short_name=h_short, logo_url=h_logo),
                away_team=TeamRef(id=a_id, name=a_name, short_name=a_short, logo_url=a_logo),
                home_score=h_score if h_score is not None else 0,
                away_score=a_score if a_score is not None else 0,
                yellow_cards=y_all,
                yellow_cards_split=YellowCardsSplit(
                    total=y_all,
                    first_half=y_1t,
                    second_half=y_2t
                ),
                red_cards=r_all,
                fouls=fouls_all,
                penalties=pens_count,
                over_4_5_cards=(total_cards > 4.5)
            )
        )

    return match_items


def get_referee_detail(
    db: sqlite3.Connection,
    referee_id: int,
    limit: Optional[int] = 5
) -> Optional[RefereeDetailResponse]:
    """
    Returns full profile and recent match history for a referee.
    """
    # 1. Fetch summary for this specific referee
    all_summaries = get_referees_summary(db, season_id=None)
    ref_summary = next((s for s in all_summaries if s.referee_id == referee_id), None)

    if not ref_summary:
        # Check if referee exists in referees table even with 0 matches
        row = db.execute("SELECT referee_id, name, slug, country FROM referees WHERE referee_id = ?", (referee_id,)).fetchone()
        if not row:
            return None
        ref_summary = RefereeSummary(
            referee_id=row[0],
            name=row[1],
            slug=row[2],
            country=row[3] or "Peru",
            category="FIFA / CONAR",
            matches_count=0,
            yellow_cards_total=0,
            yellow_cards_avg=0.0,
            red_cards_total=0,
            red_cards_avg=0.0,
            cards_avg=0.0,
            cards_1t_avg=0.0,
            cards_2t_avg=0.0,
            over_1_5_cards_1t_pct=0.0,
            over_1_5_cards_1t_count=0,
            penalties_total=0,
            penalties_avg=0.0,
            fouls_avg=0.0,
            over_4_5_cards_pct=0.0,
            home_cards_pct=50.0
        )

    # 2. Total matches count in DB
    total_matches_row = db.execute(
        "SELECT COUNT(*) FROM matches WHERE referee_id = ? AND status IN ('played', 'finished', 'FT')",
        (referee_id,)
    ).fetchone()
    total_matches = total_matches_row[0] if total_matches_row else 0

    # 3. Matches history
    matches = get_referee_matches(db, referee_id=referee_id, limit=limit)

    return RefereeDetailResponse(
        referee=ref_summary,
        recent_matches=matches,
        total_matches=total_matches
    )
