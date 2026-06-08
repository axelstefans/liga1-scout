import LanusStats as ls
import json

ss = ls.SofaScore()
# Usa un partido conocido de Liga 1
home_df, away_df = ss.get_players_match_stats(
    "https://www.sofascore.com/universitario-de-deportes-alianza-lima/fb#id:15362077"
)
print("Columnas disponibles:")
print(list(home_df.columns))
print("\nPrimer jugador:")
print(home_df.iloc[0].to_dict())