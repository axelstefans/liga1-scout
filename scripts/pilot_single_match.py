"""Script piloto aislado para ingesta unitaria en vivo de disciplina y sustituciones.
Restricción estricta: Únicamente procesa match_id = 16280856 (Universitario vs Juan Pablo II).
"""

import codecs
import json
import logging
import os
import sys
import time
from typing import Any, Dict, List

# Forzar codificación UTF-8 en salida estándar de Windows
if sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = codecs.getwriter("utf-8")(sys.stdout.buffer, "replace")

# Agregar raíz del repositorio a sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from scraper.db import get_connection
from scraper.config import DB_PATH
from scraper.http_client import SofaScoreAPIClient, is_challenge_response
from scraper.sources.match_stats import save_match_cards, save_match_substitutions

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("pilot_single_match")

TARGET_MATCH_ID = 16280856


def fetch_resource(client: SofaScoreAPIClient, endpoint: str) -> dict:
    """Obtiene recurso JSON vía _polite_get o in-browser fetch como fallback."""
    logger.info(f"Consultando endpoint: {endpoint}")
    
    # Intento 1: _polite_get con reintentos
    try:
        data = client._polite_get(endpoint)
        if data and not is_challenge_response(data):
            return data
    except Exception as e:
        logger.warning(f"_polite_get falló para {endpoint}: {e}. Intentando fallback en navegador...")

    # Intento 2: fetch_in_browser dentro de la sesión de Chrome
    browser_endpoint = endpoint if endpoint.startswith("/") else f"/{endpoint}"
    data = client.fetch_in_browser(browser_endpoint)
    if data and not is_challenge_response(data):
        return data

    raise RuntimeError(f"No se pudo obtener una respuesta JSON válida para {endpoint}")


