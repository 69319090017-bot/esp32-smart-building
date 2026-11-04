#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SMART BUILDING COMMAND CENTER — DISASTER SIMULATOR & TEST SUITE (2026 EDITION)
=============================================================================
จำลองการทำงานของบอร์ด ESP32 ในการประเมินความเสี่ยงภัยพิบัติ 6 มิติ:
  1. ดัชนี UV (UV Index >= 8.0, >= 11.0)
  2. ดัชนีความร้อน (Heat Index >= 37.0°C, >= 41.0°C)
  3. พายุฝนฟ้าคะนอง (WMO 95, 96, 99)
  4. ลมกระโชกแรง (Wind Gusts >= 50.0, >= 89.0 km/h)
  5. ฝนตกหนัก (Rain >= 10.0, >= 35.0 mm/h)
  6. น้ำในแม่น้ำ (River Discharge >= 500.0 m³/s)

ส่งผลลัพธ์ไปยัง:
  - Telegram Bot API (แจ้งเตือนมือถือเรียลไทม์)
  - MQTT Broker (broker.hivemq.com)
  - Firebase Realtime Database
"""

import os
import sys
import time
import json
import urllib.parse
import urllib.request
from typing import Dict, Any, Optional

if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# Load secrets from secrets.env
def load_env(filepath="secrets.env"):
    env = {}
    candidates = [
        filepath,
        os.path.join(os.path.dirname(__file__), filepath),
        os.path.join(os.path.dirname(__file__), "..", filepath),
    ]
    for p in candidates:
        if os.path.exists(p):
            with open(p, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        env[k.strip()] = v.strip()
            if env:
                break
    return env

ENV = load_env()
TELEGRAM_BOT_TOKEN = ENV.get("TELEGRAM_BOT_TOKEN", os.getenv("TELEGRAM_BOT_TOKEN", ""))
TELEGRAM_CHAT_ID = ENV.get("TELEGRAM_CHAT_ID", os.getenv("TELEGRAM_CHAT_ID", ""))
MQTT_BROKER = ENV.get("MQTT_BROKER", "broker.hivemq.com")
MQTT_PORT = int(ENV.get("MQTT_PORT", 1883))
DEVICE_ID = ENV.get("DEVICE_ID", "smart_building_001")
FIREBASE_URL = ENV.get("FIREBASE_DATABASE_URL", "").rstrip("/")

# 77 Provinces Sample Coordinates
PROVINCES = {
    "กรุงเทพมหานคร": (13.7563, 100.5018),
    "เชียงใหม่": (18.7883, 98.9853),
    "ภูเก็ต": (7.8804, 98.3923),
    "ขอนแก่น": (16.4419, 102.8359),
    "ชลบุรี": (13.3611, 100.9847),
    "นครราชสีมา": (14.9799, 102.0978),
    "อุบลราชธานี": (15.2448, 104.8473),
    "สงขลา": (7.1988, 100.5954)
}

# 6-Hazard Thresholds (WHO / WMO)
UV_WARNING = 8.0
UV_CRITICAL = 11.0
HEAT_WARNING = 37.0
HEAT_CRITICAL = 41.0
GUST_WARNING = 50.0
GUST_CRITICAL = 89.0
RAIN_WARNING = 10.0
RAIN_CRITICAL = 35.0
FLOOD_DISCHARGE_ALERT = 500.0

def send_telegram_alert(message: str, severity: str, province: str):
    if not TELEGRAM_BOT_TOKEN or "YOUR_" in TELEGRAM_BOT_TOKEN:
        print("[TELEGRAM] Bot token not configured, skipping dispatch.")
        return False
    
    icon = "🚨" if severity == "CRITICAL" else "⚠️"
    action = "เปิดสัญญาณไฟไซเรนฉุกเฉิน | ปลดล็อกประตูอัตโนมัติ" if severity == "CRITICAL" else "เปิดไฟสัญญาณเฝ้าระวัง"
    
    text = (
        f"{icon} <b>[{severity}]</b> {message}\n"
        f"⚙️ <b>การตอบสนองระบบ:</b> {action}\n"
        f"📍 <b>พื้นที่:</b> จ.{province}\n"
        f"🌐 <b>อุปกรณ์:</b> ESP32 Node: {DEVICE_ID}\n"
        f"⏰ <b>เวลา:</b> {time.strftime('%Y-%m-%d %H:%M:%S')}"
    )
    
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = json.dumps({"chat_id": TELEGRAM_CHAT_ID, "text": text, "parse_mode": "HTML"}).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            if resp.status == 200:
                print(f"📱 [TELEGRAM SUCCESS] แจ้งเตือน [{severity}] ส่งถึงผู้ใช้เรียบร้อยแล้ว!")
                return True
    except Exception as exc:
        print(f"⚠️ [TELEGRAM ERROR] ส่งไม่สำเร็จ: {exc}")
    return False

def publish_mqtt(topic: str, payload: str):
    try:
        import paho.mqtt.client as mqtt
        try:
            client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
        except AttributeError:
            client = mqtt.Client()
        client.connect(MQTT_BROKER, MQTT_PORT, keepalive=10)
        client.publish(topic, payload, qos=1)
        client.disconnect()
        print(f"📡 [MQTT] {topic} -> {payload}")
    except Exception as exc:
        print(f"⚠️ [MQTT ERROR] ({topic}): {exc}")

def get_firebase_token() -> Optional[str]:
    """Retrieve Firebase ID token using email/password if available."""
    token = ENV.get("FIREBASE_ID_TOKEN", os.getenv("FIREBASE_ID_TOKEN", ""))
    if token:
        return token
    email = ENV.get("ESP32_AUTH_EMAIL", os.getenv("ESP32_AUTH_EMAIL", ""))
    password = ENV.get("ESP32_AUTH_PASSWORD", os.getenv("ESP32_AUTH_PASSWORD", ""))
    api_key = ENV.get("FIREBASE_API_KEY", os.getenv("FIREBASE_API_KEY", ""))
    if not (email and password and api_key and "yourdomain" not in email and "YourStrong" not in password):
        return None
    url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={api_key}"
    payload = json.dumps({"email": email, "password": password, "returnSecureToken": True}).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("idToken")
    except Exception:
        return None

def sync_firebase(weather_data: Dict[str, Any], highest_severity: str, province: str):
    if not FIREBASE_URL:
        return
    token = get_firebase_token()
    auth_query = f"?auth={token}" if token else ""
    telemetry_url = f"{FIREBASE_URL}/devices/{DEVICE_ID}/telemetry/live.json{auth_query}"
    payload = {
        **weather_data,
        "severity": highest_severity,
        "province": province,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "_version": 1
    }
    data_bytes = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(telemetry_url, data=data_bytes, headers={"Content-Type": "application/json"}, method="PATCH")
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            if resp.status == 200:
                print(f"🔥 [FIREBASE RTDB] Telemetry synced to {DEVICE_ID} ({highest_severity})")
    except Exception as exc:
        print(f"⚠️ [FIREBASE ERROR] Telemetry sync: {exc}")

    # Also sync relays to Firebase RTDB
    relay_url = f"{FIREBASE_URL}/devices/{DEVICE_ID}/relays.json{auth_query}"
    relay_payload = {
        "strobe": highest_severity in ("WARNING", "CRITICAL"),
        "door": highest_severity == "CRITICAL",
        "siren": highest_severity == "CRITICAL",
        "last_updated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }
    try:
        req_relays = urllib.request.Request(
            relay_url,
            data=json.dumps(relay_payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="PATCH"
        )
        with urllib.request.urlopen(req_relays, timeout=5) as resp:
            if resp.status == 200:
                print(f"🔥 [FIREBASE RTDB] Relays synced (Strobe: {relay_payload['strobe']}, Door: {relay_payload['door']})")
    except Exception as exc:
        print(f"⚠️ [FIREBASE ERROR] Relay sync: {exc}")

def evaluate_hazards(w: Dict[str, Any], province: str):
    alerts = []
    highest_severity = "NORMAL"
    
    # 1. UV Index
    uv = w.get("uv_index", 0.0)
    if uv >= UV_CRITICAL:
        alerts.append(("CRITICAL", f"เตือนภัยดัชนี UV สูงจัด ({uv:.1f}) เสี่ยงผิวไหม้รุนแรงในไม่กี่นาที"))
        highest_severity = "CRITICAL"
    elif uv >= UV_WARNING:
        alerts.append(("WARNING", f"เฝ้าระวังดัชนี UV สูงมาก ({uv:.1f}) ควรหลีกเลี่ยงการอยู่กลางแจ้ง"))
        if highest_severity != "CRITICAL": highest_severity = "WARNING"
        
    # 2. Heat Index / Apparent Temp
    apparent = w.get("apparent_temperature", 0.0)
    if apparent >= HEAT_CRITICAL:
        alerts.append(("CRITICAL", f"เตือนภัยอากาศร้อนจัด รู้สึกเหมือน {apparent:.1f}°C เสี่ยงโรคลมแดด (Heatstroke)"))
        highest_severity = "CRITICAL"
    elif apparent >= HEAT_WARNING:
        alerts.append(("WARNING", f"เฝ้าระวังอากาศร้อน รู้สึกเหมือน {apparent:.1f}°C เสี่ยงภาวะเพลียแดด"))
        if highest_severity != "CRITICAL": highest_severity = "WARNING"
        
    # 3. Thunderstorm (WMO)
    wmo = w.get("weather_code", 0)
    if wmo in (96, 99):
        alerts.append(("CRITICAL", f"เตือนภัยพายุฝนฟ้าคะนองรุนแรงพร้อมลูกเห็บ (WMO {wmo})"))
        highest_severity = "CRITICAL"
    elif wmo == 95:
        alerts.append(("WARNING", f"เฝ้าระวังพายุฝนฟ้าคะนอง (WMO 95)"))
        if highest_severity != "CRITICAL": highest_severity = "WARNING"
        
    # 4. Wind Gusts
    gust = w.get("wind_gusts_10m", 0.0)
    if gust >= GUST_CRITICAL:
        alerts.append(("CRITICAL", f"เตือนภัยลมกระโชกรุนแรง {gust:.1f} กม./ชม."))
        highest_severity = "CRITICAL"
    elif gust >= GUST_WARNING:
        alerts.append(("WARNING", f"เฝ้าระวังลมกระโชกแรง {gust:.1f} กม./ชม."))
        if highest_severity != "CRITICAL": highest_severity = "WARNING"
        
    # 5. Rain
    rain = w.get("precipitation", 0.0)
    if rain >= RAIN_CRITICAL:
        alerts.append(("CRITICAL", f"เตือนภัยฝนตกหนักมาก {rain:.1f} มม./ชม. ระวังน้ำท่วมฉับพลัน"))
        highest_severity = "CRITICAL"
    elif rain >= RAIN_WARNING:
        alerts.append(("WARNING", f"เฝ้าระวังฝนตกหนัก {rain:.1f} มม./ชม."))
        if highest_severity != "CRITICAL": highest_severity = "WARNING"
        
    # 6. River Discharge
    river = w.get("river_discharge", 0.0)
    if river >= FLOOD_DISCHARGE_ALERT and river > 0:
        alerts.append(("WARNING", f"เฝ้าระวังน้ำท่วม: ปริมาณน้ำในแม่น้ำ {river:.0f} ลบ.ม./วินาที"))
        if highest_severity != "CRITICAL": highest_severity = "WARNING"

    return alerts, highest_severity

def fetch_real_weather(province="กรุงเทพมหานคร"):
    lat, lon = PROVINCES.get(province, (13.7563, 100.5018))
    print(f"\n[FETCH] ดึงข้อมูลสดจาก Open-Meteo สำหรับ จ.{province} ({lat}, {lon})...")
    
    url = (
        f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}"
        f"&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,"
        f"weather_code,wind_speed_10m,wind_gusts_10m,uv_index&wind_speed_unit=kmh&timezone=Asia%2FBangkok"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "ESP32Simulator/2026"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8")).get("current", {})
            return data
    except Exception as exc:
        print(f"⚠️ [FETCH ERROR] {exc}")
        return {}

def run_scenario(name: str, weather_data: Dict[str, Any], province: str = "กรุงเทพมหานคร"):
    print("\n" + "=" * 60)
    print(f"🎬 กำลังทดสอบสถานการณ์: {name}")
    print(f"📍 จังหวัด: {province}")
    print("=" * 60)
    print(f"📊 ข้อมูลสภาพอากาศ:")
    print(f"   • อุณหภูมิวัดจริง: {weather_data.get('temperature_2m', 0.0):.1f} °C")
    print(f"   • ดัชนีความร้อน (Apparent Temp): {weather_data.get('apparent_temperature', 0.0):.1f} °C")
    print(f"   • ดัชนีรังสียูวี (UV Index): {weather_data.get('uv_index', 0.0):.1f}")
    print(f"   • ปริมาณน้ำฝน: {weather_data.get('precipitation', 0.0):.1f} มม./ชม.")
    print(f"   • ลมกระโชกแรง: {weather_data.get('wind_gusts_10m', 0.0):.1f} กม./ชม.")
    print(f"   • รหัสสภาพอากาศ (WMO Code): {weather_data.get('weather_code', 0)}")
    print(f"   • อัตราการไหลของน้ำในแม่น้ำ: {weather_data.get('river_discharge', 0.0):.0f} ลบ.ม./วินาที")
    print("-" * 60)
    
    alerts, highest_severity = evaluate_hazards(weather_data, province)
    print(f"🎯 ผลการประเมินความเสี่ยง: [{highest_severity}] (พบภัยพิบัติ {len(alerts)} รายการ)")
    for sev, msg in alerts:
        print(f"   [{sev}] {msg}")
        
    # สั่งการอุปกรณ์ฮาร์ดแวร์ / MQTT
    if highest_severity == "CRITICAL":
        publish_mqtt("smart_building/alarm/strobe", "ON")
        publish_mqtt("smart_building/doors/emergency", "UNLOCK")
    elif highest_severity == "WARNING":
        publish_mqtt("smart_building/alarm/strobe", "ON")
        publish_mqtt("smart_building/doors/emergency", "LOCKED")
    else:
        publish_mqtt("smart_building/alarm/strobe", "OFF")
        publish_mqtt("smart_building/doors/emergency", "LOCKED")

    # ซิงค์ข้อมูลสภาพอากาศและสถานะรีเลย์ขึ้น Firebase RTDB
    sync_firebase(weather_data, highest_severity, province)
        
    # ส่งแจ้งเตือน Telegram
    for sev, msg in alerts:
        send_telegram_alert(msg, sev, province)
        time.sleep(1)

def interactive_menu():
    while True:
        print("\n" + "=" * 65)
        print("🏢 SMART BUILDING COMMAND CENTER - SIMULATOR (2026 EDITION)")
        print("=" * 65)
        print("  [1] ดึงข้อมูลอากาศสดจริงจาก Open-Meteo (Real-Time Live)")
        print("  [2] จำลองวิกฤตดัชนีรังสียูวีสูงจัด (Extreme UV Index = 12.5)")
        print("  [3] จำลองคลื่นความร้อนเสี่ยงโรคลมแดด (Heatstroke Risk = 43.0°C)")
        print("  [4] จำลองพายุฝนฟ้าคะนองรุนแรงพร้อมลูกเห็บ (Severe Thunderstorm WMO 96)")
        print("  [5] จำลองพายุลมกระโชกรุนแรง (Extreme Gale Gust = 95.0 km/h)")
        print("  [6] จำลองฝนตกหนักมากเสี่ยงน้ำท่วมฉับพลัน (Torrential Rain = 48.0 mm/h)")
        print("  [7] จำลองสถานะปกติ ปลอดภัยทุกมิติ (All Clear / Normal)")
        print("  [0] ออกจากโปรแกรม")
        print("=" * 65)
        
        choice = input("กรุณาเลือกตัวเลขสถานการณ์ [0-7]: ").strip()
        if choice == "0":
            break
        elif choice == "1":
            prov = "กรุงเทพมหานคร"
            w = fetch_real_weather(prov)
            run_scenario("ข้อมูลสภาพอากาศสดจริงจากดาวเทียม", w, prov)
        elif choice == "2":
            w = {"temperature_2m": 35.0, "apparent_temperature": 39.0, "uv_index": 12.5, "precipitation": 0.0, "wind_speed_10m": 15.0, "wind_gusts_10m": 25.0, "weather_code": 0}
            run_scenario("จำลองดัชนีรังสียูวีสูงจัด (Extreme UV Hazard)", w)
        elif choice == "3":
            w = {"temperature_2m": 39.0, "apparent_temperature": 43.5, "uv_index": 9.5, "precipitation": 0.0, "wind_speed_10m": 10.0, "wind_gusts_10m": 18.0, "weather_code": 1}
            run_scenario("จำลองคลื่นความร้อนและโรคลมแดด (Heatstroke Emergency)", w)
        elif choice == "4":
            w = {"temperature_2m": 27.0, "apparent_temperature": 30.0, "uv_index": 1.0, "precipitation": 32.0, "wind_speed_10m": 45.0, "wind_gusts_10m": 85.0, "weather_code": 96}
            run_scenario("จำลองพายุฝนฟ้าคะนองรุนแรงพร้อมลูกเห็บ (Severe Thunderstorm with Hail)", w)
        elif choice == "5":
            w = {"temperature_2m": 29.0, "apparent_temperature": 32.0, "uv_index": 3.0, "precipitation": 5.0, "wind_speed_10m": 60.0, "wind_gusts_10m": 95.0, "weather_code": 82}
            run_scenario("จำลองพายุลมกระโชกรุนแรง (Violent Storm Gusts)", w)
        elif choice == "6":
            w = {"temperature_2m": 25.0, "apparent_temperature": 27.0, "uv_index": 0.5, "precipitation": 48.0, "wind_speed_10m": 30.0, "wind_gusts_10m": 55.0, "weather_code": 65, "river_discharge": 680.0}
            run_scenario("จำลองฝนตกหนักมากและน้ำท่วม (Flash Flood & Heavy Rainfall)", w)
        elif choice == "7":
            w = {"temperature_2m": 28.0, "apparent_temperature": 31.0, "uv_index": 4.5, "precipitation": 0.0, "wind_speed_10m": 12.0, "wind_gusts_10m": 20.0, "weather_code": 1, "river_discharge": 80.0}
            run_scenario("จำลองสภาพอากาศปกติทุกมิติ (All Hazards Normal)", w)
        else:
            print("ตัวเลือกไม่ถูกต้อง กรุณาเลือกใหม่")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--live":
        prov = "กรุงเทพมหานคร"
        w = fetch_real_weather(prov)
        run_scenario("Live Weather Check", w, prov)
    else:
        interactive_menu()
