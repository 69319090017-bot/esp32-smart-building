"""Reliable Discord webhook bridge for the Smart Garage event stream."""

from __future__ import annotations

import json
import logging
import os
import threading
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Iterable
import uuid

import discord
from discord import app_commands
import requests
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("smart_garage.discord")

DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL", "")
DISCORD_BOT_TOKEN = os.getenv("DISCORD_BOT_TOKEN", "")
FIREBASE_DATABASE_URL = os.getenv("FIREBASE_DATABASE_URL", "").rstrip("/")
FIREBASE_API_KEY = os.getenv("FIREBASE_API_KEY", "")
FIREBASE_AUTH_EMAIL = os.getenv("FIREBASE_AUTH_EMAIL", "")
FIREBASE_AUTH_PASSWORD = os.getenv("FIREBASE_AUTH_PASSWORD", "")
FIREBASE_ID_TOKEN = os.getenv("FIREBASE_ID_TOKEN", "")
DEVICE_ID = os.getenv("DEVICE_ID", "garage_001")
REQUEST_TIMEOUT_SECONDS = 20
RECONNECT_DELAY_SECONDS = 5


@dataclass(frozen=True)
class GarageEvent:
    device_id: str
    event_id: str
    event_type: str
    severity: str
    distance_cm: float | None
    light_level: int | None
    timestamp: int | None


class BotStatus:
    connected = False
    last_error = "Starting"
    last_event_id = ""


status = BotStatus()


class FirebaseTokenProvider:
    """Provides a short-lived Firebase Auth ID token without logging secrets."""

    def __init__(self) -> None:
        self._token = FIREBASE_ID_TOKEN
        self._expires_at = 0.0

    def token(self) -> str:
        if self._token and self._expires_at > time.time() + 60:
            return self._token
        if FIREBASE_ID_TOKEN and not FIREBASE_AUTH_EMAIL:
            # A supplied token is intentionally accepted for development, but
            # a password-based device account refreshes automatically.
            return FIREBASE_ID_TOKEN
        if not all((FIREBASE_API_KEY, FIREBASE_AUTH_EMAIL, FIREBASE_AUTH_PASSWORD)):
            raise RuntimeError("Firebase Auth settings are incomplete")
        response = requests.post(
            f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}",
            json={"email": FIREBASE_AUTH_EMAIL, "password": FIREBASE_AUTH_PASSWORD, "returnSecureToken": True},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        payload = response.json()
        self._token = payload["idToken"]
        self._expires_at = time.time() + int(payload.get("expiresIn", 3600))
        return self._token


def event_from_data(device_id: str, event_id: str, data: Any) -> GarageEvent | None:
    if not event_id or not isinstance(data, dict):
        return None
    event_type = data.get("event_type")
    if not isinstance(event_type, str):
        return None
    distance = data.get("distance_cm")
    light = data.get("light_level")
    timestamp = data.get("timestamp")
    return GarageEvent(
        device_id=device_id,
        event_id=event_id,
        event_type=event_type,
        severity=str(data.get("severity", "info")),
        distance_cm=float(distance) if isinstance(distance, (float, int)) else None,
        light_level=int(light) if isinstance(light, (float, int)) else None,
        timestamp=int(timestamp) if isinstance(timestamp, (float, int)) else None,
    )


def events_from_sse_change(path: str, data: Any) -> Iterable[GarageEvent]:
    """Extract event records from Firebase devices.json `put` and `patch` SSE payloads."""
    path_parts = [part for part in path.split("/") if part]
    if not path_parts:
        if isinstance(data, dict):
            for dev_id, dev_data in data.items():
                event_map = dev_data.get("events", {}) if isinstance(dev_data, dict) else {}
                if isinstance(event_map, dict):
                    for event_id, event_data in event_map.items():
                        if event := event_from_data(dev_id, event_id, event_data): yield event
        return
    dev_id = path_parts[0]
    if len(path_parts) == 1:
        if isinstance(data, dict) and isinstance(data.get("events"), dict):
            for event_id, event_data in data["events"].items():
                if event := event_from_data(dev_id, event_id, event_data): yield event
        return
    if path_parts[1] != "events":
        return
    if len(path_parts) == 2 and isinstance(data, dict):
        for event_id, event_data in data.items():
            if event := event_from_data(dev_id, event_id, event_data): yield event
        return
    event_id = path_parts[2] if len(path_parts) > 2 else ""
    if event := event_from_data(dev_id, event_id, data): yield event

