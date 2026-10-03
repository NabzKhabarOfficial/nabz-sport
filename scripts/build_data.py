"""Snapshot today's matches (and match events) into data/ for the static site.

The page first tries the live source directly; this snapshot is the fallback,
refreshed every few minutes by the GitHub Actions workflow.
"""
import json
import time
from pathlib import Path

import requests

API = "https://web-api.varzesh3.com/v1.0/livescore"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0 Safari/537.36",
           "Referer": "https://www.varzesh3.com/", "Accept": "application/json"}
OUT = Path("data")


def get(url):
    for attempt in range(3):
        try:
            r = requests.get(url, headers=HEADERS, timeout=15)
            r.raise_for_status()
            return r.json()
        except Exception as exc:
            print(f"fetch failed ({attempt + 1}/3) {url}: {exc}")
            time.sleep(2 * (attempt + 1))
    return None


def main():
    (OUT / "m").mkdir(parents=True, exist_ok=True)
    today = get(f"{API}/today")
    if not today or "matches" not in today:
        print("no data; keeping the previous snapshot")
        return
    today["fetchedAt"] = int(time.time())
    (OUT / "today.json").write_text(json.dumps(today, ensure_ascii=False), encoding="utf-8")
    n = 0
    for m in today.get("matches") or []:
        sid = str(m.get("sportId") or "")
        if not sid.startswith("football-") or not m.get("hasEvents"):
            continue
        events = get(f"{API}/football/matches/{m['id']}/events")
        if isinstance(events, list):
            (OUT / "m" / f"{sid}.json").write_text(json.dumps(events, ensure_ascii=False), encoding="utf-8")
            n += 1
    print(f"snapshot: {len(today.get('matches') or [])} matches, {n} event files")


if __name__ == "__main__":
    main()
