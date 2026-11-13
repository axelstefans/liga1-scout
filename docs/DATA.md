# Catálogo de Datos y Esquema SQL (`liga1.db`)

Este documento detalla la cobertura histórica, el esquema relacional y el volumen de registros de la base de datos SQLite (`liga1.db`, versión de esquema `24`, corte a **noviembre de 2026**).

> **Nota de distribución**: El archivo `liga1.db` está excluido del control de versiones (`.gitignore`). Para inicializar el esquema vacío ejecute `python scripts/init_db.py` y utilice los módulos de `scraper/` para poblar los datos desde las fuentes originales.

---

## Cobertura por Temporada (Liga 1 Perú)

| Temporada | `season_id` (Sofascore) | Partidos Finalizados (`played`) | Desglose por Torneo |
| :--- | :---: | :---: | :--- |
| **2023** | `48078` | 334 | Temporada completa |
| **2024** | `57741` | 306 | Temporada completa |
| **2025** | `70962` | 328 | Temporada completa |
| **2026** | `88529` | 285 | 153 Apertura + 132 Clausura |
| **Total** | — | **1,253** | De 1,333 programados (8 cancelados, 51 postergados, 21 por jugar) |

---

## Inventario de Tablas y Vistas SQL

### 1. Entidades Base y Partidos

| Tabla | Registros | Clave Primaria | Descripción y Columnas Principales |
| :--- | ---: | :--- | :--- |
| `teams` | 26 | `team_id` | Clubes registrados entre 2023 y 2026 (18 activos en 2026). Incluye `name`, `short_name`, `slug`, `primary_color`, `secondary_color`, `logo_url`, `tm_team_id` y `flashscore_id`. |
| `players` | 891 | `player_id` | Plantillas de jugadores con `team_id`, `name`, `date_of_birth`, `nationality`, `position`, `position_group`, `shirt_number`, `height` y `preferred_foot`. |
| `matches` | 1,333 | `match_id` | Calendario y resultados (`1,253` con `status = 'played'`). Incluye `season_id`, `round`, `match_date`, `home_team_id`, `away_team_id`, `home_score`, `away_score` y `referee_id`. |
| `referees` | 26 | `referee_id` | Árbitros principales de la Liga 1 (`name`, `slug`, `country`, `total_games_sofa`, `total_yellows_sofa`, `total_reds_sofa`). |

### 2. Eventos Espaciales (Coordenadas Opta/Sofascore 0–100)

| Tabla | Registros | Clave Primaria | Descripción y Columnas Principales |
| :--- | ---: | :--- | :--- |
| `player_passes` | 209,439 | `id` | Eventos de pase con coordenadas de origen (`x_start`, `y_start`), destino (`x_end`, `y_end`) e indicador de precisión (`is_successful`). |
| `player_ball_carries` | 86,849 | `id` | Conducciones inferidas espacialmente (`x_start`, `y_start`, `x_end`, `y_end`, `distance_m`, `prog_distance_m`). |
| `player_defensive_actions` | 51,180 | `id` | Intervenciones defensivas geolocalizadas (`x`, `y`, `end_x`, `end_y`) clasificadas por `action_type` (`ball-recovery`, `tackle`, `interception`, `clearance`, `foul`, `challenge`). |
| `player_shots` | 23,142 | `shot_id` | Tiros con coordenadas de origen (`coord_x`, `coord_y`), proyección en portería (`goal_mouth_x`, `goal_mouth_y`, `goal_mouth_z`, `goal_mouth_location`), geometría (`distance_m`, `angle_rad`) y contexto (`shot_type`, `situation`, `body_part`, `is_home`). |
| `player_shots_xg` | 23,142 | `shot_id` | Probabilidades Expected Goals (`calculated_xg`) vinculadas 1:1 con `player_shots`, unificadas bajo `model_version = 'v1.0-pipeline'` (`xg_model_pipeline.pkl` + `0.79` en penales) y `calculated_at`. |
| `player_dribbles` | 7,148 | `id` | Regates intentados con coordenadas (`x`, `y`) y resultado (`is_successful`). |
| `player_heatmaps` | 494 | `(player_id, season_id)` | Distribuciones de ocupación espacial serializadas en JSON (`heatmap_json`). |

### 3. Agregados Estadísticos, Percentiles e Incidentes

