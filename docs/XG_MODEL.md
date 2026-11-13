# Modelo de Expected Goals (xG) — Trazabilidad y Validación

Este documento detalla la arquitectura, los datos de entrenamiento, la calibración, el flujo de sincronización en base de datos y las limitaciones del modelo de Expected Goals utilizado por **L1Scan** ([`xg_model_pipeline.pkl`](../xg_model_pipeline.pkl)).

---

## 1. Arquitectura del Pipeline (`xg_model_pipeline.pkl`)

El artefacto serializado con `joblib` contiene un `sklearn.pipeline.Pipeline` (`scikit-learn==1.9.0`, `xgboost==3.3.0`) con dos etapas:

1. **`preprocessor` (`ColumnTransformer`)**:
   - **`num` (`StandardScaler`)**: estandariza `distance_m` (`media = 19.507 m`, `σ = 9.345 m`) y `angle_rad` (`media = 0.421 rad`, `σ = 0.264 rad`).
   - **`cat` (`OneHotEncoder`)**: codifica las variables categóricas `body_part` y `situation_grouped`.
2. **`classifier` (`XGBClassifier`)**:
   - `objective="binary:logistic"`, `eval_metric="logloss"`
   - `n_estimators=300`, `max_depth=3`, `learning_rate=0.05`, `random_state=42`

### Ingeniería de Variables (4 atributos de evento)

Calculadas en `scraper/sources/shotmap.py:calculate_shot_features()` a partir de coordenadas normalizadas Opta/Sofascore (`0–100`) escaladas a campo reglamentario (`105 m × 68 m`) con portería objetivo en `(X = 0, Y = 34)` y ancho `7.32 m`:

- `distance_m`: $\sqrt{x_m^2 + (34 - y_m)^2}$
- `angle_rad`: $\operatorname{atan2}\left(7.32 \cdot x_m,\; x_m^2 + (34 - y_m)^2 - (7.32 / 2)^2\right)$
- `body_part`: `right-foot`, `left-foot`, `head`, `other`
- `situation_grouped`: mapea `fast-break` $\rightarrow$ `regular` y `throw-in-set-piece` $\rightarrow$ `set-piece`; preserva `assisted`, `regular`, `corner`, `set-piece`, `free-kick`, `penalty`.

---

## 2. Origen de los Datos de Entrenamiento

El escalador `StandardScaler` almacenado dentro de `xg_model_pipeline.pkl` registra `n_samples_seen_ = 18,920`, cifra que coincide exactamente con los tiros no penales extraídos hasta la fecha de creación del artefacto (`2026-07-18`):

```sql
SELECT COUNT(*) FROM player_shots
WHERE situation != 'penalty' AND scraped_at < '2026-07-19';
-- Resultado: 18,920
```

Por lo tanto:
- **Conjunto de entrenamiento (83% de los tiros sin penales)**: `18,920` de `22,784` remates sin penales, correspondientes a las temporadas **2023, 2024, 2025 y el tramo Apertura de 2026** (hasta el 18 de julio de 2026).
- **Validación posterior fuera de muestra (17%)**: `3,864` tiros sin penales capturados entre el **19 de julio y noviembre de 2026** (`scraped_at >= '2026-07-19'`).
- **Penales (constante fija de `0.79` xG definida en el pipeline)**: `358` lanzamientos registrados con `280` goles convertidos (**78.2%** de conversión histórica en la base).

---

## 3. Métricas de Validación Unificadas (`v1.0-pipeline`)

Los `23,142` tiros registrados en `player_shots_xg` están evaluados de forma homogénea bajo `model_version = 'v1.0-pipeline'` (`xg_model_pipeline.pkl` redondeado a 3 decimales para tiros de juego abierto/balón parado y `0.79` fijo para los `358` penales):

| Conjunto | Alcance | Tiros | Goles | Suma xG | ROC-AUC | Brier Score | Log Loss |
| :--- | :--- | ---: | ---: | ---: | :---: | :---: | :---: |
| **Entrenamiento (2023 – jul. 2026)** | Sin penales (`< 2026-07-19`) | 18,920 | 1,797 | 1,796.79 | 0.8123 | 0.0719 | 0.2513 |
| **Validación posterior (jul. – nov. 2026)** | Sin penales (`>= 2026-07-19`) | 3,864 | 349 | 366.57 | 0.7874 | 0.0729 | 0.2563 |
| **Total Histórico (sin penales)** | Todos los tiros sin penales | 22,784 | 2,146 | 2,163.35 | 0.8082 | 0.0721 | 0.2522 |
| **Entrenamiento (2023 – jul. 2026)** | Total con penales (`0.79` xG) | 19,218 | 2,030 | 2,032.21 | 0.8310 | 0.0735 | 0.2556 |
| **Validación posterior (jul. – nov. 2026)** | Total con penales (`0.79` xG) | 3,924 | 396 | 413.97 | 0.8099 | 0.0744 | 0.2604 |
| **Total Histórico (`player_shots_xg`)** | Todos los tiros (`v1.0-pipeline`) | 23,142 | 2,426 | 2,446.17 | 0.8275 | 0.0736 | 0.2564 |

---

## 4. Flujo Unificado de Cálculo y Consumo

1. **Cálculo en ingesta (`scraper/sources/shotmap.py:calculate_and_store_pending_xg()`)**:
   - Evalúa los tiros con `situation != 'penalty'` mediante `xg_model_pipeline.pkl` (`.round(3)`) y asigna `0.79` a `situation == 'penalty'`, insertando en `player_shots_xg` con `model_version = 'v1.0-pipeline'`.
2. **Sincronización integral (`scraper/sources/xg_aggregation.py:backfill_xg()`)**:
   - Recalcula `player_shots_xg` (`force_all=True`) y propaga los resultados hacia `player_match_stats.expected_goals`, `player_season_stats.expected_goals`, `team_match_metrics` (`recompute_all_team_metrics`) y las tablas de percentiles (`player_season_percentiles` y `player_season_role_percentiles`).
3. **Consumo en la API (`api/repositories/player_repo.py`, `team_repo.py`, `api/routers/matches.py`, `matches_sheet_03.py`)**:
   - Todas las vistas (Scouting de jugador, Análisis de club/liga y Reporte de partido) leen `player_shots_xg.calculated_xg`, garantizando que un mismo disparo tenga idéntico valor de xG en toda la plataforma.

---

## 5. Limitaciones y Seguridad

- **Limitaciones analíticas**: el modelo opera únicamente con 4 variables de evento; carece de coordenadas de portero y defensores (*freeze-frames*), altura del balón al momento del impacto, presión defensiva directa o tipo de pase asistido.
- **Compatibilidad de versiones**: la deserialización requiere `scikit-learn==1.9.0`, `xgboost==3.3.0` y `joblib` (fijados en `requirements.txt`).
- **Seguridad de `.pkl`**: el formato `pickle`/`joblib` puede ejecutar código arbitrario al cargarse. No reemplace `xg_model_pipeline.pkl` con archivos de procedencia no verificada.
