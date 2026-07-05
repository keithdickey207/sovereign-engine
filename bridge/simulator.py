#!/usr/bin/env python3
"""Send sample telemetry to the Sovereign UDP ingest port."""

import argparse
import json
import random
import socket
import time

TYPES = ["gnss", "lidar", "rf"]


def main():
    parser = argparse.ArgumentParser(description="Sovereign telemetry simulator")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=2368)
    parser.add_argument("--count", type=int, default=50)
    parser.add_argument("--interval", type=float, default=0.1)
    args = parser.parse_args()

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

    for i in range(args.count):
        t = TYPES[i % len(TYPES)]
        if t == "gnss":
            payload = {
                "lat": 44.5520 + random.uniform(-0.0004, 0.0004),
                "lon": -69.6317 + random.uniform(-0.0004, 0.0004),
                "type": t,
                "sig": random.uniform(0.5, 1.0),
                "device": f"gnss-{i}",
            }
        else:
            payload = {
                "x": random.uniform(-120, 120),
                "y": random.uniform(-90, 90),
                "type": t,
                "sig": random.uniform(0.5, 1.0),
                "device": f"{t}-{i}",
            }

        sock.sendto(json.dumps(payload).encode(), (args.host, args.port))
        time.sleep(args.interval)

    sock.close()
    print(f"Sent {args.count} points to {args.host}:{args.port}")


if __name__ == "__main__":
    main()