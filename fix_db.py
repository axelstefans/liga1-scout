import sqlite3

# Conectar a la base de datos
conn = sqlite3.connect("liga1.db")

# Ejecutar la actualización de la tabla
conn.executescript("""
PRAGMA foreign_keys=OFF;

-- 1. Renombrar la tabla actual para proteger los datos de ayer
ALTER TABLE player_passes RENAME TO player_passes_old;

-- 2. Crear la nueva tabla SIN las restricciones estrictas (REFERENCES)
CREATE TABLE player_passes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER,
    player_id INTEGER,
    x_start REAL,
    y_start REAL,
    x_end REAL,
    y_end REAL,
    is_successful BOOLEAN,
    created_at TEXT NOT NULL
);

-- 3. Rescatar y copiar los pases que se descargaron ayer
INSERT INTO player_passes (id, match_id, player_id, x_start, y_start, x_end, y_end, is_successful, created_at)
SELECT id, match_id, player_id, x_start, y_start, x_end, y_end, is_successful, created_at 
FROM player_passes_old;

-- 4. Eliminar la tabla vieja
DROP TABLE player_passes_old;

-- 5. Recrear los índices de búsqueda rápida
CREATE INDEX idx_player_passes_match ON player_passes(match_id);
CREATE INDEX idx_player_passes_player ON player_passes(player_id);

PRAGMA foreign_keys=ON;
""")

conn.close()
print("¡Tabla actualizada correctamente! Los datos de ayer están a salvo y ya no habrá bloqueos.")