# scraper/sources/formation_parser.py

FORMATIONS_MAP = {
    "4-2-3-1": ["GK", "RB", "RCB", "LCB", "LB", "RDM", "LDM", "RAM", "CAM", "LAM", "ST"],
    "4-3-3":   ["GK", "RB", "RCB", "LCB", "LB", "RCM", "CDM", "LCM", "RW", "ST", "LW"],
    "4-4-2":   ["GK", "RB", "RCB", "LCB", "LB", "RM", "RCM", "LCM", "LM", "RS", "LS"],
    "3-5-2":   ["GK", "RCB", "CB", "LCB", "RWB", "RCM", "CDM", "LCM", "LWB", "RS", "LS"],
    "3-4-3":   ["GK", "RCB", "CB", "LCB", "RM", "RCM", "LCM", "LM", "RW", "ST", "LW"],
    "5-3-2":   ["GK", "RWB", "RCB", "CB", "LCB", "LWB", "RCM", "CDM", "LCM", "RS", "LS"],
    "4-1-4-1": ["GK", "RB", "RCB", "LCB", "LB", "CDM", "RM", "RCM", "LCM", "LM", "ST"],
    "4-4-1-1": ["GK", "RB", "RCB", "LCB", "LB", "RM", "RCM", "LCM", "LM", "CAM", "ST"],
    "3-4-2-1": ["GK", "RCB", "CB", "LCB", "RM", "RCM", "LCM", "LM", "RAM", "LAM", "ST"],
    "4-3-1-2": ["GK", "RB", "RCB", "LCB", "LB", "RCM", "CDM", "LCM", "CAM", "RS", "LS"],
}

def get_tactical_position(player_index: int, formation: str, is_substitute: bool, default_position: str) -> str:
    if is_substitute:
        return default_position
        
    if formation in FORMATIONS_MAP and player_index < 11:
        return FORMATIONS_MAP[formation][player_index]
        
    return default_position