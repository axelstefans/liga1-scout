import sqlite3
import pandas as pd
from api.services.poisson_service import calculate_match_odds, _legacy_obtener_metricas_equipo
import numpy as np
from scipy.stats import poisson

def main():
    conn = sqlite3.connect('liga1.db')
    
    query = """
        SELECT th.name as home, ta.name as away
        FROM matches m 
        JOIN teams th ON m.home_team_id = th.team_id 
        JOIN teams ta ON m.away_team_id = ta.team_id 
        WHERE m.season_id = 88529 
        LIMIT 3
    """
    matches = pd.read_sql_query(query, conn)
    
    print("| Match | OLD Lambda (H-A) | NEW Lambda (H-A) | OLD Prob (1-X-2) | NEW Prob (1-X-2) | OLD Over 2.5 | NEW Over 2.5 |")
    print("|---|---|---|---|---|---|---|")
    
    for _, row in matches.iterrows():
        home = row['home']
        away = row['away']
        
        # OLD LOGIC
        local_stats = _legacy_obtener_metricas_equipo(conn, home, is_home=True)
        visita_stats = _legacy_obtener_metricas_equipo(conn, away, is_home=False)
        old_lambda_home = (local_stats['xGF'] + visita_stats['xGA']) / 2
        old_lambda_away = (visita_stats['xGF'] + local_stats['xGA']) / 2
        
        max_goles = 6
        prob_matrix = np.zeros((max_goles, max_goles))
        for i in range(max_goles):
            for j in range(max_goles):
                prob_matrix[i][j] = poisson.pmf(i, old_lambda_home) * poisson.pmf(j, old_lambda_away)
        old_prob_local = np.sum(np.tril(prob_matrix, -1))
        old_prob_empate = np.sum(np.diag(prob_matrix))
        old_prob_visita = np.sum(np.triu(prob_matrix, 1))
        
        old_prob_over = 0
        for i in range(max_goles):
            for j in range(max_goles):
                if (i + j) > 2.5:
                    old_prob_over += prob_matrix[i][j]
                    
        # NEW LOGIC
        new_result = calculate_match_odds(conn, home, away)
        new_lambda_home = new_result['projected_goals']['home']
        new_lambda_away = new_result['projected_goals']['away']
        new_prob_local = new_result['probabilities_percent']['home'] / 100
        new_prob_empate = new_result['probabilities_percent']['draw'] / 100
        new_prob_visita = new_result['probabilities_percent']['away'] / 100
        new_prob_over = new_result['probabilities_percent']['over_25'] / 100
        
        old_lambdas_str = f"{old_lambda_home:.2f} - {old_lambda_away:.2f}"
        new_lambdas_str = f"{new_lambda_home:.2f} - {new_lambda_away:.2f}"
        
        old_probs_str = f"{old_prob_local*100:.1f}% / {old_prob_empate*100:.1f}% / {old_prob_visita*100:.1f}%"
        new_probs_str = f"{new_prob_local*100:.1f}% / {new_prob_empate*100:.1f}% / {new_prob_visita*100:.1f}%"
        
        old_over_str = f"{old_prob_over*100:.1f}%"
        new_over_str = f"{new_prob_over*100:.1f}%"
        
        print(f"| {home} vs {away} | {old_lambdas_str} | {new_lambdas_str} | {old_probs_str} | {new_probs_str} | {old_over_str} | {new_over_str} |")

if __name__ == '__main__':
    main()
