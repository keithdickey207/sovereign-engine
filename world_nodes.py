import json
import os
import time
import random

SHM_PATH = "/dev/shm/sovereign_world_nodes.json"

# The exact v5 node distribution your UI expects
DISTRIBUTION = {
    'neural': 214, 'city': 60, 'town': 64, 
    'defense_radar': 5, 'defense_bases': 17, 'defense_sam': 4, 
    'defense_naval': 10, 'defense_cyber': 3, 'defense_chokepoint': 5, 
    'defense_airport': 54
}

def generate_nodes():
    nodes = []
    node_id = 1
    # Area Code 207 Anchor / 04901
    base_lat = 44.55
    base_lon = -69.63
    
    for kind, count in DISTRIBUTION.items():
        for _ in range(count):
            # Scatter nodes across the regional grid
            lat = base_lat + random.uniform(-3.0, 3.0)
            lon = base_lon + random.uniform(-3.0, 3.0)
            nodes.append({
                "id": f"node_{node_id}",
                "kind": kind,
                "lat": round(lat, 4),
                "lon": round(lon, 4),
                "name": f"04901_{kind.upper()}_{node_id}",
                "status": "active"
            })
            node_id += 1
    return nodes

def main():
    print("==============================================")
    print("  04901 TACTICAL NODE GENERATOR (v6.1)")
    print("==============================================")
    
    while True:
        nodes = generate_nodes()
        
        # Write to RAM disk atomically to prevent UI tearing
        temp_path = SHM_PATH + ".tmp"
        with open(temp_path, 'w') as f:
            json.dump({"nodes": nodes}, f)
        os.rename(temp_path, SHM_PATH)
        
        # Log the heartbeat
        print(f"[WORLD_NODES] {len(nodes)} nodes · kinds={DISTRIBUTION} · learn={random.randint(600, 900)} → {SHM_PATH}")
        
        # Hold state for 10 seconds, then cycle
        time.sleep(10)

if __name__ == '__main__':
    main()
