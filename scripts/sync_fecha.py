import sys
import time
import sqlite3
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from scraper.flashscore_client import FlashscoreClient
import scraper.flashscore_parser as fp


def sync_jornada(dias_atras: int = 5):
    client = FlashscoreClient()
    conn = sqlite3.connect(str(ROOT_DIR / "liga1.db"))
    conn.row_factory = sqlite3.Row

    print("=" * 75)
    print("SINCRONIZADOR AUTOMÁTICO DE FLASHSCORE")
    print("=" * 75)

    # 1. Buscar únicamente partidos YA JUGADOS (fecha <= ahora) sin stats
    query = """
        SELECT m.match_id, m.match_date, m.home_team_id, m.away_team_id,
               t1.name as home_name, t2.name as away_name
        FROM matches m
        JOIN teams t1 ON m.home_team_id = t1.team_id
        JOIN teams t2 ON m.away_team_id = t2.team_id
        WHERE m.match_date >= datetime('now', ?)
          AND m.match_date <= datetime('now', '+1 day')
          AND m.match_id NOT IN (
              SELECT DISTINCT match_id FROM flashscore_match_team_stats WHERE match_id IS NOT NULL
          )
        ORDER BY m.match_date DESC
    """
    pending = conn.execute(query, (f"-{dias_atras} days",)).fetchall()

    if not pending:
        print("✅ Todos los partidos jugados en los últimos días ya están sincronizados.")
        print("=" * 75)
        return

    print(f"Partidos jugados pendientes en BD: {len(pending)}")
    for p in pending:
        print(f"  • [{p['match_date'][:10]}] {p['home_name']} vs {p['away_name']} (ID: {p['match_id']})")

    # 2. Descubrir eventos en Flashscore
    results_url = "https://www.flashscore.pe/futbol/peru/liga-1/resultados/"
    event_ids = client.discover_tournament_matches(results_url)
    print(f"\nDescubiertos {len(event_ids)} eventos recientes en la web.")

    # 3. Descargar y procesar
    sync_count = 0
    for eid in event_ids[:20]:
        # Si el evento ya existe en BD, lo saltamos directamente
        exists = conn.execute(
            "SELECT 1 FROM flashscore_match_team_stats WHERE flashscore_event_id = ?",
            (eid,),
        ).fetchone()
        if exists:
            continue

        raw = client.fetch_match_team_stats_raw(eid)
        if not raw:
            continue

        parsed = fp.parse_flashscore_team_stats(raw)
        team_ids = [r["team_id"] for r in parsed if r.get("team_id")]
        if len(team_ids) < 2:
            continue

        t1, t2 = team_ids[0], team_ids[1]

        target = next(
            (
                m
                for m in pending
                if (m["home_team_id"] in (t1, t2) and m["away_team_id"] in (t1, t2))
            ),
            None,
        )

        if target:
            saved = fp.process_and_save_flashscore_stats(
                db_conn=conn,
                raw_data=raw,
                match_id=target["match_id"],
                flashscore_event_id=eid,
            )
            print(f"✅ Sincronizado: {target['home_name']} vs {target['away_name']} ({len(saved)} bloques)")
            sync_count += 1
            time.sleep(2.5)

    print(f"\nProceso finalizado: {sync_count} partidos nuevos sincronizados.")
    print("=" * 75)


if __name__ == "__main__":
    dias = int(sys.argv[1]) if len(sys.argv) > 1 else 5
    sync_jornada(dias)
