"""
Canonical team identity mapping between Flashscore and internal database.

Flashscore team IDs are permanent canonical hashes (e.g., Alianza Lima = 'tSWpiWmI').
Includes the complete mappings for all 18 active Liga 1 clubs.
"""

import sqlite3
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# Complete Liga 1 team mappings (all 18 active clubs) with canonical Flashscore hashes
KNOWN_FLASHSCORE_TEAMS: Dict[str, Dict[str, Any]] = {
    # 1. Alianza Lima
    "tSWpiWmI": {
        "team_id": 2311,
        "name": "Alianza Lima",
        "short_name": "Alianza Lima",
        "slug": "alianza-lima",
        "aliases": ["Alianza Lima", "Alianza"],
    },
    # 2. Cusco FC
    "zDuHd68m": {
        "team_id": 63760,
        "name": "Cusco FC",
        "short_name": "Cusco",
        "slug": "cusco-fc",
        "aliases": ["Cusco FC", "Cusco", "Real Garcilaso"],
    },
    # 3. Asociación Deportiva Tarma (ADT)
    "EsfgJz9N": {
        "team_id": 335557,
        "name": "Asociación Deportiva Tarma",
        "short_name": "ADT",
        "slug": "asociacion-deportiva-tarma",
        "aliases": ["Asociación Deportiva Tarma", "ADT", "AD Tarma", "Tarma"],
    },
    # 4. Universitario de Deportes
    "xhw3JTnU": {
        "team_id": 2305,
        "name": "Universitario de Deportes",
        "short_name": "Universitario",
        "slug": "universitario",
        "aliases": ["Universitario de Deportes", "Universitario", "la U"],
    },
    # 5. ACD Juan Pablo II
    "bXJtZt18": {
        "team_id": 511206,
        "name": "ACD Juan Pablo II",
        "short_name": "Juan Pablo II",
        "slug": "adc-juan-pablo-ii",
        "aliases": ["ACD Juan Pablo II", "Juan Pablo II", "Juan Pablo II College", "ADC Juan Pablo II"],
    },
    # 6. Club Sporting Cristal
    "rVwaK9XN": {
        "team_id": 2302,
        "name": "Club Sporting Cristal",
        "short_name": "Sporting Cristal",
        "slug": "club-sporting-cristal",
        "aliases": ["Club Sporting Cristal", "Sporting Cristal", "Cristal"],
    },
    # 7. Deportivo Garcilaso
    "pQ8DJXPR": {
        "team_id": 458584,
        "name": "Deportivo Garcilaso",
        "short_name": "Garcilaso",
        "slug": "deportivo-garcilaso",
        "aliases": ["Deportivo Garcilaso", "Garcilaso"],
    },
    # 8. Alianza Atlético de Sullana
    "GlLFjAIU": {
        "team_id": 2307,
        "name": "Alianza Atlético de Sullana",
        "short_name": "Alianza Atlético",
        "slug": "alianza-atletico-de-sullana",
        "aliases": ["Alianza Atlético de Sullana", "Alianza Atlético", "Alianza Atletico", "Sullana"],
    },
    # 9. Sport Huancayo
    "hEX4iScl": {
        "team_id": 33895,
        "name": "Sport Huancayo",
        "short_name": "Sport Huancayo",
        "slug": "sport-huancayo",
        "aliases": ["Sport Huancayo", "Huancayo"],
    },
    # 10. Melgar / FBC Melgar
    "IZO9NXIh": {
        "team_id": 2308,
        "name": "Melgar",
        "short_name": "Melgar",
        "slug": "melgar",
        "aliases": ["Melgar", "FBC Melgar"],
    },
    # 11. Sport Boys
    "URZfLkIH": {
        "team_id": 2312,
        "name": "Sport Boys",
        "short_name": "Sport Boys",
        "slug": "sport-boys",
        "aliases": ["Sport Boys", "Sport Boys Association", "Boys"],
    },
    # 12. Club Atlético Grau
    "6o4srhvP": {
        "team_id": 282538,
        "name": "Club Atlético Grau",
        "short_name": "Atlético Grau",
        "slug": "club-atletico-grau",
        "aliases": ["Club Atlético Grau", "Atlético Grau", "Atletico Grau", "Grau"],
    },
    # 13. Cienciano
    "82OXAD3n": {
        "team_id": 2301,
        "name": "Cienciano",
        "short_name": "Cienciano",
        "slug": "cienciano",
        "aliases": ["Cienciano", "Club Cienciano"],
    },
    # 14. FC Cajamarca
    "0EDzFnkQ": {
        "team_id": 1082002,
        "name": "FC Cajamarca",
        "short_name": "Cajamarca",
        "slug": "fc-cajamarca",
        "aliases": ["FC Cajamarca", "Cajamarca", "Club FC Cajamarca"],
    },
    # 15. Comerciantes Unidos
    "ABEwYY2S": {
        "team_id": 213609,
        "name": "Comerciantes Unidos",
        "short_name": "Comerciantes Unidos",
        "slug": "comerciantes-unidos",
        "aliases": ["Comerciantes Unidos", "Comerciantes"],
    },
    # 16. Los Chankas CYC
    "hfMxvE6a": {
        "team_id": 252254,
        "name": "Los Chankas CYC",
        "short_name": "Los Chankas",
        "slug": "los-chankas-cyc",
        "aliases": ["Los Chankas CYC", "Los Chankas", "Chankas CYC", "Chankas"],
    },
    # 17. CD Moquegua / San Antonio Moquegua
    "OtSVKjtb": {
        "team_id": 492848,
        "name": "CD Moquegua",
        "short_name": "Moquegua",
        "slug": "ucv-de-moquegua",
        "aliases": ["CD Moquegua", "Moquegua", "San Antonio Moquegua", "UCV de Moquegua", "UCV Moquegua"],
    },
    # 18. Universidad Técnica de Cajamarca (UTC)
    "6cko2SpQ": {
        "team_id": 87854,
        "name": "Universidad Técnica de Cajamarca",
        "short_name": "UTC",
        "slug": "universidad-tecnica-de-cajamarca",
        "aliases": ["Universidad Técnica de Cajamarca", "UTC", "UTC de Cajamarca", "Universidad Tecnica de Cajamarca"],
    },
}

