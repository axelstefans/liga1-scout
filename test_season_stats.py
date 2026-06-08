import LanusStats as ls
import json

ss = ls.SofaScore()
# Try with specific fields parameter
data = ss.sofascore_request(
    'api/v1/unique-tournament/406/season/88529/statistics?limit=1&offset=0&order=-rating&accumulation=total&fields=goals%2Cassists%2Crating%2CminutesPlayed%2Cappearances'
)
if data.get('results'):
    print(json.dumps(data['results'][0], indent=2))
else:
    print(json.dumps(data, indent=2))