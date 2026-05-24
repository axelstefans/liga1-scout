import os
from dotenv import load_dotenv

load_dotenv()

# ── SofaScore identifiers ─────────────────────────────────────────────────────
LEAGUE_ID  = 406      # Liga 1 Peruana
SEASON_ID  = 88529    # 2025 season

# ── Database ──────────────────────────────────────────────────────────────────
DB_PATH    = os.getenv("DB_PATH", "liga1.db")

# ── Scraping behaviour ────────────────────────────────────────────────────────
HEADLESS            = os.getenv("HEADLESS", "true").lower() == "true"
MIN_DELAY_SECONDS   = 2.0   # minimum pause between JSON API calls
MAX_DELAY_SECONDS   = 5.0   # maximum pause between JSON API calls
MAX_RETRIES         = 3     # retries on 429/503

# ── SofaScore JSON API ────────────────────────────────────────────────────────
SOFASCORE_API_BASE  = "https://api.sofascore.com/api/v1"
SOFASCORE_HEADERS   = {
    "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                       "AppleWebKit/537.36 (KHTML, like Gecko) "
                       "Chrome/120.0.0.0 Safari/537.36",
    "Accept":          "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer":         "https://www.sofascore.com/",
    "Origin":          "https://www.sofascore.com",
}

# ── Transfermarkt team ID mapping ─────────────────────────────────────────────
# Keys: SofaScore team ID (to be discovered dynamically in teams pipeline) 
# Wait, the pipeline discovers SofaScore IDs and we need to map them to TM IDs.
# But SofaScore IDs are dynamically fetched. We need a way to map them based on slug/name.
# Let's map by Transfermarkt team name slug -> TM ID for now, and the pipeline can attempt to match.
# Actually, the user provided just the TM slug and TM ID.
# Let's define the TM map as slug -> ID.
TM_TEAM_MAP: dict[str, int] = {
    "alianza-lima": 2311,
    "los-chankas-cyc": 252254,
    "cienciano": 2301,
    "universitario": 2305,
    "melgar": 2308,
    "deportivo-garcilaso": 458584,
    "cusco-fc": 63760,
    "alianza-atletico-de-sullana": 2307,
    "asociacion-deportiva-tarma": 335557,
    "comerciantes-unidos": 213609,
    "ucv-de-moquegua": 492848,
    "club-sporting-cristal": 2302,
    "universidad-tecnica-de-cajamarca": 87854,
    "sport-boys": 2312,
    "adc-juan-pablo-ii": 511206,
    "fc-cajamarca": 1082002,
    "sport-huancayo": 33895,
    "club-atletico-grau": 282538,
}

# ── Position mapping ──────────────────────────────────────────────────────────
POSITION_GROUP_MAP = {
    "G": "Goalkeeper",
    "D": "Defender",
    "M": "Midfielder",
    "F": "Forward",
}
