import sqlite3
from datetime import datetime

def update_db():
    conn = sqlite3.connect("liga1.db")
    cursor = conn.cursor()
    
    # 1. Add is_active column
    try:
        cursor.execute("ALTER TABLE teams ADD COLUMN is_active INTEGER DEFAULT 1")
        print("Added is_active column.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("is_active column already exists.")
        else:
            raise e
            
    # 2. Update relegated teams
    relegated = ["Universidad César Vallejo", "Carlos A. Mannucci", "Unión Comercio"]
    cursor.execute(f"UPDATE teams SET is_active = 0 WHERE name IN ({','.join(['?']*len(relegated))})", relegated)
    print(f"Relegated {cursor.rowcount} teams.")
    
    # 3. Insert promoted teams
    promoted = ["CD Juan Pablo II", "Moquegua", "Cajamarca"]
    for team in promoted:
        cursor.execute("SELECT team_id FROM teams WHERE name = ?", (team,))
        if not cursor.fetchone():
            cursor.execute("INSERT INTO teams (name, is_active, scraped_at) VALUES (?, 1, ?)", (team, datetime.now().isoformat()))
            print(f"Inserted promoted team: {team}")
            
    conn.commit()
    conn.close()
    print("Database update complete.")

if __name__ == "__main__":
    update_db()
