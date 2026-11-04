"""
Smart Building Command Center - Telegram Bot Launcher
Forwards execution to telegram-bot/telegram_bot.py
"""
import sys
import subprocess
from pathlib import Path

if __name__ == "__main__":
    bot_script = Path(__file__).parent / "telegram-bot" / "telegram_bot.py"
    sys.exit(subprocess.call([sys.executable, str(bot_script)] + sys.argv[1:]))
