#!/usr/bin/env python3
"""Local-only server and openrouteservice proxy for the donation fallback prototype."""

from __future__ import annotations

import json
import os
import threading
import time
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parent
API_KEY_ENV = "OPENROUTESERVICE_API_KEY"
PORT_ENV = "ECHOPANTRY_PREVIEW_PORT"
GEOCODE_URL = "https://api.heigit.org/pelias/v1/search"
MATRIX_URL = "https://api.heigit.org/openrouteservice/v2/matrix/driving-car"
MAX_BODY_BYTES = 4096
CACHE_TTL_SECONDS = 15 * 60

DESTINATIONS = (
    {"id": "second-harvest-curtner", "name": "Second Harvest · Curtner Center", "address": "750 Curtner Avenue, San Jose, CA 95125", "latitude": 37.2916954, "longitude": -121.8772186, "policy": "Accepts walk-in donations of unopened, unexpired nonperishable food. No glass containers or prepared food.", "hours": "Weekdays 9:30 AM–4:30 PM · closed 11:30 AM–12 PM", "source_url": "https://www.shfb.org/give-help/donate-food/", "verified_at": "Oct 23, 2026", "item_rules_status": "matched"},
    {"id": "second-harvest-cypress", "name": "Second Harvest · Cypress Center", "address": "4001 North First Street, San Jose, CA 95134", "latitude": 37.4133095, "longitude": -121.9526387, "policy": "Accepts walk-in donations of unopened, unexpired nonperishable food. No glass containers or prepared food.", "hours": "Weekdays 9:30 AM–4:30 PM", "source_url": "https://www.shfb.org/give-help/donate-food/", "verified_at": "Oct 23, 2026", "item_rules_status": "matched"},
    {"id": "sacred-heart-donation-station", "name": "Sacred Heart Donation Station", "address": "1381 South First Street, San Jose, CA 95110", "latitude": 37.3164190, "longitude": -121.8748300, "policy": "Its official page explicitly accepts food donations, but does not publish complete item-level rules. Confirm before visiting.", "hours": "Mon–Thu 8 AM–4 PM · Fri 8 AM–12 PM · Sat 9 AM–12 PM", "source_url": "https://www.sacredheartcs.org/donate-items", "verified_at": "Oct 23, 2026", "item_rules_status": "confirm"},
)

_CACHE: dict[tuple[str, str], tuple[float, object]] = {}
_CACHE_LOCK = threading.Lock()


class ProviderError(RuntimeError):
    """A sanitized external-provider failure."""


def _cache_get(namespace: str, key: str):
    now = time.monotonic()
    with _CACHE_LOCK:
        cached = _CACHE.get((namespace, key))
        if not cached or cached[0] <= now:
            _CACHE.pop((namespace, key), None)
            return None
        return cached[1]


def _cache_put(namespace: str, key: str, value):
    with _CACHE_LOCK:
        if len(_CACHE) >= 128:
            oldest = min(_CACHE, key=lambda entry: _CACHE[entry][0])
            _CACHE.pop(oldest, None)
        _CACHE[(namespace, key)] = (time.monotonic() + CACHE_TTL_SECONDS, value)


def _provider_json(request: Request):
    try:
        with urlopen(request, timeout=12) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        if error.code in (401, 403):
            raise ProviderError("The openrouteservice key was rejected. Check the local preview environment.") from None
        if error.code == 429:
            raise ProviderError("The free routing quota is temporarily exhausted. Try again later.") from None
        raise ProviderError("The routing provider could not complete this request.") from None
    except (URLError, TimeoutError, json.JSONDecodeError):
        raise ProviderError("The routing provider is temporarily unavailable.") from None


def geocode_area(area: str, api_key: str):
    normalized = " ".join(area.strip().split())
    if len(normalized) < 2 or len(normalized) > 100:
        raise ValueError("Enter a US ZIP code or neighborhood between 2 and 100 characters.")
    cache_key = normalized.casefold()
    cached = _cache_get("geocode", cache_key)
    if cached:
        return cached
    query = urlencode({"api_key": api_key, "text": normalized, "boundary.country": "US", "size": 1})
    request = Request(f"{GEOCODE_URL}?{query}", headers={"Accept": "application/json", "User-Agent": "RePlateDonationPrototype/1.0"})
    payload = _provider_json(request)
    features = payload.get("features") or []
    if not features:
        raise ValueError("We could not find that US ZIP code or neighborhood. Try a more specific area.")
    feature = features[0]
    coordinates = feature.get("geometry", {}).get("coordinates") or []
    if len(coordinates) != 2:
        raise ProviderError("The geocoder returned an incomplete location.")
    result = {"label": feature.get("properties", {}).get("label") or normalized, "longitude": float(coordinates[0]), "latitude": float(coordinates[1])}
    _cache_put("geocode", cache_key, result)
    return result


