import json

with open("tools/raw_stats_sample.json", "r", encoding="utf-8") as f:
    raw_data = json.load(f)

def find_stats_entries(obj):
    """Busca recursivamente cualquier lista que contenga registros con typeId."""
    if isinstance(obj, list):
        if len(obj) > 0 and isinstance(obj[0], dict) and "typeId" in obj[0]:
            return obj
        for item in obj:
            res = find_stats_entries(item)
            if res:
                return res
    elif isinstance(obj, dict):
        for v in obj.values():
            res = find_stats_entries(v)
            if res:
                return res
    return None

entries = find_stats_entries(raw_data)

if not entries:
    print("Estructura principal del JSON recibido:")
    if isinstance(raw_data, dict):
        print(f"Claves raíz: {list(raw_data.keys())}")
        for k, v in raw_data.items():
            if isinstance(v, dict):
                print(f"  Claves de '{k}': {list(v.keys())}")
    else:
        print(f"Tipo raíz: {type(raw_data)}")
    exit()

print(f"✓ Se encontraron {len(entries)} registros de estadísticas.\n")

catalog = {}
for item in entries:
    tid = item.get("typeId")
    stage = item.get("eventStageId")
    val = item.get("value")
    raw_val = item.get("rawValue")
    team = item.get("teamId")

    if tid not in catalog:
        catalog[tid] = {
            "val": val,
            "raw": raw_val,
            "stages": set(),
            "teams": set()
        }
    catalog[tid]["stages"].add(stage)
    catalog[tid]["teams"].add(team)

print(f"{'MÉTRICA (typeId)'.ljust(35)} | {'VALOR'.ljust(8)} | {'RAW'.ljust(10)} | {'STAGES'}")
print("-" * 75)
for tid, info in sorted(catalog.items()):
    val_str = str(info['val'])
    raw_str = str(info['raw']) if info['raw'] is not None else "None"
    print(f"{tid.ljust(35)} | {val_str.ljust(8)} | {raw_str.ljust(10)} | {sorted(list(info['stages']))}")