def run_pilot():
    print("=" * 80)
    print(f"PILOTO DE INGESTA EN VIVO: DISCIPLINA Y SUSTITUCIONES (MATCH {TARGET_MATCH_ID})")
    print("=" * 80)

    # 1. Conexión a la base de datos (WAL)
    conn = get_connection(DB_PATH)
    logger.info(f"Conexión establecida con {DB_PATH} (WAL activado).")

    # 2. Extraer datos del partido
    match = conn.execute("""
        SELECT m.match_id, m.home_team_id, m.away_team_id, m.match_date, m.round, m.status,
               t1.name as home_name, t2.name as away_name
        FROM matches m
        JOIN teams t1 ON m.home_team_id = t1.team_id
        JOIN teams t2 ON m.away_team_id = t2.team_id
        WHERE m.match_id = ?
    """, (TARGET_MATCH_ID,)).fetchone()

    if not match:
        logger.error(f"El partido {TARGET_MATCH_ID} no existe en la tabla matches.")
        return

    home_team_id = match["home_team_id"]
    away_team_id = match["away_team_id"]
    print(f"Partido: {match['home_name']} vs {match['away_name']}")
    print(f"Fecha: {match['match_date']} | Jornada: {match['round']} | Estado: {match['status']}")
    print(f"Home ID: {home_team_id} | Away ID: {away_team_id}")
    print("-" * 80)

    # 3. Inicializar SofaScoreAPIClient
    api_client = SofaScoreAPIClient()

    try:
        # Calentamiento inicial del driver para superar Turnstile
        logger.info("Realizando calentamiento previo de sesión Turnstile...")
        api_client._ensure_warmed_up_driver()

        # 4. Obtener alineaciones e incidencias para el partido
        lineups_endpoint = f"api/v1/event/{TARGET_MATCH_ID}/lineups"
        incidents_endpoint = f"api/v1/event/{TARGET_MATCH_ID}/incidents"

        lineups_data = fetch_resource(api_client, lineups_endpoint)
        time.sleep(2)  # Pausa cortés
        incidents_data = fetch_resource(api_client, incidents_endpoint)

        incidents_list = incidents_data.get("incidents", []) if isinstance(incidents_data, dict) else []
        logger.info(f"Incidencias recibidas: {len(incidents_list)} eventos.")

        # 5. Persistir tarjetas y sustituciones usando funciones de match_stats.py
        cards_inserted = save_match_cards(conn, TARGET_MATCH_ID, home_team_id, away_team_id, incidents_list)
        subs_inserted = save_match_substitutions(conn, TARGET_MATCH_ID, home_team_id, away_team_id, incidents_list)
        logger.info(f"Tarjetas guardadas: {cards_inserted} | Sustituciones guardadas: {subs_inserted}")

        # 6. Actualizar fouls y was_fouled en player_match_stats
        updated_players = 0
        all_players_stats = []

        for side in ["home", "away"]:
            side_info = lineups_data.get(side, {})
            players = side_info.get("players", [])
            for p_entry in players:
                p_obj = p_entry.get("player", {})
                p_id = p_obj.get("id")
                p_name = p_obj.get("name")
                if not p_id:
                    continue

                stats = p_entry.get("statistics", {})
                if not stats:
                    # Suplente sin minutos/estadísticas reportadas
                    continue

                fouls = int(stats.get("fouls") or 0)
                was_fouled = int(stats.get("wasFouled") or 0)

                cur = conn.execute("""
                    UPDATE player_match_stats
                    SET fouls = ?, was_fouled = ?
                    WHERE match_id = ? AND player_id = ?
                """, (fouls, was_fouled, TARGET_MATCH_ID, p_id))

                if cur.rowcount > 0:
                    updated_players += 1
                    all_players_stats.append({
                        "player_id": p_id,
                        "name": p_name,
                        "fouls": fouls,
                        "was_fouled": was_fouled
                    })

        logger.info(f"Jugadores actualizados en player_match_stats: {updated_players}")

    finally:
        # Cierre limpio del navegador Chrome
        logger.info("Cerrando sesión de SofaScoreAPIClient...")
        api_client.close()

    # 7. Consultar y mostrar resultados reales de la base de datos
    print("\n" + "=" * 80)
    print("RESULTADOS OBTENIDOS EN BASE DE DATOS (liga1.db)")
    print("=" * 80)

    # Tarjetas
    card_rows = conn.execute("""
        SELECT minute, extra_minute, player_name, card_type, reason, rescinded
        FROM match_card_incidents
        WHERE match_id = ?
        ORDER BY minute, extra_minute
    """, (TARGET_MATCH_ID,)).fetchall()

    print(f"\n[A] TABLA match_card_incidents ({len(card_rows)} registros):")
    print(f"{'Minuto':<10} | {'Jugador':<30} | {'Tarjeta':<12} | {'Motivo':<20}")
    print("-" * 78)
    for c in card_rows:
        min_str = f"{c['minute']}'" if not c['extra_minute'] else f"{c['minute']}+{c['extra_minute']}'"
        print(f"{min_str:<10} | {c['player_name'] or '-':<30} | {c['card_type'] or '-':<12} | {c['reason'] or '-':<20}")

    # Sustituciones
    sub_rows = conn.execute("""
        SELECT minute, extra_minute, player_in_name, player_out_name
        FROM match_substitution_incidents
        WHERE match_id = ?
        ORDER BY minute, extra_minute
    """, (TARGET_MATCH_ID,)).fetchall()

    print(f"\n[B] TABLA match_substitution_incidents ({len(sub_rows)} registros):")
    print(f"{'Minuto':<10} | {'Entra':<30} | {'Sale':<30}")
    print("-" * 74)
    for s in sub_rows:
        min_str = f"{s['minute']}'" if not s['extra_minute'] else f"{s['minute']}+{s['extra_minute']}'"
        print(f"{min_str:<10} | {s['player_in_name'] or '-':<30} | {s['player_out_name'] or '-':<30}")

    # Muestreo de 5 jugadores en player_match_stats
    sample_players = conn.execute("""
        SELECT pms.player_id, COALESCE(p.name, 'ID ' || pms.player_id) as player_name,
               t.name as team_name, pms.minutes_played, pms.fouls, pms.was_fouled
        FROM player_match_stats pms
        LEFT JOIN players p ON pms.player_id = p.player_id
        LEFT JOIN teams t ON pms.team_id = t.team_id
        WHERE pms.match_id = ? AND (pms.fouls > 0 OR pms.was_fouled > 0)
        ORDER BY (pms.fouls + pms.was_fouled) DESC, pms.minutes_played DESC
        LIMIT 5
    """, (TARGET_MATCH_ID,)).fetchall()

    if len(sample_players) < 5:
        # Fallback si no hay suficientes con faltas > 0
        sample_players = conn.execute("""
            SELECT pms.player_id, COALESCE(p.name, 'ID ' || pms.player_id) as player_name,
                   t.name as team_name, pms.minutes_played, pms.fouls, pms.was_fouled
            FROM player_match_stats pms
            LEFT JOIN players p ON pms.player_id = p.player_id
            LEFT JOIN teams t ON pms.team_id = t.team_id
            WHERE pms.match_id = ?
            ORDER BY pms.minutes_played DESC
            LIMIT 5
        """, (TARGET_MATCH_ID,)).fetchall()

    print(f"\n[C] MUESTREO EN player_match_stats (Top Fricción - 5 Jugadores):")
    print(f"{'Jugador':<28} | {'Equipo':<22} | {'Min':<5} | {'Faltas Cometidas':<17} | {'Faltas Recibidas':<16}")
    print("-" * 95)
    for p in sample_players:
        print(f"{p['player_name']:<28} | {p['team_name'] or '-':<22} | {str(p['minutes_played']):<5} | {str(p['fouls']):<17} | {str(p['was_fouled']):<16}")

    print("\n" + "=" * 80)
    print("PILOTO COMPLETADO EXITOSAMENTE.")
    print("=" * 80)


if __name__ == "__main__":
    run_pilot()
