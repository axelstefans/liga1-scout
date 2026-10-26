# scraper/sources/formation_parser.py
from typing import Dict, Any, List, Optional, Tuple

FORMATIONS_MAP = {
    # Líneas de 4 defensores
    "4-2-3-1": ["GK", "RB", "RCB", "LCB", "LB", "RDM", "LDM", "RAM", "CAM", "LAM", "ST"],
    "4-3-3":   ["GK", "RB", "RCB", "LCB", "LB", "RCM", "CDM", "LCM", "RW", "ST", "LW"],
    "4-4-2":   ["GK", "RB", "RCB", "LCB", "LB", "RM", "RCM", "LCM", "LM", "RS", "LS"],
    "4-1-4-1": ["GK", "RB", "RCB", "LCB", "LB", "CDM", "RM", "RCM", "LCM", "LM", "ST"],
    "4-4-1-1": ["GK", "RB", "RCB", "LCB", "LB", "RM", "RCM", "LCM", "LM", "CAM", "ST"],
    "4-3-1-2": ["GK", "RB", "RCB", "LCB", "LB", "RCM", "CDM", "LCM", "CAM", "RS", "LS"],
    "4-2-2-2": ["GK", "RB", "RCB", "LCB", "LB", "RDM", "LDM", "RAM", "LAM", "RS", "LS"],
    "4-1-3-2": ["GK", "RB", "RCB", "LCB", "LB", "CDM", "RM", "CAM", "LM", "RS", "LS"],
    "4-3-2-1": ["GK", "RB", "RCB", "LCB", "LB", "RCM", "CDM", "LCM", "RAM", "LAM", "ST"],

    # Líneas de 3 y 5 defensores
    "3-5-2":   ["GK", "RCB", "CB", "LCB", "RWB", "RCM", "CDM", "LCM", "LWB", "RS", "LS"],
    "3-1-4-2": ["GK", "RCB", "CB", "LCB", "CDM", "RWB", "RCM", "LCM", "LWB", "RS", "LS"],
    "3-4-1-2": ["GK", "RCB", "CB", "LCB", "RWB", "RCM", "LCM", "LWB", "CAM", "RS", "LS"],
    "3-4-3":   ["GK", "RCB", "CB", "LCB", "RM", "RCM", "LCM", "LM", "RW", "ST", "LW"],
    "3-4-2-1": ["GK", "RCB", "CB", "LCB", "RM", "RCM", "LCM", "LM", "RAM", "LAM", "ST"],
    "5-3-2":   ["GK", "RWB", "RCB", "CB", "LCB", "LWB", "RCM", "CDM", "LCM", "RS", "LS"],
    "5-1-2-2": ["GK", "RWB", "RCB", "CB", "LCB", "LWB", "CDM", "RCM", "LCM", "RS", "LS"],
    "5-4-1":   ["GK", "RWB", "RCB", "CB", "LCB", "LWB", "RM", "RCM", "LCM", "LM", "ST"],
    "5-2-3":   ["GK", "RWB", "RCB", "CB", "LCB", "LWB", "RCM", "LCM", "RW", "ST", "LW"],
}

def get_tactical_position(
    player_index: int, 
    formation: str, 
    is_substitute: bool, 
    default_position: str,
    player_id: Optional[int] = None,
    substitutions_map: Optional[Dict[int, str]] = None
) -> str:
    if is_substitute:
        if substitutions_map and player_id and player_id in substitutions_map:
            inferred_pos = substitutions_map[player_id]
            if inferred_pos and inferred_pos not in ('G', 'D', 'M', 'F', 'Unknown'):
                return inferred_pos
        return default_position
        
    if formation in FORMATIONS_MAP and player_index < 11:
        return FORMATIONS_MAP[formation][player_index]
        
    return default_position


def build_substitutions_position_map(
    incidents: List[Dict[str, Any]], 
    starting_tactical_positions: Dict[int, str]
) -> Tuple[Dict[int, str], Dict[int, int], Dict[int, str]]:
    """
    Procesa incidentes de sustitución y construye el linaje táctico:
    Retorna (inferred_positions, replaced_player_ids, position_sources).
    Cubre cadenas de sustituciones cronológicas y marcas fallback.
    """
    active_positions = dict(starting_tactical_positions)
    inferred_pos_map: Dict[int, str] = {}
    replaced_id_map: Dict[int, int] = {}
    source_map: Dict[int, str] = {}

    sub_events = [
        inc for inc in incidents 
        if inc.get("incidentType") == "substitution"
    ]
    sub_events.sort(key=lambda x: (x.get("time", 0), x.get("addedTime", 0)))

    for event in sub_events:
        p_in = event.get("playerIn", {})
        p_out = event.get("playerOut", {})
        in_id = p_in.get("id")
        out_id = p_out.get("id")

        if not in_id:
            continue

        if out_id:
            replaced_id_map[in_id] = out_id

        parent_pos = active_positions.get(out_id)
        if parent_pos and parent_pos not in ('G', 'D', 'M', 'F', 'Unknown'):
            inferred_pos_map[in_id] = parent_pos
            source_map[in_id] = "sub_incident"
            active_positions[in_id] = parent_pos
        else:
            source_map[in_id] = "fallback"

    return inferred_pos_map, replaced_id_map, source_map
