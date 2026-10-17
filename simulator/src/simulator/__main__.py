from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

from .packets import generate_vitals

ROOT = Path(__file__).resolve().parents[3]
load_dotenv(ROOT / ".env")

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:4000")
INTERVAL_MS = int(os.getenv("SIMULATOR_INTERVAL_MS", "2000"))
PATIENT_ID = os.getenv("PATIENT_ID", "pt_001")


def main() -> int:
    print(f"CareConnect simulator -> {BACKEND_URL}/vitals every {INTERVAL_MS}ms")
    while True:
        packet = generate_vitals(PATIENT_ID)
        try:
            response = requests.post(f"{BACKEND_URL}/vitals", json=packet, timeout=5)
            response.raise_for_status()
            print(packet)
        except requests.RequestException as exc:
            print(f"backend unavailable: {exc}", file=sys.stderr)
        time.sleep(INTERVAL_MS / 1000)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
