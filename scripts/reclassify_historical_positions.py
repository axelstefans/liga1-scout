"""
scripts/reclassify_historical_positions.py
Reclasificación histórica de 32 registros defensivos de Alianza Lima con trazabilidad auditada.
Aplica position_source = 'spatial_inferred' según slot y distribución espacial verificada.
"""
import argparse
import logging
import sqlite3
import sys

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("reclassify")

# Definición explícita de las 32 tuplas auditadas:
# (match_id, player_id) -> nueva_posición_táctica
RECLASSIFICATIONS = {
    # 1. Partido 16022826 (Fecha 14 Apertura vs Sporting Cristal)
    (16022826, 1090720): "RB",   # Marco Huamán (Slot 1, avg_y = 19.2)
    (16022826, 874984):  "RCB",  # Gianfranco Chávez (Slot 2, avg_y = 28.1)
    (16022826, 874985):  "LCB",  # Renzo Garcés (Slot 3, avg_y = 65.5)
    (16022826, 1116589): "LB",   # Mateo Antoni (Slot 4, avg_y = 85.9)
    
    # 2. Partido 15929231 (Fecha 12 Apertura vs Atlético Grau)
    (15929231, 149850):  "RB",   # Luis Advíncula (Slot 1, avg_y = 14.4)
    (15929231, 874984):  "RCB",  # Gianfranco Chávez (Slot 2, avg_y = 25.6)
    (15929231, 1116589): "LCB",  # Mateo Antoni (Slot 3, avg_y = 73.4)
    (15929231, 1090720): "LB",   # Marco Huamán (Slot 4, avg_y = 86.6)
    
    # 3. Partido 15930115 (Fecha 13 Apertura vs CD Moquegua)
    (15930115, 149850):  "RB",   # Luis Advíncula (Slot 1, avg_y = 18.4)
    (15930115, 874985):  "RCB",  # Renzo Garcés (Slot 2, avg_y = 30.8)
    (15930115, 1116589): "LCB",  # Mateo Antoni (Slot 3, avg_y = 67.9)
    (15930115, 1090720): "LB",   # Marco Huamán (Slot 4, avg_y = 81.2)
    
    # 4. Partido 16147468 (Fecha 16 Apertura vs Los Chankas CYC)
    (16147468, 149850):  "RB",   # Luis Advíncula (Slot 1, avg_y = 17.9)
    (16147468, 874985):  "RCB",  # Renzo Garcés (Slot 2, avg_y = 30.9)
    (16147468, 1116589): "LCB",  # Mateo Antoni (Slot 3, avg_y = 68.7)
    (16147468, 1090720): "LB",   # Marco Huamán (Slot 4, avg_y = 82.2)
    
    # 5. Partido 16281109 (Fecha 1 Clausura vs Sport Huancayo)
    (16281109, 149850):  "RB",   # Luis Advíncula (Slot 1, avg_y = 18.2)
    (16281109, 874985):  "RCB",  # Renzo Garcés (Slot 2, avg_y = 33.0)
    (16281109, 1116589): "LCB",  # Mateo Antoni (Slot 3, avg_y = 69.3)
    (16281109, 1090720): "LB",   # Marco Huamán (Slot 4, avg_y = 81.3)
    
    # 6. Partido 16280779 (Fecha 3 Clausura vs Alianza Atlético)
    (16280779, 149850):  "RB",   # Luis Advíncula (Slot 1, avg_y = 22.0)
    (16280779, 874985):  "RCB",  # Renzo Garcés (Slot 2, avg_y = 36.4)
    (16280779, 1116589): "LCB",  # Mateo Antoni (Slot 3, avg_y = 75.7)
    (16280779, 1090720): "LB",   # Marco Huamán (Slot 4, avg_y = 82.7)
    
    # 7. Partido 16280820 (Fecha 9 Clausura vs Universitario)
    (16280820, 149850):  "RB",   # Luis Advíncula (Slot 1, avg_y = 18.6)
    (16280820, 874985):  "RCB",  # Renzo Garcés (Slot 2, avg_y = 38.8)
    (16280820, 1116589): "LCB",  # Mateo Antoni (Slot 3, avg_y = 77.6)
    (16280820, 1090720): "LB",   # Marco Huamán (Slot 4, avg_y = 82.9)
    
    # 8. Partido 16280841 (Fecha 12 Clausura vs Atlético Grau)
    (16280841, 149850):  "RB",   # Luis Advíncula (Slot 1, avg_y = 20.2)
    (16280841, 874985):  "RCB",  # Renzo Garcés (Slot 2, avg_y = 46.1)
    (16280841, 1116589): "LCB",  # Mateo Antoni (Slot 3, avg_y = 76.9)
    (16280841, 1090720): "LB",   # Marco Huamán (Slot 4, avg_y = 83.1)
}

