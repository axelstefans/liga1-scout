# tests/test_formation_parser.py
import pytest
from scraper.sources.formation_parser import (
    FORMATIONS_MAP,
    get_tactical_position,
    build_substitutions_position_map,
)

def test_starter_tactical_positions_base_and_new():
    # Base
    assert get_tactical_position(0, "4-3-3", False, "G") == "GK"
    assert get_tactical_position(1, "4-3-3", False, "D") == "RB"
    assert get_tactical_position(4, "4-3-3", False, "D") == "LB"
    # Nuevas formaciones
    assert get_tactical_position(4, "3-1-4-2", False, "M") == "CDM"
    assert get_tactical_position(8, "3-1-4-2", False, "M") == "LWB"
    assert get_tactical_position(8, "3-4-1-2", False, "M") == "CAM"
    assert get_tactical_position(10, "5-4-1", False, "F") == "ST"
    assert get_tactical_position(1, "5-1-2-2", False, "D") == "RWB"
    assert get_tactical_position(5, "5-1-2-2", False, "D") == "LWB"
    assert get_tactical_position(6, "5-1-2-2", False, "M") == "CDM"

def test_substitution_simple_inheritance():
    starters = {101: "LB", 102: "CB"}
    incidents = [
        {
            "incidentType": "substitution",
            "time": 70,
            "playerIn": {"id": 201, "name": "Marco Huamán"},
            "playerOut": {"id": 101, "name": "Starter LeftBack"}
        }
    ]
    inferred, replaced, sources = build_substitutions_position_map(incidents, starters)
    assert inferred[201] == "LB"
    assert replaced[201] == 101
    assert sources[201] == "sub_incident"

def test_substitution_chain_inheritance():
    # A (titular LB) -> B (suplente 1) -> C (suplente 2)
    starters = {101: "LB"}
    incidents = [
        {"incidentType": "substitution", "time": 60, "playerIn": {"id": 201}, "playerOut": {"id": 101}},
        {"incidentType": "substitution", "time": 85, "playerIn": {"id": 301}, "playerOut": {"id": 201}}
    ]
    inferred, replaced, sources = build_substitutions_position_map(incidents, starters)
    assert inferred[201] == "LB"
    assert replaced[201] == 101
    assert inferred[301] == "LB"
    assert replaced[301] == 201
    assert sources[301] == "sub_incident"

def test_substitution_missing_incident_fallback():
    starters = {101: "LB"}
    inferred, replaced, sources = build_substitutions_position_map([], starters)
    # Suplente sin incidente registrado conserva sigla genérica
    assert get_tactical_position(12, "4-3-3", True, "D", player_id=999, substitutions_map=inferred) == "D"
    assert 999 not in inferred

def test_substitution_player_out_without_position():
    starters = {101: "D"} # Jugador saliente sin posición táctica específica
    incidents = [
        {"incidentType": "substitution", "time": 75, "playerIn": {"id": 201}, "playerOut": {"id": 101}}
    ]
    inferred, replaced, sources = build_substitutions_position_map(incidents, starters)
    assert 201 not in inferred
    assert sources[201] == "fallback"
