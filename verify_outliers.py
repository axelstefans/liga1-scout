import sqlite3
import pandas as pd
from api.services.poisson_service import _get_all_matches_xg, get_league_baselines, get_historical_team_metrics, calculate_match_odds
import numpy as np

def main():
    conn = sqlite3.connect('liga1.db')
    
    # 1. Investigate CD Juan Pablo II vs FC Cajamarca
    home_team = 'CD Juan Pablo II'
    away_team = 'FC Cajamarca'
    
    h_row = conn.execute("SELECT team_id FROM teams WHERE name LIKE ?", ('%' + home_team + '%',)).fetchone()
    a_row = conn.execute("SELECT team_id FROM teams WHERE name LIKE ?", ('%' + away_team + '%',)).fetchone()
    home_id = h_row[0]
    away_id = a_row[0]
    
    matches_df = _get_all_matches_xg(conn)
    league_avg_home_xg, league_avg_away_xg = get_league_baselines(matches_df)
    league_avg_overall = (league_avg_home_xg + league_avg_away_xg) / 2
    
    def get_hist_debug(matches_df, team_id: int):
        home_games = matches_df[matches_df['home_team_id'] == team_id]
        away_games = matches_df[matches_df['away_team_id'] == team_id]
        total = len(home_games) + len(away_games)
        return {
            'total_matches': total,
            'home_count': len(home_games),
            'away_count': len(away_games),
            'home_xGF': home_games['home_xg'].mean() if len(home_games) > 0 else 0,
            'away_xGA': away_games['home_xg'].mean() if len(away_games) > 0 else 0,
            'overall_xGF': (home_games['home_xg'].sum() + away_games['away_xg'].sum()) / total if total > 0 else 0,
            'overall_xGA': (home_games['away_xg'].sum() + away_games['home_xg'].sum()) / total if total > 0 else 0
        }
    
    h_debug = get_hist_debug(matches_df, home_id)
    a_debug = get_hist_debug(matches_df, away_id)
    
    print("--- CD Juan Pablo II (Home) ---")
    print(h_debug)
    print("--- FC Cajamarca (Away) ---")
    print(a_debug)
    
    atk_home = h_debug['overall_xGF'] / league_avg_overall
    def_away = a_debug['overall_xGA'] / league_avg_overall
    
    atk_away = a_debug['overall_xGF'] / league_avg_overall
    def_home = h_debug['overall_xGA'] / league_avg_overall
    
    print(f"\natk_home: {atk_home:.3f}, def_away: {def_away:.3f}, league_avg_home: {league_avg_home_xg:.3f}")
    print(f"atk_away: {atk_away:.3f}, def_home: {def_home:.3f}, league_avg_away: {league_avg_away_xg:.3f}")
    print(f"Projected home lambda: {atk_home * def_away * league_avg_home_xg:.3f}")
    print(f"Projected away lambda: {atk_away * def_home * league_avg_away_xg:.3f}")
    
    # 3. Check all 2026 matches
    query = """
        SELECT th.name as home, ta.name as away
        FROM matches m
        JOIN teams th ON m.home_team_id = th.team_id
        JOIN teams ta ON m.away_team_id = ta.team_id
        WHERE m.season_id = 88529
    """
    all_2026 = pd.read_sql_query(query, conn)
    
    results = []
    for _, row in all_2026.iterrows():
        h = row['home']
        a = row['away']
        try:
            odds = calculate_match_odds(conn, h, a)
            h_lambda = odds['projected_goals']['home']
            a_lambda = odds['projected_goals']['away']
            results.append(h_lambda + a_lambda)
        except Exception as e:
            pass
            
    res = np.array(results)
    print("\n--- All 2026 Matches Distribution (Lambda Home + Lambda Away) ---")
    print(f"Total processed: {len(res)}")
    print(f"Mean: {np.mean(res):.3f}")
    print(f"Median: {np.median(res):.3f}")
    print(f"Min: {np.min(res):.3f}")
    print(f"Max: {np.max(res):.3f}")
    
    above_4 = np.sum(res > 4.0)
    print(f"Matches projected above 4.0 total goals: {above_4}")

    conn.close()

if __name__ == '__main__':
    main()
