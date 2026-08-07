import sqlite3
import json
import importlib.util
import os

import os

# Load new module
from api.services.poisson_service import calculate_match_odds as calc_new

# Load old module
from api.services.poisson_service_before_altitude_temp import calculate_match_odds as calc_old

def test_match(conn, home, away):
    print(f"=== {home} vs {away} ===")
    
    old_res = calc_old(conn, home, away, target_date="2026-12-31")
    new_res = calc_new(conn, home, away, target_date="2026-12-31")
    
    old_probs = old_res['probabilities_percent']
    new_probs = new_res['probabilities_percent']
    
    old_sum = old_probs['home'] + old_probs['draw'] + old_probs['away']
    new_sum = new_probs['home'] + new_probs['draw'] + new_probs['away']
    
    print(f"BEFORE: Home: {old_probs['home']:5.1f}% | Draw: {old_probs['draw']:5.1f}% | Away: {old_probs['away']:5.1f}% (Sum: {old_sum:.1f}%)")
    print(f"AFTER:  Home: {new_probs['home']:5.1f}% | Draw: {new_probs['draw']:5.1f}% | Away: {new_probs['away']:5.1f}% (Sum: {new_sum:.1f}%)")
    print("")

def main():
    conn = sqlite3.connect('liga1.db')
    
    matches = [
        ("CD Juan Pablo II", "FC Cajamarca"), # Small alt diff
        ("Sport Huancayo", "Alianza Lima"), # High alt diff
        ("Deportivo Garcilaso", "Club Sporting Cristal"), # Cusco vs Lima
        ("Universitario", "Alianza Lima") # Lima vs Lima
    ]
    
    for h, a in matches:
        test_match(conn, h, a)
        
if __name__ == "__main__":
    main()
