"""
Smart Building Command Center - Simulator Launcher
Forwards execution to simulator/simulate_esp32.py
"""
import sys
import subprocess
from pathlib import Path

if __name__ == "__main__":
    sim_script = Path(__file__).parent / "simulator" / "simulate_esp32.py"
    sys.exit(subprocess.call([sys.executable, str(sim_script)] + sys.argv[1:]))
