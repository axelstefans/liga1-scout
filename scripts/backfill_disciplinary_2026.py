"""Script oficial de backfill para eventos de disciplina (tarjetas, sustituciones y faltas individuales)
correspondientes a los partidos jugados en la temporada 2026 de la Liga 1 Peruana.

Características:
- Filtrado estricto por temporada 2026 (season_id = 88529).
- Modo reanudable idempotente (omite partidos ya registrados en match_card_incidents salvo --force).
- Políticas anti-baneo: warm-up de sesión Turnstile, pausas con jitter (3.5s - 6.0s), y circuito de corte
  preventivo ante retos de Cloudflare consecutivos.
- Modo --dry-run offline para auditoría previa sin llamadas de red ni escrituras en base de datos.
"""

import argparse
import codecs
import logging
import os
import random
import sqlite3
import sys
import time
from typing import Any, Dict, List, Optional

# Forzar codificación UTF-8 en salida estándar de Windows
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout = codecs.getwriter("utf-8")(sys.stdout.buffer, "replace")
    except Exception:
        pass

# Agregar directorio raíz al path de Python
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from scraper import config
from scraper.db import get_connection
from scraper.sources.match_stats import save_match_cards, save_match_substitutions

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("backfill_disciplinary_2026")

PILOT_MATCH_ID = 16280856


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Backfill disciplinario oficial de la Liga 1 - Temporada 2026."
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Procesar únicamente los primeros N partidos pendientes."
    )
    parser.add_argument(
        "--round",
        type=int,
        default=None,
        help="Filtrar exclusivamente por una jornada específica (ej. --round 13)."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Listar los partidos candidatos y su estado sin realizar llamadas de red ni escrituras."
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Reprocesar partidos incluso si ya cuentan con registros en match_card_incidents."
    )
    parser.add_argument(
        "--db-path",
        type=str,
        default=config.DB_PATH,
        help=f"Ruta al archivo SQLite (default: {config.DB_PATH})."
    )
    return parser.parse_args()


def fetch_resource_with_fallback(client: Any, endpoint: str) -> Optional[dict]:
    """Obtiene recurso JSON vía _polite_get o in-browser fetch como fallback."""
    from scraper.http_client import is_challenge_response

    # Intento 1: _polite_get
    try:
        data = client._polite_get(endpoint)
        if data and not is_challenge_response(data):
            return data
    except Exception as e:
        logger.warning(f"_polite_get no obtuvo JSON válido para {endpoint}: {e}. Probando fetch_in_browser...")

    # Intento 2: fetch_in_browser dentro de la sesión de Chrome
    browser_endpoint = endpoint if endpoint.startswith("/") else f"/{endpoint}"
    data = client.fetch_in_browser(browser_endpoint)
    return data


def _clean_stat_int(val: Any) -> int:
    """Convierte métrica a entero sanitizando None, NaN o cadenas vacías."""
    if val is None:
        return 0
    s = str(val).strip().lower()
    if s in ("nan", "none", "null", ""):
        return 0
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return 0


