#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SMART BUILDING COMMAND CENTER — INSTANT WEB LAUNCHER (2026 EDITION)
===================================================================
รันหน้าเว็บแดชบอร์ดศูนย์ควบคุมและแจ้งเตือนภัยพิบัติ 6 มิติ ให้ทดสอบได้ทันที
โดยไม่ต้องต่อบอร์ด ESP32!
  - เสิร์ฟหน้าเว็บที่พอร์ต 5000
  - เปิดเบราว์เซอร์อัตโนมัติ
  - รองรับการทดสอบดึงข้อมูลดาวเทียมสด, จำลองภัยพิบัติ 6 มิติ, และยิง Telegram จริง
"""

import os
import sys
import webbrowser
import http.server
import socketserver
from pathlib import Path

PORT = 5000
DIST_DIR = Path(__file__).parent / "web-dashboard" / "dist"

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIST_DIR), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

def main():
    if not DIST_DIR.exists() or not (DIST_DIR / "index.html").exists():
        print("[INFO] Building web-dashboard dist...")
        os.system('cmd.exe /c "cd web-dashboard && npm run build"')

    print("\n" + "=" * 65)
    print("  🏢 SMART BUILDING COMMAND CENTER (2026 EDITION)")
    print(f"  🌐 Local Live Server: http://localhost:{PORT}")
    print("  🧪 สถานะ: โหมดทดสอบจำลอง (Simulation & Live Satellite Data)")
    print("  📱 ระบบแจ้งเตือน: Telegram Bot API พร้อมส่งจริง")
    print("=" * 65 + "\n")

    url = f"http://localhost:{PORT}"
    print(f"[BROWSER] กำลังเปิดเบราว์เซอร์ไปที่: {url}")
    webbrowser.open(url)

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print("[READY] เซิร์ฟเวอร์ทำงานแล้ว กด Ctrl+C เพื่อหยุดการทำงาน\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n[STOP] หยุดการทำงานเซิร์ฟเวอร์เรียบร้อย")

if __name__ == "__main__":
    main()