| Tabla | Registros | Clave Primaria | Descripción y Columnas Principales |
| :--- | ---: | :--- | :--- |
| `player_match_stats` | 11,361 | `id` | Rendimiento individual por partido (`minutes_played`, `was_substitute`, `position`, `sofascore_rating`, `goals`, `assists`, `expected_goals`, pases, duelos, acciones defensivas y disciplina). |
| `player_season_stats` | 495 | `player_id` | Totales acumulados de temporada en 58 métricas ofensivas, creativas, de pase, defensivas y de portería. |
| `player_season_percentiles` | 495 | `player_id` | Percentiles (0–100) calculados dentro del grupo posicional general (`Goalkeeper`, `Defender`, `Midfielder`, `Forward`) sobre cohorte calificada (`>= 450` minutos). |
| `player_season_role_percentiles` | 493 | `player_id` | Percentiles (0–100) calculados dentro del rol táctico específico (`Centre Back`, `Full Back`, `Defensive Mid`, `Central Mid`, `Attacking Mid`, `Forward`, `Goalkeeper`) sobre cohorte calificada (`MIN_QUALIFIED_MINUTES = 450`) con tamaño de cohorte (`cohort_size`). |
| `role_metric_quality` | 153 | `(role_group, metric)` | Diagnóstico de calidad estadística por rol y métrica (`cohort_size`, `zero_share`, `tie_share`, `low_confidence`). |
| `position_role_map` | 37 | `(code, position_group)` | Diccionario de mapeo entre códigos posicionales de partido (`CB`, `LB`, `CDM`, `CAM`, etc.) y roles tácticos. |
| `team_match_metrics` | 556 | `id` | 34 métricas tácticas por club y partido (temporada 2026: 278 partidos × 2 equipos), incluyendo `ppda`, `field_tilt_pct`, `deep_completions`, `box_entries`, `progressive_passes`, `xg`, `set_piece_xg`, altura media de bloque y fricción disciplinaria. |
| `match_period_stats` | 1,668 | `(match_id, team_id, period)` | Estadísticas colectivas por tramo (`ALL`, `1ST`, `2ND`): posesión, córners, faltas, tarjetas, tiros, pases y duelos. |
| `flashscore_match_team_stats` | 802 | `id` | Bloques de estadísticas detalladas de equipo por periodo (`1T`, `2T`, `ALL`) sincronizados desde Flashscore (`xg`, `xgot`, `xa`, `big_chances`, `touches_in_box`, `saves`, `goals_prevented`). |
| `match_goal_incidents` | 781 | `id` | Cronología de goles con `minute`, `period`, `incident_type` e indicador de origen en córner (`is_corner_origin`). |
| `match_card_incidents` | 650 | `id` | Tarjetas amarillas, segundas amarillas y rojas con minuto exacto (`minute`, `extra_minute`), motivo (`reason`) y jugador involucrado. |
| `match_substitution_incidents` | 1,234 | `id` | Sustituciones por partido (`player_in_id`, `player_out_id`, `minute`, `extra_minute`, `is_injury`). |

### 4. Vistas SQL y Tablas de Control

| Objeto | Tipo | Registros | Descripción |
| :--- | :---: | ---: | :--- |
| `vw_team_metrics` | `VIEW` | 18 | Vista agregada para los 18 clubes activos de la temporada 2026 con métricas totales, promedios por 90 minutos y diferenciales (`xg`, `xga`, `ppda`, `field_tilt_pct`). |
| `player_role_groups` | `VIEW` | 891 | Clasificación automática del rol táctico principal de cada jugador según minutos acumulados por posición (`classified_minutes >= 180` en SQL; las cohortes de percentiles de rol exigen `450` minutos). |
| `vw_fuerza_ataque_xg90` | `VIEW` | 399 | Vista SQL auxiliar de producción ofensiva por 90 minutos (`xG90`); para cohortes de percentiles y rankings en API el umbral estándar es `450` minutos. |
| `schema_version` | `TABLE` | 24 | Control secuencial de migraciones SQL aplicadas (`001` a `024`). |
| `scrape_log` | `TABLE` | 18,104 | Bitácora de auditoría y caché de peticiones de ingesta (`resource_type`, `resource_key`, `status`, `scraped_at`). |
| `player_market_values` | `TABLE` | 0 | Esquema reservado para valores de mercado de Transfermarkt. |
| `transfer_history` | `TABLE` | 0 | Esquema reservado para historial de transferencias. |
| `player_heatmap` | `TABLE` | 0 | Tabla legada sustituida por `player_heatmaps`. |
