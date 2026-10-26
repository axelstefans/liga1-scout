"""
scripts/backfill_positions_and_lineage.py
Backfill idempotente de was_substitute, position_source y replaced_player_id.
"""
import sys
import argparse
import sqlite3
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("backfill")

def run_backfill(db_path: str, apply_changes: bool = False):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    logger.info(f"Conectando a {db_path} (Modo: {'APPLY' if apply_changes else 'DRY-RUN'})...")
    
    # 1. Reporte de línea base (Antes)
    baseline_query = """
        SELECT 
            COUNT(CASE WHEN was_substitute = 0 THEN 1 END) as was_sub_0,
            COUNT(CASE WHEN was_substitute = 1 THEN 1 END) as was_sub_1,
            COUNT(CASE WHEN was_substitute IS NULL THEN 1 END) as was_sub_null,
            COUNT(CASE WHEN position IN ('G', 'D', 'M', 'F') THEN 1 END) as generic_pos,
            COUNT(CASE WHEN position NOT IN ('G', 'D', 'M', 'F') AND position IS NOT NULL THEN 1 END) as tactical_pos,
            COUNT(CASE WHEN position_source = 'starting_xi' THEN 1 END) as src_starting_xi,
            COUNT(CASE WHEN position_source = 'fallback' OR position_source IS NULL THEN 1 END) as src_fallback
        FROM player_match_stats
    """
    cur.execute(baseline_query)
    base = cur.fetchone()
    logger.info("=== REPORTE ANTES DEL BACKFILL ===")
    logger.info(f"was_substitute: 0={base[0]}, 1={base[1]}, NULL={base[2]}")
    logger.info(f"Posiciones: Genericas={base[3]}, Tacticas={base[4]}")
    logger.info(f"position_source: starting_xi={base[5]}, fallback={base[6]}")

    if not apply_changes:
        # En modo dry-run simulamos la consulta para reportar conteos proyectados
        sim_query = """
        WITH ranked AS (
            SELECT 
                pms.id,
                ROW_NUMBER() OVER (
                    PARTITION BY pms.match_id, pms.team_id
                    ORDER BY 
                        CASE 
                            WHEN pms.position NOT IN ('G', 'D', 'M', 'F') AND pms.position IS NOT NULL THEN 0
                            ELSE 1
                        END ASC,
                        COALESCE(pms.minutes_played, 0) DESC,
                        (SELECT COUNT(*) FROM player_passes pp WHERE pp.match_id = pms.match_id AND pp.player_id = pms.player_id) DESC,
                        pms.player_id ASC
                ) as starter_rank,
                pms.position
            FROM player_match_stats pms
        )
        SELECT 
            COUNT(CASE WHEN starter_rank <= 11 THEN 1 END) as proj_starters,
            COUNT(CASE WHEN starter_rank > 11 THEN 1 END) as proj_subs,
            COUNT(CASE WHEN starter_rank <= 11 AND position NOT IN ('G', 'D', 'M', 'F') THEN 1 END) as proj_src_starting_xi,
            COUNT(CASE WHEN starter_rank > 11 OR position IN ('G', 'D', 'M', 'F') OR position IS NULL THEN 1 END) as proj_src_fallback
        FROM ranked;
        """
        cur.execute(sim_query)
        sim = cur.fetchone()
        logger.info("=== PROYECCIÓN DRY-RUN ===")
        logger.info(f"was_substitute proyectado: 0={sim[0]}, 1={sim[1]}")
        logger.info(f"position_source proyectado: starting_xi={sim[2]}, fallback={sim[3]}")
        logger.info("[DRY-RUN] No se realizaron modificaciones en la base de datos.")
        conn.close()
        return

    try:
        cur.execute("BEGIN TRANSACTION;")
        
        # 2. Actualización de titulares y suplentes con fuentes deterministas
        update_sql = """
        WITH ranked AS (
            SELECT 
                pms.id,
                ROW_NUMBER() OVER (
                    PARTITION BY pms.match_id, pms.team_id
                    ORDER BY 
                        CASE 
                            WHEN pms.position NOT IN ('G', 'D', 'M', 'F') AND pms.position IS NOT NULL THEN 0
                            ELSE 1
                        END ASC,
                        COALESCE(pms.minutes_played, 0) DESC,
                        (SELECT COUNT(*) FROM player_passes pp WHERE pp.match_id = pms.match_id AND pp.player_id = pms.player_id) DESC,
                        pms.player_id ASC
                ) as starter_rank,
                pms.position
            FROM player_match_stats pms
        )
        UPDATE player_match_stats
        SET 
            was_substitute = CASE WHEN r.starter_rank <= 11 THEN 0 ELSE 1 END,
            position_source = CASE 
                WHEN r.starter_rank <= 11 AND r.position NOT IN ('G', 'D', 'M', 'F') THEN 'starting_xi'
                ELSE 'fallback'
            END
        FROM ranked r
        WHERE player_match_stats.id = r.id;
        """
        cur.execute(update_sql)

        # 3. Verificación de integridad de 11 titulares
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

        # 4. Reporte Después
        cur.execute(baseline_query)
        after = cur.fetchone()
        logger.info("=== REPORTE DESPUÉS DEL BACKFILL ===")
        logger.info(f"was_substitute: 0={after[0]}, 1={after[1]}, NULL={after[2]}")
        logger.info(f"Posiciones: Genericas={after[3]}, Tacticas={after[4]}")
        logger.info(f"position_source: starting_xi={after[5]}, fallback={after[6]}")

    except Exception as e:
        conn.rollback()
        logger.error(f"Error durante el backfill. Se aplicó ROLLBACK: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backfill de was_substitute y linaje táctico")
    parser.add_argument("--db", type=str, default="liga1.db", help="Ruta a la base de datos")
    parser.add_argument("--apply", action="store_true", help="Aplica los cambios a la BD")
    args = parser.parse_args()
    run_backfill(args.db, apply_changes=args.apply)
