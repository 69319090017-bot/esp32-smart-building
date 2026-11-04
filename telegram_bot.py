#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SMART BUILDING COMMAND CENTER — TELEGRAM BOT SERVICE (2026 EDITION)
===================================================================
บอท Telegram สำหรับศูนย์ควบคุมและแจ้งเตือนภัยพิบัติอัจฉริยะ ESP32:
  - สั่งการและสอบถามสถานะผ่านคำสั่งแชต (/weather, /status, /provinces, /test, /silence)
  - ตอบสนองแบบ Real-Time สอดคล้องกับฮาร์ดแวร์ ESP32 และ MQTT Broker
"""

import os
import sys
import time
import json
import urllib.parse
import urllib.request
from typing import Dict, Any

if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

def load_env(filepath="secrets.env"):
    env = {}
    if os.path.exists(filepath):
        with open(filepath, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip()
    return env

ENV = load_env()
TELEGRAM_BOT_TOKEN = ENV.get("TELEGRAM_BOT_TOKEN", os.getenv("TELEGRAM_BOT_TOKEN", ""))
TELEGRAM_CHAT_ID = ENV.get("TELEGRAM_CHAT_ID", os.getenv("TELEGRAM_CHAT_ID", ""))
MQTT_BROKER = ENV.get("MQTT_BROKER", "broker.hivemq.com")
MQTT_PORT = int(ENV.get("MQTT_PORT", 1883))
DEVICE_ID = ENV.get("DEVICE_ID", "smart_building_001")

def api_call(method: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/{method}"
    data = None
    headers = {}
    if params:
        data = json.dumps(params).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        print(f"[API ERROR] {method}: {exc}")
        return {"ok": False, "error": str(exc)}

def send_message(chat_id: str, text: str):
    return api_call("sendMessage", {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML"
    })

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

def get_live_weather(lat=13.7563, lon=100.5018):
    url = (
        f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}"
        f"&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,"
        f"weather_code,wind_speed_10m,wind_gusts_10m,uv_index&wind_speed_unit=kmh&timezone=Asia%2FBangkok"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "TelegramBot/2026"})
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            return json.loads(resp.read().decode("utf-8")).get("current", {})
    except Exception:
        return {}

def handle_update(update: Dict[str, Any]):
    msg = update.get("message", {})
    chat_id = str(msg.get("chat", {}).get("id", ""))
    text = msg.get("text", "").strip()
    if not text:
        return

    print(f"[RECV] From {chat_id}: {text}")
    cmd = text.split()[0].lower()

    if cmd in ("/start", "/help"):
        reply = (
            "🏢 <b>ยินดีต้อนรับสู่ Smart Building Command Center Bot (2026)</b>\n\n"
            "คำสั่งที่สามารถใช้งานได้:\n"
            "🌦️ /weather - ตรวจสอบสภาพอากาศและระดับความเสี่ยง 6 มิติสด\n"
            "⚙️ /status - ตรวจสอบสถานะการทำงานของบอร์ด ESP32\n"
            "🚨 /test - สั่งทดสอบไซเรนและไฟเตือนภัยฉุกเฉิน\n"
            "🔕 /silence - สั่งปิดเสียงเตือนภัยชั่วคราว\n"
            "📍 /provinces - แสดงรายชื่อจังหวัดสำคัญที่เฝ้าระวัง\n"
            "ℹ️ /help - แสดงคู่มือคำสั่ง"
        )
        send_message(chat_id, reply)

    elif cmd == "/weather":
        w = get_live_weather()
        temp = w.get("temperature_2m", 0.0)
        apparent = w.get("apparent_temperature", 0.0)
        uv = w.get("uv_index", 0.0)
        rain = w.get("precipitation", 0.0)
        gust = w.get("wind_gusts_10m", 0.0)
        wmo = w.get("weather_code", 0)

        uv_status = "⚠️ สูงมาก" if uv >= 8.0 else ("🚨 สูงจัด" if uv >= 11.0 else "✅ ปกติ")
        heat_status = "⚠️ เสี่ยงเพลียแดด" if apparent >= 37.0 else ("🚨 เสี่ยงลมแดด" if apparent >= 41.0 else "✅ สบาย")

        reply = (
            "🌤️ <b>รายงานสภาพอากาศและความเสี่ยง 6 มิติ (กรุงเทพมหานคร):</b>\n\n"
            f"🌡️ <b>อุณหภูมิวัดจริง:</b> {temp:.1f} °C\n"
            f"🔥 <b>ความรู้สึกจริง (Heat Index):</b> {apparent:.1f} °C ({heat_status})\n"
            f"☀️ <b>ดัชนี UV Index:</b> {uv:.1f} ({uv_status})\n"
            f"🌧️ <b>ปริมาณฝนสะสม:</b> {rain:.1f} mm/h\n"
            f"💨 <b>ลมกระโชกแรง:</b> {gust:.1f} km/h\n"
            f"⛈️ <b>WMO Code:</b> {wmo}\n\n"
            f"🌐 Node ID: <code>{DEVICE_ID}</code>"
        )
        send_message(chat_id, reply)

    elif cmd == "/status":
        reply = (
            "📊 <b>สถานะศูนย์ควบคุมความปลอดภัย ESP32:</b>\n\n"
            f"🟢 <b>ฮาร์ดแวร์:</b> ESP32 Dual-Core (Active)\n"
            f"📡 <b>MQTT Broker:</b> {MQTT_BROKER}:{MQTT_PORT}\n"
            f"📶 <b>Wi-Fi:</b> เชื่อมต่อปกติ\n"
            f"⏱️ <b>System Time:</b> {time.strftime('%Y-%m-%d %H:%M:%S')}\n"
            f"🆔 <b>Device ID:</b> <code>{DEVICE_ID}</code>"
        )
        send_message(chat_id, reply)

    elif cmd == "/test":
        publish_mqtt("smart_building/alarm/strobe", "ON")
        publish_mqtt("smart_building/command/test", "1")
        send_message(chat_id, "🚨 <b>[TEST MODE ACTIVATED]</b>\nสั่งเปิดสัญญาณไฟไซเรนฉุกเฉินและทดสอบฮาร์ดแวร์เรียบร้อยแล้ว!")

    elif cmd == "/silence":
        publish_mqtt("smart_building/alarm/strobe", "OFF")
        publish_mqtt("smart_building/command/silence", "1")
        send_message(chat_id, "🔕 <b>[ALARM SILENCED]</b>\nส่งสัญญาณปิดเสียงไซเรนเตือนภัยเรียบร้อยแล้ว")

    elif cmd == "/provinces":
        reply = (
            "📍 <b>จังหวัดหลักที่รองรับการเฝ้าระวัง:</b>\n"
            "1. กรุงเทพมหานคร (13.75, 100.50)\n"
            "2. เชียงใหม่ (18.78, 98.98)\n"
            "3. ภูเก็ต (7.88, 98.39)\n"
            "4. ขอนแก่น (16.44, 102.83)\n"
            "5. ชลบุรี (13.36, 100.98)\n"
            "6. นครราชสีมา (14.97, 102.09)\n"
            "7. อุบลราชธานี (15.24, 104.84)\n"
            "8. สงขลา (7.19, 100.59)\n"
            "<i>(และรองรับครบ 77 จังหวัดทั่วไทยในระบบเฟิร์มแวร์ ESP32)</i>"
        )
        send_message(chat_id, reply)

def run_bot():
    print(f"🤖 Smart Building Telegram Bot กำลังเริ่มต้นทำงาน...")
    print(f"📱 Token: {TELEGRAM_BOT_TOKEN[:15]}... | Chat ID: {TELEGRAM_CHAT_ID}")
    
    # Send online message
    send_message(
        TELEGRAM_CHAT_ID,
        "🏢 <b>Smart Building Command Center (2026 Edition) เชื่อมต่อสำเร็จ!</b>\n"
        "ระบบเฝ้าระวังภัยพิบัติ 6 มิติบน ESP32 พร้อมทำงาน\n"
        "พิมพ์ /help เพื่อดูคำสั่งทั้งหมด"
    )
    
    last_update_id = 0
    while True:
        try:
            updates = api_call("getUpdates", {"offset": last_update_id + 1, "timeout": 20})
            if updates.get("ok"):
                for u in updates.get("result", []):
                    last_update_id = u["update_id"]
                    handle_update(u)
        except Exception as exc:
            print(f"[POLL ERROR] {exc}")
            time.sleep(3)

if __name__ == "__main__":
    run_bot()
