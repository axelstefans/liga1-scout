import sqlite3

def auditar_base_datos(db_path):
    print(f"\n🔍 Auditando: {db_path}")
    print("=" * 40)
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Obtener todas las tablas
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tablas = cursor.fetchall()
        
        if not tablas:
            print("La base de datos está vacía.")
            return

        for tabla in tablas:
            nombre_tabla = tabla[0]
            print(f"\n📁 TABLA: {nombre_tabla}")
            print("-" * 30)
            
            # Obtener columnas de cada tabla
            cursor.execute(f"PRAGMA table_info({nombre_tabla});")
            columnas = cursor.fetchall()
            
            for col in columnas:
                # col[1] es el nombre de la columna, col[2] es el tipo de dato
                print(f"   - {col[1]} ({col[2]})")
                
        conn.close()
        print("\n✅ Auditoría finalizada.")
        
    except sqlite3.Error as e:
        print(f"Error al conectar con la base de datos: {e}")

# Ejecutar la auditoría
auditar_base_datos('liga1.db')