SVG_VALID_COORDS = {"LB", "LCB", "CB", "RCB", "RB"}

def run_reclassification(db_path: str, apply_changes: bool = False):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    logger.info(f"Conectando a {db_path} (Modo: {'APPLY' if apply_changes else 'DRY-RUN'})...")
    
    # 1. Validación previa de SVG coordinates
    for (mid, pid), target_pos in RECLASSIFICATIONS.items():
        if target_pos not in SVG_VALID_COORDS:
            raise ValueError(f"CRITERIO DE PARADA: Posición '{target_pos}' no tiene coordenadas en el SVG.")
            
    # 2. Reporte de línea base (Antes)
    def print_player_stats(header: str):
        logger.info(f"--- {header} ---")
        cur.execute("""
            SELECT position, position_source, was_substitute, COUNT(*), SUM(minutes_played)
            FROM player_match_stats
            WHERE player_id = 1090720
            GROUP BY position, position_source, was_substitute
            ORDER BY SUM(minutes_played) DESC
        """)
        for r in cur.fetchall():
            logger.info(f"  Marco Huamán: pos={r[0]}, src={r[1]}, was_sub={r[2]}, cnt={r[3]}, mins={r[4]}")
            
        cur.execute("""
            SELECT prg.player_id, p.name, prg.role_group, prg.classified_minutes
            FROM player_role_groups prg
            JOIN players p ON prg.player_id = p.player_id
            WHERE prg.player_id IN (1090720, 149850, 874985, 874984, 1116589)
            ORDER BY p.name
        """)
        for r in cur.fetchall():
            logger.info(f"  Rol clasificado: {r[1]} ({r[0]}) -> rol={r[2]}, mins={r[3]}")

    print_player_stats("ESTADO ANTES DE RECLASIFICACIÓN")
    
    if not apply_changes:
        logger.info(f"[DRY-RUN] Se identificaron exactamente {len(RECLASSIFICATIONS)} tuplas para actualizar.")
        # Simulación de filas que cumplirían el filtro estricto
        valid_candidates = 0
        for (mid, pid), target_pos in RECLASSIFICATIONS.items():
            cur.execute("""
                SELECT 1 FROM player_match_stats
                WHERE match_id = ? AND player_id = ? AND was_substitute = 0 AND position = 'D'
            """, (mid, pid))
            if cur.fetchone():
                valid_candidates += 1
                
        logger.info(f"[DRY-RUN] Filas válidas para actualizar (was_substitute=0, position='D'): {valid_candidates} de 32.")
        if valid_candidates != 32:
            logger.error(f"[DRY-RUN] CRITERIO DE PARADA: Se esperaban 32 filas candidatas, pero hay {valid_candidates}.")
            sys.exit(1)
            
        logger.info("[DRY-RUN] Simulación exitosa. No se modificó la base de datos.")
        conn.close()
        return

    # MODO APPLY: Ejecución en transacción única con rollback
    try:
        cur.execute("BEGIN TRANSACTION;")
        
        total_updated = 0
        update_sql = """
            UPDATE player_match_stats
            SET position = ?, position_source = 'spatial_inferred'
            WHERE match_id = ? AND player_id = ? AND was_substitute = 0 AND position = 'D'
        """
        
        for (mid, pid), target_pos in RECLASSIFICATIONS.items():
            cur.execute(update_sql, (target_pos, mid, pid))
            total_updated += cur.rowcount
            
        logger.info(f"Filas afectadas por UPDATE: {total_updated} (esperadas: 32).")
        if total_updated != 32:
            raise ValueError(f"CRITERIO DE PARADA: Se afectaron {total_updated} filas, se requerían exactamente 32.")

        # Verificación de integridad: 11 titulares por fixture
        cur.execute("""
            SELECT count(*) FROM (
                SELECT match_id, team_id, count(*) as s_cnt
                FROM player_match_stats
                WHERE was_substitute = 0
                GROUP BY match_id, team_id
                HAVING s_cnt != 11
            )
        """)
        invalid_matches = cur.fetchone()[0]
        if invalid_matches > 0:
            raise ValueError(f"CRITERIO DE PARADA: Se encontraron {invalid_matches} partidos sin exactamente 11 titulares.")

        conn.commit()
        logger.info("Transacción confirmada exitosamente (COMMIT).")

        print_player_stats("ESTADO DESPUÉS DE RECLASIFICACIÓN")

    except Exception as e:
        conn.rollback()
        logger.error(f"Error durante la reclasificación. Se aplicó ROLLBACK: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Reclasificación histórica de 32 posiciones defensivas de Alianza Lima")
    parser.add_argument("--db", type=str, default="liga1.db", help="Ruta a la base de datos")
    parser.add_argument("--apply", action="store_true", help="Aplica los cambios a la base de datos")
    args = parser.parse_args()
    run_reclassification(args.db, apply_changes=args.apply)
