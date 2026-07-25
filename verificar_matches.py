import sqlite3

# Conectamos a la base de datos
conn = sqlite3.connect("liga1.db")
cursor = conn.cursor()

# Extraemos la estructura de la tabla 'matches'
cursor.execute("PRAGMA table_info(matches);")
columnas = cursor.fetchall()

print("\n" + "="*50)
print("   ESTRUCTURA DE LA TABLA 'MATCHES'")
print("="*50)
print(f"{'#':<5} | {'Nombre de la Columna':<25} | {'Tipo de Dato'}")
print("-" * 50)

for col in columnas:
    print(f"{col[0]:<5} | {col[1]:<25} | {col[2]}")

print("="*50 + "\n")
conn.close()