import LanusStats as ls
ss = ls.SofaScore()
# Probar con año 2026
data = ss.get_player_season_heatmap('Peru Liga 1', '2026', 971200)
print(type(data))
print(len(data) if data is not None else 'None')
print(data.head() if data is not None and len(data) > 0 else 'Empty')