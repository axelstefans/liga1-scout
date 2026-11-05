"""
Módulo desacoplado de sedes y estadios para Liga 1.
Fuente: dato estático, verificado manualmente por fecha para Liga 1 2026.
"""

from typing import Dict, Any, Optional

STADIUMS_VERSION = "2026.1"

STADIUMS_BY_TEAM_ID: Dict[int, Dict[str, Any]] = {
    2301: {
        "stadium": "Estadio Inca Garcilaso de la Vega",
        "city": "Cusco",
        "altitude": 3399,
        "surface": "Césped Natural",
    },
    2302: {
        "stadium": "Estadio Alberto Gallardo",
        "city": "Lima",
        "altitude": 150,
        "surface": "Césped Natural",
    },
    2305: {
        "stadium": "Estadio Monumental 'U' Marathon",
        "city": "Lima",
        "altitude": 250,
        "surface": "Césped Natural",
    },
    2307: {
        "stadium": "Estadio Campeones del 36",
        "city": "Sullana",
        "altitude": 60,
        "surface": "Césped Natural",
    },
    2308: {
        "stadium": "Estadio Monumental de la UNSA",
        "city": "Arequipa",
        "altitude": 2335,
        "surface": "Césped Natural",
    },
    2311: {
        "stadium": "Estadio Alejandro Villanueva",
        "city": "Lima",
        "altitude": 150,
        "surface": "Césped Natural",
    },
    2312: {
        "stadium": "Estadio Miguel Grau",
        "city": "Callao",
        "altitude": 10,
        "surface": "Césped Natural",
    },
    33895: {
        "stadium": "Estadio IPD de Huancayo",
        "city": "Huancayo",
        "altitude": 3259,
        "surface": "Césped Natural",
    },
    63760: {
        "stadium": "Estadio Inca Garcilaso de la Vega",
        "city": "Cusco",
        "altitude": 3399,
        "surface": "Césped Natural",
    },
    87854: {
        "stadium": "Estadio Héroes de San Ramón",
        "city": "Cajamarca",
        "altitude": 2750,
        "surface": "Césped Sintético",
    },
    213609: {
        "stadium": "Estadio Juan Maldonado Gamarra",
        "city": "Cutervo",
        "altitude": 2650,
        "surface": "Césped Sintético",
    },
    252254: {
        "stadium": "Estadio Los Chankas",
        "city": "Andahuaylas",
        "altitude": 2926,
        "surface": "Césped Natural",
    },
    282538: {
        "stadium": "Estadio Campeones del 36",
        "city": "Sullana",
        "altitude": 30,
        "surface": "Césped Natural",
    },
    335557: {
        "stadium": "Estadio Unión Tarma",
        "city": "Tarma",
        "altitude": 3053,
        "surface": "Césped Sintético",
    },
    458584: {
        "stadium": "Estadio Inca Garcilaso de la Vega",
        "city": "Cusco",
        "altitude": 3399,
        "surface": "Césped Natural",
    },
    492848: {
        "stadium": "Estadio 25 de Noviembre",
        "city": "Moquegua",
        "altitude": 1410,
        "surface": "Césped Natural",
    },
    511206: {
        "stadium": "Estadio Municipal de la Juventud",
        "city": "Chongoyape",
        "altitude": 200,
        "surface": "Césped Natural",
    },
    1082002: {
        "stadium": "Estadio Héroes de San Ramón",
        "city": "Cajamarca",
        "altitude": 2750,
        "surface": "Césped Sintético",
    },
}


def get_stadium_info(team_id: Optional[int]) -> Dict[str, Any]:
    """
    Retorna la información estática del estadio para un team_id dado.
    Si el team_id no existe o es None, retorna todos los valores en None.
    """
    if team_id is None or team_id not in STADIUMS_BY_TEAM_ID:
        return {
            "stadium": None,
            "city": None,
            "altitude": None,
            "surface": None,
        }
    return dict(STADIUMS_BY_TEAM_ID[team_id])
