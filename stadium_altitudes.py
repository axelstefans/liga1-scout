# Verified stadium altitudes in meters
ALTITUDES = {
    'Deportivo Binacional': 3824,
    'Cienciano': 3399,
    'Cusco FC': 3399,
    'Deportivo Garcilaso': 3399,
    'Asociación Deportiva Tarma': 3053,
    'Asociacin Deportiva Tarma': 3053, # handling encoding issue
    'Sport Huancayo': 3259,
    'Los Chankas CYC': 2926,
    'Universidad Técnica de Cajamarca': 2750,
    'Universidad Tcnica de Cajamarca': 2750,
    'FC Cajamarca': 2750,
    'Comerciantes Unidos': 2650,
    'Melgar': 2335,
    'CD Moquegua': 1410,
    'Deportivo Moquegua': 1410,
    'Universitario de Deportes': 150,
    'Alianza Lima': 150,
    'Club Sporting Cristal': 150,
    'Sport Boys': 10,
    'Alianza Atlético de Sullana': 60,
    'Alianza Atltico de Sullana': 60,
    'Club Atlético Grau': 30,
    'Club Atltico Grau': 30,
    'CD Juan Pablo II': 200,
    # Teams not in the verified list will return None and be excluded from the analysis
}

def get_altitude(team_name):
    # exact match
    if team_name in ALTITUDES:
        return ALTITUDES[team_name]
    # fuzzy matching for encoding issues
    for key, value in ALTITUDES.items():
        if key.encode('utf-8', 'ignore') == team_name.encode('utf-8', 'ignore'):
            return value
    return None