def run_dry_run(conn: sqlite3.Connection, args: argparse.Namespace) -> None:
    """Ejecuta inspección offline del estado de partidos candidatos sin tocar red ni escribir."""
    season_id = config.SEASON_ID

    print("=" * 85)
    print("BACKFILL DISCIPLINARIO 2026 - MODO DRY-RUN (OFFLINE / SOLO LECTURA)")
    print("=" * 85)
    print(f"Base de datos: {args.db_path}")
    print(f"Temporada objetivo: {season_id} (Liga 1 2026)")
    print(f"Filtro forzado (--force): {'SÍ' if args.force else 'NO (Modo Reanudable)'}")
    if args.round is not None:
        print(f"Filtro por jornada (--round): {args.round}")
    if args.limit is not None:
        print(f"Límite de partidos (--limit): {args.limit}")
    print("-" * 85)

    # 1. Auditoría global de la temporada 2026
    total_played = conn.execute("""
        SELECT COUNT(*) FROM matches
        WHERE season_id = ? AND status = 'played'
    """, (season_id,)).fetchone()[0]

    already_with_cards = conn.execute("""
        SELECT COUNT(DISTINCT m.match_id)
        FROM matches m
        JOIN match_card_incidents c ON m.match_id = c.match_id
        WHERE m.season_id = ? AND m.status = 'played'
    """, (season_id,)).fetchone()[0]

    # Verificar estado del partido piloto
    pilot_row = conn.execute("""
        SELECT m.match_id, m.round, m.match_date, t1.name as home, t2.name as away,
               (SELECT COUNT(*) FROM match_card_incidents WHERE match_id = m.match_id) as cards_count,
               (SELECT COUNT(*) FROM match_substitution_incidents WHERE match_id = m.match_id) as subs_count
        FROM matches m
        JOIN teams t1 ON m.home_team_id = t1.team_id
        JOIN teams t2 ON m.away_team_id = t2.team_id
        WHERE m.match_id = ?
    """, (PILOT_MATCH_ID,)).fetchone()

    print(f"Total partidos jugados registrados en temporada 2026: {total_played}")
    print(f"Partidos con tarjetas ya persistidas en BD:           {already_with_cards}")
    print(f"Partidos pendientes sin tarjetas:                      {total_played - already_with_cards}")
    print("-" * 85)

    if pilot_row:
        cards_status = f"{pilot_row['cards_count']} tarjetas, {pilot_row['subs_count']} sustituciones"
        omitted_str = "OMITIDO (Ya procesado)" if not args.force else "CANDIDATO (Forzado)"
        print(f"Verificación Partido Piloto ({PILOT_MATCH_ID}):")
        print(f"  • Partido: {pilot_row['home']} vs {pilot_row['away']} (Fecha {pilot_row['round']})")
        print(f"  • Datos en BD: {cards_status}")
        print(f"  • Estado para este backfill: {omitted_str}")
    else:
        print(f"Aviso: Partido piloto ({PILOT_MATCH_ID}) no encontrado en temporada 2026.")
    print("-" * 85)

    # 2. Selección de candidatos según flags CLI
    sql = """
        SELECT m.match_id, m.home_team_id, m.away_team_id, m.round, m.match_date,
               t1.name as home_name, t2.name as away_name,
               (SELECT COUNT(*) FROM match_card_incidents c WHERE c.match_id = m.match_id) as existing_cards
        FROM matches m
        JOIN teams t1 ON m.home_team_id = t1.team_id
        JOIN teams t2 ON m.away_team_id = t2.team_id
        WHERE m.season_id = ? AND m.status = 'played'
    """
    params: List[Any] = [season_id]

    if not args.force:
        sql += " AND m.match_id NOT IN (SELECT DISTINCT match_id FROM match_card_incidents)"

    if args.round is not None:
        sql += " AND m.round = ?"
        params.append(args.round)

    sql += " ORDER BY m.round ASC, m.match_date ASC, m.match_id ASC"

    if args.limit is not None:
        sql += " LIMIT ?"
        params.append(args.limit)

    candidates = conn.execute(sql, params).fetchall()

    print(f"Partidos candidatos seleccionados para ejecución: {len(candidates)}")
    print("-" * 85)

    if not candidates:
        print("No hay partidos pendientes bajo los filtros seleccionados.")
        print("=" * 85)
        return

    print(f"{'#':<4} | {'Match ID':<10} | {'Jor':<4} | {'Fecha':<11} | {'Local':<22} | {'Visita':<22} | {'Estado':<10}")
    print("-" * 95)
    for idx, c in enumerate(candidates, 1):
        status_lbl = "PENDIENTE" if c["existing_cards"] == 0 else f"REPROCESO ({c['existing_cards']} tarj)"
        print(f"{idx:<4} | {c['match_id']:<10} | {c['round']:<4} | {str(c['match_date'])[:10]:<11} | {c['home_name'][:21]:<22} | {c['away_name'][:21]:<22} | {status_lbl:<10}")

    print("=" * 95)
    print("VERIFICACIÓN DRY-RUN FINALIZADA. Cero llamadas de red y cero escrituras en BD.")
    print("=" * 95)


