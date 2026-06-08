import LanusStats as ls
import json

MATCH_ID = 16147469

print(f"Buscando la estructura completa de alineaciones para el partido {MATCH_ID}...")

ss = ls.SofaScore()
data = ss.sofascore_request(f'api/v1/event/{MATCH_ID}/lineups')

if data:
    print("\n=== LLAVES PRINCIPALES DEL EVENTO ===")
    print(list(data.keys()))
    
    # Vamos a revisar qué información general tiene cada equipo
    for side in ['home', 'away']:
        if side in data:
            team_data = data[side]
            print(f"\n=== LLAVES DEL EQUIPO {side.upper()} ===")
            print(list(team_data.keys()))
            
            # Si hay una llave de formación (ej. 4-4-2), queremos verla
            if 'formation' in team_data:
                print(f"Formación táctica: {team_data['formation']}")
            
            # Vamos a ver si el array de jugadores trae algún dato de coordenadas para dibujar la alineación
            if 'players' in team_data and len(team_data['players']) > 0:
                print(f"\n=== EJEMPLO DE JUGADOR DEL EQUIPO {side.upper()} ===")
                # Filtramos las keys largas de estadísticas para ver solo las estructurales
                sample_player = team_data['players'][0]
                keys_to_show = {k: v for k, v in sample_player.items() if k != 'statistics'}
                print(json.dumps(keys_to_show, indent=2))
                break # Solo necesitamos ver la estructura de un jugador para entender el patrón
else:
    print("No se recibió información de la API.")