# Fast lookup mappings
FLASHSCORE_TO_TEAM_ID: Dict[str, int] = {
    fs_id: data["team_id"]
    for fs_id, data in KNOWN_FLASHSCORE_TEAMS.items()
    if "team_id" in data and data["team_id"] is not None
}

TEAM_ID_TO_FLASHSCORE: Dict[int, str] = {
    data["team_id"]: fs_id
    for fs_id, data in KNOWN_FLASHSCORE_TEAMS.items()
    if "team_id" in data and data["team_id"] is not None
}


def seed_flashscore_team_mappings(conn: sqlite3.Connection) -> int:
    """
    Populates teams.flashscore_id based on KNOWN_FLASHSCORE_TEAMS.
    Matches by team_id first, then fallback to slug, name, short_name, or aliases.

    Args:
        conn: SQLite connection to database.

    Returns:
        Number of teams updated.
    """
    cursor = conn.cursor()
    updated_total = 0

    for fs_id, info in KNOWN_FLASHSCORE_TEAMS.items():
        team_id = info.get("team_id")
        name = info.get("name")
        short_name = info.get("short_name")
        slug = info.get("slug")
        aliases = info.get("aliases", [])

        # 1. Try matching by exact team_id
        if team_id is not None:
            cursor.execute(
                "UPDATE teams SET flashscore_id = ? WHERE team_id = ?",
                (fs_id, team_id),
            )
            if cursor.rowcount > 0:
                updated_total += cursor.rowcount
                continue

        # 2. Try matching by slug
        if slug:
            cursor.execute(
                "UPDATE teams SET flashscore_id = ? WHERE slug IS NOT NULL AND LOWER(slug) = LOWER(?)",
                (fs_id, slug),
            )
            if cursor.rowcount > 0:
                updated_total += cursor.rowcount
                continue

        # 3. Try matching by name or short_name
        cursor.execute(
            """
            UPDATE teams
            SET flashscore_id = ?
            WHERE (name IS NOT NULL AND LOWER(name) = LOWER(?))
               OR (short_name IS NOT NULL AND LOWER(short_name) = LOWER(?))
            """,
            (fs_id, name or "", short_name or ""),
        )
        if cursor.rowcount > 0:
            updated_total += cursor.rowcount
            continue

        # 4. Try aliases
        for alias in aliases:
            cursor.execute(
                """
                UPDATE teams
                SET flashscore_id = ?
                WHERE (name IS NOT NULL AND (LOWER(name) = LOWER(?) OR LOWER(name) LIKE ?))
                   OR (short_name IS NOT NULL AND (LOWER(short_name) = LOWER(?) OR LOWER(short_name) LIKE ?))
                """,
                (fs_id, alias, f"%{alias.lower()}%", alias, f"%{alias.lower()}%"),
            )
            if cursor.rowcount > 0:
                updated_total += cursor.rowcount
                break

    conn.commit()
    logger.info(f"Seeded flashscore_id for {updated_total} teams in database.")
    return updated_total


def get_flashscore_team_mapping(conn: Optional[sqlite3.Connection] = None) -> Dict[str, int]:
    """
    Returns a dictionary mapping flashscore_team_id -> internal team_id.
    Reads from teams table when conn is supplied, combined with fallback KNOWN_FLASHSCORE_TEAMS.

    Args:
        conn: Optional SQLite connection.

    Returns:
        Dict mapping string Flashscore team hash to integer team_id.
    """
    mapping: Dict[str, int] = dict(FLASHSCORE_TO_TEAM_ID)

    if conn is not None:
        try:
            cursor = conn.cursor()
            rows = cursor.execute(
                "SELECT flashscore_id, team_id FROM teams WHERE flashscore_id IS NOT NULL"
            ).fetchall()
            for row in rows:
                fs_id = row[0]
                t_id = row[1]
                if fs_id and t_id:
                    mapping[str(fs_id)] = int(t_id)
        except sqlite3.OperationalError as e:
            logger.debug(f"Could not read flashscore_id from teams table: {e}")

    return mapping