def run_backfill(conn: sqlite3.Connection, args: argparse.Namespace) -> None:
    """Ejecuta el backfill en vivo con SofaScoreAPIClient, pausas y circuito de corte."""
    from scraper.http_client import SofaScoreAPIClient, is_challenge_response

    season_id = config.SEASON_ID

    # Consulta de candidatos
    sql = """
        SELECT m.match_id, m.home_team_id, m.away_team_id, m.round, m.match_date,
               t1.name as home_name, t2.name as away_name
        FROM matches m
        JOIN teams t1 ON m.home_team_id = t1.team_id
        JOIN teams t2 ON m.away_team_id = t2.team_id
        WHERE m.season_id = ? AND m.status = 'played'
    """
    params: List[Any] = [season_id]

    if not args.force:
        sql += " AND m.match_id NOT IN (SELECT DISTINCT match_id FROM match_card_incidents)"

    if args.round is not None:
        sql += " AND m.round = ?"
        params.append(args.round)

    sql += " ORDER BY m.round ASC, m.match_date ASC, m.match_id ASC"

    if args.limit is not None:
        sql += " LIMIT ?"
        params.append(args.limit)

    candidates = conn.execute(sql, params).fetchall()

    if not candidates:
        logger.info("No se encontraron partidos pendientes para procesar.")
        return

    logger.info(f"Iniciando backfill disciplinario para {len(candidates)} partidos...")
    print(f"Total candidatos: {len(candidates)}")

    api_client = SofaScoreAPIClient()
    consecutive_challenges = 0
    processed_count = 0
    errors_count = 0

    try:
        logger.info("Iniciando warm-up de sesión en navegador Chrome visible...")
        api_client._ensure_warmed_up_driver()

        for idx, match in enumerate(candidates, 1):
            match_id = match["match_id"]
            home_team_id = match["home_team_id"]
            away_team_id = match["away_team_id"]
            logger.info(
                f"[{idx}/{len(candidates)}] Procesando Match {match_id} "
                f"(J{match['round']}: {match['home_name']} vs {match['away_name']})..."
            )

            lineups_endpoint = f"api/v1/event/{match_id}/lineups"
            incidents_endpoint = f"api/v1/event/{match_id}/incidents"

            # 1. Obtener alineaciones
            lineups_data = fetch_resource_with_fallback(api_client, lineups_endpoint)
            if is_challenge_response(lineups_data):
                consecutive_challenges += 1
                logger.error(f"Reto Cloudflare detectado en lineups para {match_id} (Racha: {consecutive_challenges}/3)")
                if consecutive_challenges >= 3:
                    logger.critical("Circuito de corte activado: 3 retos consecutivos. Abortando para proteger IP.")
                    break
                continue

            time.sleep(random.uniform(1.0, 2.0))

            # 2. Obtener incidencias
            incidents_data = fetch_resource_with_fallback(api_client, incidents_endpoint)
            if is_challenge_response(incidents_data):
                consecutive_challenges += 1
                logger.error(f"Reto Cloudflare detectado en incidents para {match_id} (Racha: {consecutive_challenges}/3)")
                if consecutive_challenges >= 3:
                    logger.critical("Circuito de corte activado: 3 retos consecutivos. Abortando para proteger IP.")
                    break
                continue

            # Respuestas válidas: resetear contador de retos
            consecutive_challenges = 0

            # 3. Persistir en transacción atómica
            try:
                conn.execute("BEGIN TRANSACTION")

                incidents_list = (
                    incidents_data.get("incidents", [])
                    if isinstance(incidents_data, dict)
                    else []
                )

                cards_saved = save_match_cards(conn, match_id, home_team_id, away_team_id, incidents_list)
                subs_saved = save_match_substitutions(conn, match_id, home_team_id, away_team_id, incidents_list)

                # Actualizar fouls y was_fouled en player_match_stats
                players_updated = 0
                if isinstance(lineups_data, dict):
                    for side in ["home", "away"]:
                        side_info = lineups_data.get(side, {})
                        for p_entry in side_info.get("players", []):
                            p_id = p_entry.get("player", {}).get("id")
                            if not p_id:
                                continue
                            stats = p_entry.get("statistics")
                            if not stats or not isinstance(stats, dict):
                                continue

                            fouls = _clean_stat_int(stats.get("fouls"))
                            was_fouled = _clean_stat_int(stats.get("wasFouled"))

                            cur = conn.execute("""
                                UPDATE player_match_stats
                                SET fouls = ?, was_fouled = ?
                                WHERE match_id = ? AND player_id = ?
                            """, (fouls, was_fouled, match_id, p_id))
                            if cur.rowcount > 0:
                                players_updated += 1

                conn.commit()
                processed_count += 1
                logger.info(
                    f"Match {match_id} completado con éxito: "
                    f"{cards_saved} tarjetas, {subs_saved} sustituciones, {players_updated} jugadores con faltas."
                )

            except Exception as ex:
                conn.execute("ROLLBACK")
                errors_count += 1
                logger.error(f"Error persistiendo datos para match {match_id}: {ex}")

            # 4. Pausa / Jitter entre partidos (3.5s a 6.0s)
            jitter = random.uniform(3.5, 6.0)
            logger.debug(f"Pausa de cortesía: {jitter:.2f}s...")
            time.sleep(jitter)

    except KeyboardInterrupt:
        logger.warning("Cancelación manual interceptada (Ctrl+C). Finalizando de manera segura...")

    finally:
        logger.info("Cerrando sesión de SofaScoreAPIClient...")
        try:
            api_client.close()
        except Exception:
            pass

    print("\n" + "=" * 80)
    print("RESUMEN DE EJECUCIÓN DE BACKFILL")
    print(f"Partidos procesados exitosamente: {processed_count}")
    print(f"Errores encontrados:               {errors_count}")
    print(f"Partidos pendientes restantes:     {len(candidates) - processed_count}")
    print("=" * 80)


def main() -> None:
    args = parse_args()
    conn = get_connection(args.db_path)

    try:
        if args.dry_run:
            run_dry_run(conn, args)
        else:
            run_backfill(conn, args)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
