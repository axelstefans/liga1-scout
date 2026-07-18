import sqlite3
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from xgboost import XGBClassifier
from sklearn.metrics import roc_auc_score
from sklearn.preprocessing import StandardScaler

print("🏟️ Iniciando el Gran Torneo de Algoritmos (Walk-Forward Validation)...")

# 1. Conexión y Extracción
conn = sqlite3.connect('liga1.db')
query = """
    SELECT season_id, distance_m, angle_rad, body_part, situation, shot_type 
    FROM player_shots
"""
df = pd.read_sql_query(query, conn)
conn.close()

# 2. Preprocesamiento (Idéntico a tu modelo actual)
df_open_play = df[df['situation'] != 'penalty'].copy()

def group_situation(sit):
    if sit == 'fast-break': return 'regular'
    elif sit == 'throw-in-set-piece': return 'set-piece'
    return sit

df_open_play['situation_grouped'] = df_open_play['situation'].apply(group_situation)
df_open_play['is_goal'] = (df_open_play['shot_type'] == 'goal').astype(int)

features_df = df_open_play[['season_id', 'distance_m', 'angle_rad', 'body_part', 'situation_grouped']]
X_full = pd.get_dummies(features_df, columns=['body_part', 'situation_grouped'], drop_first=True)
y_full = df_open_play['is_goal']

# 3. Walk-Forward Split
train_mask = X_full['season_id'].isin([48078, 57741, 70962])
test_mask = X_full['season_id'] == 88529

X_train = X_full[train_mask].drop('season_id', axis=1)
y_train = y_full[train_mask]
X_test = X_full[test_mask].drop('season_id', axis=1)
y_test = y_full[test_mask]

# Verificación de seguridad
assert list(X_test.columns) == list(X_train.columns), "Error: Columnas desalineadas"

# 4. Escalado
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

print(f"📊 Dataset: Train={len(X_train)} tiros | Test={len(X_test)} tiros\n")

# 5. Configuración de los Contendientes
models = {
    "Regresión Logística": LogisticRegression(max_iter=1000, random_state=42),
    "Random Forest": RandomForestClassifier(n_estimators=300, max_depth=5, random_state=42, n_jobs=-1),
    "XGBoost": XGBClassifier(n_estimators=300, max_depth=3, learning_rate=0.05, random_state=42, n_jobs=-1, eval_metric='logloss')
}

print("-" * 50)
print(f"{'ALGORITMO':<25} | {'AUC-ROC SCORE'}")
print("-" * 50)

# 6. La Batalla
for name, model in models.items():
    # Entrenar
    model.fit(X_train_scaled, y_train)
    
    # Predecir
    y_pred_proba = model.predict_proba(X_test_scaled)[:, 1]
    
    # Evaluar
    auc = roc_auc_score(y_test, y_pred_proba)
    
    # Medallas
    if auc >= 0.81:
        icon = "👑 (Ruptura de barrera!)"
    elif auc >= 0.80:
        icon = "🔥 (Nivel de Élite)"
    else:
        icon = "✅ (Sólido)"
        
    print(f"{name:<25} | {auc:.4f} {icon}")

print("-" * 50)
print("🏁 Torneo finalizado.")