def route_destinations(origin: dict, api_key: str):
    cache_key = f"{origin['longitude']:.5f},{origin['latitude']:.5f}"
    cached = _cache_get("matrix", cache_key)
    if cached:
        return cached
    locations = [[origin["longitude"], origin["latitude"]]] + [[destination["longitude"], destination["latitude"]] for destination in DESTINATIONS]
    body = json.dumps({"locations": locations, "sources": [0], "destinations": list(range(1, len(locations))), "metrics": ["duration", "distance"], "units": "mi"}).encode("utf-8")
    request = Request(MATRIX_URL, data=body, method="POST", headers={"Accept": "application/json", "Authorization": api_key, "Content-Type": "application/json", "User-Agent": "RePlateDonationPrototype/1.0"})
    payload = _provider_json(request)
    durations = (payload.get("durations") or [[]])[0]
    distances = (payload.get("distances") or [[]])[0]
    if len(durations) != len(DESTINATIONS) or len(distances) != len(DESTINATIONS):
        raise ProviderError("The routing provider returned an incomplete route matrix.")
    routed = []
    for destination, duration, distance in zip(DESTINATIONS, durations, distances):
        if duration is None or distance is None:
            continue
        routed.append({**destination, "drive_minutes": max(1, round(float(duration) / 60)), "drive_miles": round(float(distance), 1)})
    routed.sort(key=lambda destination: (destination["drive_minutes"], destination["drive_miles"]))
    _cache_put("matrix", cache_key, routed)
    return routed


def search(area: str, max_drive_minutes: int, api_key: str):
    if max_drive_minutes not in (15, 30, 60):
        raise ValueError("Choose a 15, 30, or 60 minute drive limit.")
    origin = geocode_area(area, api_key)
    destinations = [destination for destination in route_destinations(origin, api_key) if destination["drive_minutes"] <= max_drive_minutes]
    return {"origin": origin, "max_drive_minutes": max_drive_minutes, "destinations": destinations}


class PreviewHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, _format, *args):
        return

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        super().end_headers()

    def _json(self, status: int, payload: dict):
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if urlparse(self.path).path == "/api/status":
            self._json(
                HTTPStatus.OK,
                {
                    "routing_configured": bool(os.getenv(API_KEY_ENV)),
                    "destinations": DESTINATIONS,
                },
            )
            return
        super().do_GET()

    def do_POST(self):
        if urlparse(self.path).path != "/api/search":
            self._json(HTTPStatus.NOT_FOUND, {"error": "Prototype route not found."})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_BODY_BYTES:
            self._json(HTTPStatus.BAD_REQUEST, {"error": "Send a small JSON search request."})
            return
        try:
            data = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self._json(HTTPStatus.BAD_REQUEST, {"error": "Send valid JSON."})
            return
        api_key = os.getenv(API_KEY_ENV)
        if not api_key:
            self._json(HTTPStatus.SERVICE_UNAVAILABLE, {"error": "Live routing needs OPENROUTESERVICE_API_KEY in the local preview environment."})
            return
        try:
            payload = search(str(data.get("area") or ""), int(data.get("max_drive_minutes") or 30), api_key)
        except (TypeError, ValueError) as error:
            self._json(HTTPStatus.UNPROCESSABLE_ENTITY, {"error": str(error)})
            return
        except ProviderError as error:
            self._json(HTTPStatus.BAD_GATEWAY, {"error": str(error)})
            return
        self._json(HTTPStatus.OK, payload)


def main():
    port = int(os.getenv(PORT_ENV, "8765"))
    server = ThreadingHTTPServer(("127.0.0.1", port), PreviewHandler)
    configured = "configured" if os.getenv(API_KEY_ENV) else "missing"
    print(f"RePlate donation prototype: http://127.0.0.1:{port}")
    print(f"Live routing key: {configured}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
