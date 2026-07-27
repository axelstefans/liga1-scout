import sqlite3
from datetime import datetime

def run_cleanup():
    conn = sqlite3.connect("liga1.db")
    cursor = conn.cursor()
    
    master_teams = {
        2305: "Universitario de Deportes",
        2311: "Alianza Lima",
        2302: "Club Sporting Cristal",
        2308: "FBC Melgar",
        282538: "Club Atlético Grau",
        63760: "Cusco FC",
        2301: "Cienciano",
        335557: "Asociación Deportiva Tarma",
        458584: "Deportivo Garcilaso",
        252254: "Los Chankas CYC",
        33895: "Sport Huancayo",
        2312: "Sport Boys",
        2307: "Alianza Atlético de Sullana",
        213609: "Comerciantes Unidos",
        87854: "UTC de Cajamarca",
        511206: "CD Juan Pablo II",
        492848: "CD Moquegua",
        1082002: "FC Cajamarca"
    }

    # Delete any poorly inserted rows from the previous manual update
    bad_names = ["CD Juan Pablo II", "Moquegua", "Cajamarca"]
    cursor.execute("DELETE FROM teams WHERE name IN (?, ?, ?) AND team_id NOT IN (511206, 492848, 1082002)", bad_names)
    
    # Step 1: Soft-delete everyone
    cursor.execute("UPDATE teams SET is_active = 0")
    
    # Step 2: Activate the Elite 18, inserting them if they don't exist
    for tid, tname in master_teams.items():
        cursor.execute("SELECT team_id FROM teams WHERE team_id = ?", (tid,))
        if cursor.fetchone():
            cursor.execute("UPDATE teams SET is_active = 1, name = ? WHERE team_id = ?", (tname, tid))
        else:
            now = datetime.now().isoformat()
            cursor.execute("INSERT INTO teams (team_id, name, is_active, scraped_at) VALUES (?, ?, 1, ?)", (tid, tname, now))
            
    # Verify count
    cursor.execute("SELECT COUNT(*) FROM teams WHERE is_active = 1")
    count = cursor.fetchone()[0]
    
    conn.commit()
    conn.close()
    
    print(f"Cleanup complete. Exactly {count} teams are now active.")

if __name__ == "__main__":
    run_cleanup()
