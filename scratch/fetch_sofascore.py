import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import json
import logging
from scraper.http_client import SofaScoreAPIClient

logging.basicConfig(level=logging.INFO)

event_id = 15362077
player_id = 975241

try:
    client = SofaScoreAPIClient()
    endpoint = f"api/v1/event/{event_id}/player/{player_id}/statistics"
    print(f"Fetching {endpoint}...")
    
    data = client._polite_get(endpoint)
    
    print("\n=== Keys in JSON response ===")
    print(list(data.keys()))
    
    if "statistics" in data:
        print("\n=== Statistics Dictionary ===")
        print(json.dumps(data["statistics"], indent=2))
    else:
        print("\n'statistics' key not found in response. Full response:")
        print(json.dumps(data, indent=2))
        
finally:
    try:
        client.close()
    except:
        pass
