import sqlite3

def main():
    conn = sqlite3.connect('liga1.db')
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    # Select played matches that have NO entries in player_shots
    query = """
        SELECT m.match_id, m.season_id, m.match_date, 
               th.name as home_team, ta.name as away_team, 
               m.home_score, m.away_score
        FROM matches m
        JOIN teams th ON m.home_team_id = th.team_id
        JOIN teams ta ON m.away_team_id = ta.team_id
        WHERE m.status = 'played'
        AND m.match_id NOT IN (SELECT DISTINCT match_id FROM player_shots)
        ORDER BY m.match_date DESC
    """
    
    missing_matches = c.execute(query).fetchall()
    
    print(f"Total missing matches (played but no shots/xG data): {len(missing_matches)}")
    
    wo_count = sum(1 for m in missing_matches if (m['home_score'] == 3 and m['away_score'] == 0) or (m['home_score'] == 0 and m['away_score'] == 3))
    
    print(f"Total Walkovers (3-0 or 0-3) among missing: {wo_count}")
    print("\n--- Top 10 Missing Matches ---")
    for i, m in enumerate(missing_matches[:10]):
        print(f"{i+1}. {m['match_date'][:10]} | {m['home_team']} {m['home_score']} - {m['away_score']} {m['away_team']} (ID: {m['match_id']})")
        
    conn.close()

if __name__ == '__main__':
    main()
