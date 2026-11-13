# Guía de Ingesta, Scraper y Backfill (`scraper/` y `scripts/`)

Este documento reúne los comandos de extracción completa, sincronización incremental y *backfill* histórico para poblar y mantener actualizada la base de datos SQLite (`liga1.db`).

> **Requisitos operativos**: los extractores de Sofascore utilizan `LanusStats` junto a `undetected-chromedriver`, por lo que requieren **Google Chrome** instalado en el sistema. El cliente de Flashscore emplea peticiones HTTP con suplantación TLS vía `curl_cffi`.

---

## 1. Pipeline Completo y Etapas Modulares (`scraper/run.py`)

Ejecute el flujo integral desde cero (el script aplica migraciones automáticamente e imprime ayuda si se invoca sin argumentos):

```bash
python -m scraper.run --full
```

### Banderas por etapa individual

| Bandera | Fuente | Responsabilidad |
| :--- | :--- | :--- |
| `--teams-only` | Sofascore | Registra los clubes de la temporada configurada en `scraper/config.py` (`SEASON_ID = 88529`). |
| `--squads-only` | Sofascore | Descarga plantillas actuales y metadatos de jugadores (`position`, dorsal, pierna hábil, altura). |
| `--season-stats-only` | Sofascore | Estadísticas individuales acumuladas de temporada en 58 métricas (`player_season_stats`). |
| `--matches-only` | Sofascore | Calendario, fechas, marcadores y estado (`played`, `postponed`, `canceled`). |
| `--match-stats-only` | Sofascore | Estadísticas individuales por partido (`player_match_stats`) y mapas de calor de partido. |
| `--rematch-stats` | Sofascore | Limpia `player_match_stats` y la caché asociada en `scrape_log` para re-extraer partidos. |
| `--period-stats-only` | Sofascore | Métricas por mitad (`ALL`, `1ST`, `2ND`) e incidentes de goles, tarjetas y sustituciones. |
| `--referees-only` | Sofascore | Asignación de árbitros principales y estadísticas disciplinarias históricas (`referees`). |
| `--transfermarkt-only` | Transfermarkt | Valores de mercado mediante `LanusStats.Transfermarkt()`. |
| `--spatial-only` | Sofascore | Eventos espaciales por partido: pases, conducciones (`player_ball_carries`), regates y acciones defensivas. |
| `--shotmap-only` | Sofascore | Mapas de tiros geolocalizados y cálculo automático de xG pendiente en `player_shots_xg`. |
| `--heatmaps-only` | Sofascore | Mapas de calor de temporada por jugador (`player_heatmaps`). |
| `--team-metrics-only` | SQLite local | Recalcula las 34 métricas tácticas colectivas por partido (`team_match_metrics`). |
| `--percentiles-only` | SQLite local | Recalcula percentiles posicionales y por rol táctico (`player_season_percentiles` y `player_season_role_percentiles`; cohorte calificada `>= 450` min). |
| `--flashscore-only` | Flashscore | Sincroniza estadísticas colectivas por tramo (`1T`, `2T`, `ALL`) mediante `scripts/sync_discovered_matches.py`. |

Modificadores adicionales:
- `--target-match <MATCH_ID>`: restringe el paso a un partido específico.
- `--test-mode`: limita la ejecución a un solo partido para pruebas controladas.
- `--flashscore-limit <N>` y `--flashscore-dry-run`: acota o simula la sincronización de Flashscore sin escribir en BD.

---

## 2. Sincronización Incremental (`scraper/unified_runner.py`)

El orquestador incremental coordina **Sofascore $\rightarrow$ Flashscore $\rightarrow$ recálculo de agregados** con bloqueo atómico (`.runner.lock`), copia de seguridad automática en `backups/` antes de escribir y verificación final (`PRAGMA integrity_check` y `foreign_key_check`):

```bash
# Procesar partidos de los últimos 5 días (valor por defecto)
python -m scraper.unified_runner --recent 5

# Procesar una jornada específica de un torneo
python -m scraper.unified_runner --round 14 --tournament Clausura

# Ejecutar solo una fase del flujo
python -m scraper.unified_runner --recent 7 --only sofascore
python -m scraper.unified_runner --recent 7 --only flashscore
python -m scraper.unified_runner --recent 7 --only aggregates

# Simulación en modo solo lectura (sin escrituras ni red)
python -m scraper.unified_runner --recent 5 --dry-run
```

También dispone de sincronización rápida exclusivamente para resultados recientes de Flashscore:

```bash
python scripts/sync_fecha.py 5
```

---

## 3. Backfill y Scripts de Mantenimiento

| Script | Uso |
| :--- | :--- |
| `python -m scraper.backfill_ball_carries` | Completa conducciones (`player_ball_carries`) para partidos que ya tienen acciones defensivas (`--dry-run`, `--limit`, `--delay`). |
| `python -m scraper.backfill_defensive_action_types` | Clasifica `action_type` y coordenadas finales en `player_defensive_actions`. |
| `python -m scraper.backfill_goal_mouth` | Completa coordenadas en portería (`goal_mouth_x/y/z`, `goal_mouth_location`) en `player_shots`. |
| `python -m scraper.sources.xg_aggregation` | Recalcula `player_season_stats.expected_goals` con `xg_model_pipeline.pkl` y penal fijo `0.79`. |
| `python scripts/backfill_disciplinary_2026.py` | Reconstruye datos disciplinarios (tarjetas e incidentes de falta) para la temporada 2026. |
| `python scripts/backfill_positions_and_lineage.py` | Asigna posiciones tácticas y linaje de posiciones históricas. |

---

## 4. Control de Ritmo y Protección Anti-Baneo

- **Caché e idempotencia**: `scraper/db.py:log_scrape()` e `is_cached()` registran cada petición exitosa en `scrape_log` para evitar descargas duplicadas al reanudar un proceso interrumpido.
- **Sofascore (`scraper/http_client.py`)**: ventana inicial de 25 segundos en modo Chrome visible (*headed*) para despejar Turnstile, pausas aleatorias de `2.0 s` a `5.0 s`, *backoff* exponencial ante errores y parada automática tras `3` respuestas `403` consecutivas.
- **Flashscore (`scraper/flashscore_client.py`)**: suplantación TLS `chrome124` vía `curl_cffi`, resolución DNS de respaldo para `global.ds.lsapp.eu`, pausas con *jitter* de `3.5–6.0 s`, bloques de enfriamiento (`12–18 s` cada `5` partidos) y *circuit breaker* inmediato ante HTTP `403` o `429`.
