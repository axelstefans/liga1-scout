import sqlite3
import pytest
from api.repositories.referee_repo import (
    get_referees_summary,
    get_referee_detail,
    BAYESIAN_PRIOR_WEIGHT,
    BAYESIAN_PRIOR_HOME_CARDS,
    MIN_MATCHES_BIAS_RANKING,
)


def create_test_db():
    conn = sqlite3.connect(":memory:")
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE teams (
            team_id INTEGER PRIMARY KEY,
            name TEXT,
            short_name TEXT,
            logo_url TEXT
        )
    """)
    cursor.execute("""
        CREATE TABLE referees (
            referee_id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            slug TEXT,
            country TEXT DEFAULT 'Peru',
            total_games_sofa INTEGER,
            total_yellows_sofa INTEGER,
            total_reds_sofa INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cursor.execute("""
        CREATE TABLE matches (
            match_id INTEGER PRIMARY KEY,
            home_team_id INTEGER,
            away_team_id INTEGER,
            match_date TEXT NOT NULL,
            round INTEGER,
            home_score INTEGER,
            away_score INTEGER,
            status TEXT NOT NULL,
            match_url TEXT,
            season_id INTEGER NOT NULL,
            scraped_at TEXT NOT NULL,
            referee_id INTEGER
        )
    """)
    cursor.execute("""
        CREATE TABLE match_period_stats (
            match_id INTEGER,
            team_id INTEGER,
            period TEXT,
            possession REAL,
            corner_kicks INTEGER,
            fouls INTEGER,
            yellow_cards INTEGER,
            red_cards INTEGER,
            goals INTEGER,
            PRIMARY KEY (match_id, team_id, period)
        )
    """)
    cursor.execute("""
        CREATE TABLE player_shots (
            shot_id INTEGER PRIMARY KEY,
            match_id INTEGER,
            player_id INTEGER,
            team_id INTEGER,
            situation TEXT
        )
    """)
    cursor.execute("""
        CREATE TABLE team_match_metrics (
            match_id INTEGER PRIMARY KEY,
            tournament TEXT
        )
    """)
    conn.commit()
    return conn


def test_referee_bayesian_smoothing_constants():
    """Verify that Bayesian constants are defined and match Liga 1 prior (~46.8%)."""
    assert BAYESIAN_PRIOR_WEIGHT == 4.0
    assert BAYESIAN_PRIOR_HOME_CARDS == 1.87
    assert MIN_MATCHES_BIAS_RANKING == 3
    prior_ratio = BAYESIAN_PRIOR_HOME_CARDS / BAYESIAN_PRIOR_WEIGHT
    assert round(prior_ratio * 100.0, 1) == 46.8


def test_referee_zero_cards_behavior():
    """When a referee has matches but 0 cards, smoothed home bias should be 46.8%."""
    conn = create_test_db()
    c = conn.cursor()
    # 1 referee with 1 match and 0 cards
    c.execute("INSERT INTO referees (referee_id, name) VALUES (1, 'Ref Zero')")
    c.execute("INSERT INTO matches (match_id, home_team_id, away_team_id, match_date, status, season_id, scraped_at, referee_id) VALUES (101, 10, 20, '2026-10-01', 'played', 88529, 'now', 1)")
    # match_period_stats with 0 cards
    c.execute("INSERT INTO match_period_stats VALUES (101, 10, 'ALL', 50.0, 5, 10, 0, 0, 0)")
    c.execute("INSERT INTO match_period_stats VALUES (101, 20, 'ALL', 50.0, 5, 10, 0, 0, 0)")
    conn.commit()

    summaries = get_referees_summary(conn, season_id=88529)
    assert len(summaries) == 1
    ref = summaries[0]
    assert ref.matches_count == 1
    assert ref.yellow_cards_total == 0
    assert ref.red_cards_total == 0
    assert ref.cards_avg == 0.0
    # Expected: (0 + 1.87) / (0 + 4) * 100 = 46.75 -> 46.8%
    assert ref.home_cards_pct == 46.8
    assert ref.is_sample_sufficient is False
    assert ref.sample_label == "Muestra en construcción"
    conn.close()


def test_referee_one_match_small_sample():
    """When a referee has 1 match with 2 home cards and 0 away cards, smoothing prevents 100%."""
    conn = create_test_db()
    c = conn.cursor()
    c.execute("INSERT INTO referees (referee_id, name) VALUES (2, 'Ref One')")
    c.execute("INSERT INTO matches (match_id, home_team_id, away_team_id, match_date, status, season_id, scraped_at, referee_id) VALUES (102, 10, 20, '2026-10-02', 'played', 88529, 'now', 2)")
    # Home team gets 2 cards, away gets 0 cards
    c.execute("INSERT INTO match_period_stats VALUES (102, 10, 'ALL', 50.0, 5, 10, 2, 0, 0)")
    c.execute("INSERT INTO match_period_stats VALUES (102, 20, 'ALL', 50.0, 5, 10, 0, 0, 0)")
    conn.commit()

    summaries = get_referees_summary(conn, season_id=88529)
    ref = summaries[0]
    assert ref.matches_count == 1
    # Without Bayes: 2 / 2 = 100%. With Bayes: (2 + 1.87) / (2 + 4) * 100 = 3.87 / 6 * 100 = 64.5%
    assert ref.home_cards_pct == 64.5
    assert ref.is_sample_sufficient is False
    assert ref.sample_label == "Muestra en construcción"
    conn.close()


def test_referee_exactly_three_matches_boundary():
    """Threshold boundary: exactly 3 matches qualifies as sample sufficient."""
    conn = create_test_db()
    c = conn.cursor()
    c.execute("INSERT INTO referees (referee_id, name) VALUES (3, 'Ref Three')")
    for mid in (103, 104, 105):
        c.execute("INSERT INTO matches (match_id, home_team_id, away_team_id, match_date, status, season_id, scraped_at, referee_id) VALUES (?, 10, 20, '2026-10-03', 'played', 88529, 'now', 3)", (mid,))
        # 2 cards per match: 1 home, 1 away (total 6 cards: 3 home, 3 away)
        c.execute("INSERT INTO match_period_stats VALUES (?, 10, 'ALL', 50.0, 5, 10, 1, 0, 0)", (mid,))
        c.execute("INSERT INTO match_period_stats VALUES (?, 20, 'ALL', 50.0, 5, 10, 1, 0, 0)", (mid,))
    conn.commit()

    summaries = get_referees_summary(conn, season_id=88529)
    ref = summaries[0]
    assert ref.matches_count == 3
    # Total cards = 6, home = 3. Formula: (3 + 1.87) / (6 + 4) * 100 = 4.87 / 10 * 100 = 48.7%
    assert ref.home_cards_pct == 48.7
    assert ref.is_sample_sufficient is True
    assert ref.sample_label == "Suficiente"
    conn.close()


def test_referee_extreme_values():
    """Large sample with extreme cards (100 home cards, 0 away cards)."""
    conn = create_test_db()
    c = conn.cursor()
    c.execute("INSERT INTO referees (referee_id, name) VALUES (4, 'Ref Extreme')")
    c.execute("INSERT INTO matches (match_id, home_team_id, away_team_id, match_date, status, season_id, scraped_at, referee_id) VALUES (106, 10, 20, '2026-10-04', 'played', 88529, 'now', 4)")
    # 100 home cards, 0 away cards
    c.execute("INSERT INTO match_period_stats VALUES (106, 10, 'ALL', 50.0, 5, 10, 100, 0, 0)")
    c.execute("INSERT INTO match_period_stats VALUES (106, 20, 'ALL', 50.0, 5, 10, 0, 0, 0)")
    conn.commit()

    summaries = get_referees_summary(conn, season_id=88529)
    ref = summaries[0]
    # Formula: (100 + 1.87) / (100 + 4) * 100 = 101.87 / 104 * 100 = 97.95 -> 98.0%
    assert ref.home_cards_pct == 98.0
    conn.close()


def test_referee_detail_zero_matches_profile():
    """Referees with 0 matches in get_referee_detail should report default prior."""
    conn = create_test_db()
    c = conn.cursor()
    c.execute("INSERT INTO referees (referee_id, name) VALUES (99, 'Ref Newbie')")
    conn.commit()

    detail = get_referee_detail(conn, referee_id=99)
    assert detail is not None
    assert detail.referee.matches_count == 0
    assert detail.referee.home_cards_pct == 46.8
    assert detail.referee.is_sample_sufficient is False
    assert detail.referee.sample_label == "Muestra en construcción"
    conn.close()
