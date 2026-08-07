import sqlite3

def run_diag():
    conn = sqlite3.connect('liga1.db')
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    print("=== 1. Match Count by Season ===")
    rows = c.execute("SELECT season_id, COUNT(*) as count FROM matches GROUP BY season_id").fetchall()
    for r in rows:
        print(f"Season {r['season_id']}: {r['count']} matches")

    print("\n=== 2. Very First Match of Season ===")
    first = c.execute("SELECT match_id, round, match_date FROM matches ORDER BY match_date ASC LIMIT 1").fetchone()
    if first:
        print(dict(first))

    print("\n=== 3. Last Scraped Match with Stats ===")
    # Using player_match_stats to check scraped stats because team_match_stats does not exist
    last = c.execute('''
        SELECT m.match_id, m.round, m.match_date 
        FROM matches m 
        JOIN player_match_stats pms ON m.match_id = pms.match_id 
        ORDER BY m.match_date DESC LIMIT 1
    ''').fetchone()
    if last:
        print(dict(last))
        
    print("\n=== 4. Details for Match 15362081 ===")
    specific = c.execute('''
        SELECT m.round, m.match_date, th.name as home_team, ta.name as away_team 
        FROM matches m 
        JOIN teams th ON m.home_team_id = th.team_id 
        JOIN teams ta ON m.away_team_id = ta.team_id 
        WHERE m.match_id = 15362081
    ''').fetchone()
    if specific:
        print(dict(specific))
    else:
        print("Match 15362081 not found in matches table.")

if __name__ == "__main__":
    run_diag()
