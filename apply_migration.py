import sqlite3
import sys

def apply_migration(db_path, sql_file_path):
    try:
        # Conectarse a la base de datos
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Leer el archivo SQL
        with open(sql_file_path, 'r', encoding='utf-8') as f:
            sql_script = f.read()
            
        # Ejecutar el script SQL
        cursor.executescript(sql_script)
        conn.commit()
        
        print(f"✅ Migración aplicada exitosamente: {sql_file_path}")
        
    except sqlite3.Error as e:
        print(f"❌ Error de SQLite: {e}")
    except FileNotFoundError:
        print(f"❌ No se encontró el archivo: {sql_file_path}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    db = 'liga1.db'
    migration_file = 'migrations/011_player_defensive_dribbles.sql'
    
    print("Aplicando migración...")
    apply_migration(db, migration_file)