def send_discord_webhook(session: requests.Session, event: GarageEvent) -> None:
    if not DISCORD_WEBHOOK_URL:
        logger.warning("DISCORD_WEBHOOK_URL is not configured; event %s retained in Firebase", event.event_id)
        return
    colors = {"critical": 0xED4245, "warning": 0xFEE75C, "info": 0x5865F2}
    timestamp = datetime.fromtimestamp(event.timestamp / 1000, tz=UTC).isoformat() if event.timestamp else datetime.now(UTC).isoformat()
    fields = [
        {"name": "Device", "value": event.device_id, "inline": True},
        {"name": "Severity", "value": event.severity.upper(), "inline": True},
        {"name": "Distance", "value": f"{event.distance_cm:.1f} cm" if event.distance_cm is not None else "N/A", "inline": True},
        {"name": "Light level", "value": str(event.light_level) if event.light_level is not None else "N/A", "inline": True},
    ]
    payload = {
        "content": "@everyone 🚨 **INTRUSION DETECTED**" if event.severity.lower() == "critical" else "",
        "embeds": [{
            "title": f"{'🚨' if event.severity.lower() == 'critical' else 'ℹ️'} Smart Garage: {event.event_type.replace('_', ' ').title()}",
            "description": f"Event ID: `{event.event_id}`",
            "color": colors.get(event.severity.lower(), colors["info"]),
            "timestamp": timestamp,
            "fields": fields,
            "footer": {"text": "ESP32 Smart Garage"},
        }]
    }
    for attempt in range(3):
        response = session.post(DISCORD_WEBHOOK_URL, json=payload, timeout=REQUEST_TIMEOUT_SECONDS)
        if response.status_code in (200, 204):
            logger.info("Sent Discord event %s", event.event_id)
            return
        if response.status_code == 429:
            retry_after = float(response.json().get("retry_after", 1))
            logger.warning("Discord rate limited; retrying in %.1fs", retry_after)
            time.sleep(retry_after)
            continue
        response.raise_for_status()
    raise RuntimeError("Discord webhook retries exhausted")


def listen_to_firebase() -> None:
    if not FIREBASE_DATABASE_URL:
        raise RuntimeError("FIREBASE_DATABASE_URL is not configured")
    token_provider = FirebaseTokenProvider()
    seen_ids: set[str] = set()
    session = requests.Session()
    stream_url = f"{FIREBASE_DATABASE_URL}/devices.json"

    while True:
        try:
            # RTDB SSE accepts a Firebase ID token via the documented auth parameter.
            response = session.get(
                stream_url,
                params={"auth": token_provider.token()},
                headers={"Accept": "text/event-stream"},
                stream=True,
                timeout=(REQUEST_TIMEOUT_SECONDS, 90),
            )
            response.raise_for_status()
            status.connected = True
            status.last_error = "Connected"
            logger.info("Listening for events from all devices")
            event_type = ""
            for raw_line in response.iter_lines(decode_unicode=True):
                if not raw_line:
                    continue
                if raw_line.startswith("event: "):
                    event_type = raw_line[7:]
                    continue
                if not raw_line.startswith("data: ") or event_type not in {"put", "patch"}:
                    continue
                change = json.loads(raw_line[6:])
                for event in events_from_sse_change(change.get("path", "/"), change.get("data")):
                    if event.event_id in seen_ids:
                        continue
                    seen_ids.add(event.event_id)
                    # Keep the in-memory dedupe set bounded for a long-running service.
                    if len(seen_ids) > 1000:
                        seen_ids = {event.event_id}
                    send_discord_webhook(session, event)
                    status.last_event_id = event.event_id
        except (requests.RequestException, ValueError, KeyError, RuntimeError) as error:
            status.connected = False
            status.last_error = type(error).__name__
            logger.warning("Firebase listener reconnecting in %ss: %s", RECONNECT_DELAY_SECONDS, error)
            time.sleep(RECONNECT_DELAY_SECONDS)


class HealthCheckHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802 (HTTP handler API)
        if self.path not in {"/", "/health"}:
            self.send_error(404)
            return
        body = json.dumps({
            "ok": status.connected,
            "device_id": DEVICE_ID,
            "last_event_id": status.last_event_id,
            "last_error": status.last_error,
        }).encode()
        self.send_response(200 if status.connected else 503)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: object) -> None:
        logger.debug("Health check: " + format, *args)


def run_health_server() -> None:
    port = int(os.getenv("PORT", "8080"))
    server = HTTPServer(("0.0.0.0", port), HealthCheckHandler)
    logger.info("Health server listening on %s", port)
    server.serve_forever()


