import sqlite3
conn = sqlite3.connect('liga1.db')
conn.execute("DELETE FROM player_season_stats")
conn.execute("DELETE FROM scrape_log WHERE resource_type='season_stats'")
conn.commit()
print('Cleared season stats')
conn.close()