"""
Smart Building Command Center - Secrets Setup Launcher
Forwards execution to scripts/setup_secrets.py
"""
import sys
import subprocess
from pathlib import Path

if __name__ == "__main__":
    script = Path(__file__).parent / "scripts" / "setup_secrets.py"
    sys.exit(subprocess.call([sys.executable, str(script)] + sys.argv[1:]))