if __name__ == "__main__":
    threading.Thread(target=run_health_server, daemon=True).start()
    threading.Thread(target=listen_to_firebase, daemon=True).start()

    if DISCORD_BOT_TOKEN:
        class SmartGarageBot(discord.Client):
            def __init__(self):
                super().__init__(intents=discord.Intents.default())
                self.tree = app_commands.CommandTree(self)

            async def setup_hook(self):
                await self.tree.sync()

        bot = SmartGarageBot()

        def get_firebase_token():
            return FirebaseTokenProvider().token()

        @bot.tree.command(name="status", description="Get current status of the smart garage")
        async def cmd_status(interaction: discord.Interaction, device: str = None):
            await interaction.response.defer()
            try:
                url = f"{FIREBASE_DATABASE_URL}/devices/{device or DEVICE_ID}/status.json?auth={get_firebase_token()}"
                res = requests.get(url, timeout=REQUEST_TIMEOUT_SECONDS)
                res.raise_for_status()
                data = res.json() or {}
                
                telemetry_url = f"{FIREBASE_DATABASE_URL}/devices/{device or DEVICE_ID}/telemetry/live.json?auth={get_firebase_token()}"
                res2 = requests.get(telemetry_url, timeout=REQUEST_TIMEOUT_SECONDS)
                res2.raise_for_status()
                telemetry = res2.json() or {}
                
                is_online = data.get("online")
                embed = discord.Embed(
                    title=f"📡 Smart Garage Status: {device or DEVICE_ID}", 
                    color=discord.Color.green() if is_online else discord.Color.red()
                )
                embed.add_field(name="📶 Connection", value="🟢 Online" if is_online else "🔴 Offline", inline=True)
                
                armed = telemetry.get('armed', True)
                embed.add_field(name="🛡️ Security", value="🔒 Armed" if armed else "🔓 Disarmed", inline=True)
                
                dist = telemetry.get('distance_cm')
                embed.add_field(name="📏 Distance", value=f"{dist} cm" if dist is not None else "N/A", inline=True)
                
                light_val = telemetry.get('light_level')
                light_pct = f"{int(light_val/4095*100)}%" if light_val is not None else "N/A"
                embed.add_field(name="💡 Light Level", value=light_pct, inline=True)
                
                await interaction.followup.send(embed=embed)
            except Exception as e:
                await interaction.followup.send(f"Error fetching status: {e}")

        @bot.tree.command(name="arm", description="Arm the smart garage system")
        async def cmd_arm(interaction: discord.Interaction, device: str = None):
            await interaction.response.defer()
            try:
                url = f"{FIREBASE_DATABASE_URL}/devices/{device or DEVICE_ID}/commands.json?auth={get_firebase_token()}"
                res = requests.patch(url, json={"armed": True}, timeout=REQUEST_TIMEOUT_SECONDS)
                res.raise_for_status()
                embed = discord.Embed(
                    title="🔒 System Armed",
                    description=f"Security system for `{device or DEVICE_ID}` is now active.",
                    color=discord.Color.green()
                )
                await interaction.followup.send(embed=embed)
            except Exception as e:
                await interaction.followup.send(f"Error: {e}")

        @bot.tree.command(name="disarm", description="Disarm the smart garage system")
        async def cmd_disarm(interaction: discord.Interaction, device: str = None):
            await interaction.response.defer()
            try:
                url = f"{FIREBASE_DATABASE_URL}/devices/{device or DEVICE_ID}/commands.json?auth={get_firebase_token()}"
                res = requests.patch(url, json={"armed": False}, timeout=REQUEST_TIMEOUT_SECONDS)
                res.raise_for_status()
                embed = discord.Embed(
                    title="🔓 System Disarmed",
                    description=f"Security system for `{device or DEVICE_ID}` has been deactivated.",
                    color=discord.Color.orange()
                )
                await interaction.followup.send(embed=embed)
            except Exception as e:
                await interaction.followup.send(f"Error: {e}")

        @bot.tree.command(name="test-alert", description="Trigger a test alert")
        async def cmd_test_alert(interaction: discord.Interaction, device: str = None):
            await interaction.response.defer()
            try:
                event_id = f"test_{int(time.time()*1000)}_{uuid.uuid4().hex[:4]}"
                url = f"{FIREBASE_DATABASE_URL}/devices/{device or DEVICE_ID}/events/{event_id}.json?auth={get_firebase_token()}"
                payload = {
                    "id": event_id,
                    "event_type": "test_alert",
                    "severity": "info",
                    "timestamp": int(time.time()*1000),
                    "distance_cm": 0,
                    "light_level": 0
                }
                res = requests.put(url, json=payload, timeout=REQUEST_TIMEOUT_SECONDS)
                res.raise_for_status()
                embed = discord.Embed(
                    title="🚨 Test Alert Triggered",
                    description=f"A test intrusion event was sent to `{device or DEVICE_ID}`.",
                    color=discord.Color.purple()
                )
                await interaction.followup.send(embed=embed)
            except Exception as e:
                await interaction.followup.send(f"Error triggering test alert: {e}")

        logger.info("Starting interactive Discord Bot...")
        bot.run(DISCORD_BOT_TOKEN)
    else:
        logger.info("No DISCORD_BOT_TOKEN found. Running in webhook-only mode. Press Ctrl+C to stop.")
        while True:
            time.sleep(1)
