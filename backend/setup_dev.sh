#!/usr/bin/env bash
# EduMag NG — one-shot dev environment setup
# Run from the project root OR from ./backend:
#   bash backend/setup_dev.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║  EduMag NG  —  Dev Setup             ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── 1. Python virtual environment ───────────────────────────────────────────
if [ ! -d "venv" ]; then
    echo "[1/4] Creating virtual environment..."
    python -m venv venv 2>/dev/null || python3 -m venv venv
else
    echo "[1/4] Virtual environment already exists — skipping."
fi

# Activate (works on both Unix and Windows Git Bash)
if [ -f "venv/Scripts/activate" ]; then
    # shellcheck disable=SC1091
    source venv/Scripts/activate
else
    # shellcheck disable=SC1091
    source venv/bin/activate
fi

echo "      Python: $(python --version)"

# ── 2. Install dependencies ──────────────────────────────────────────────────
echo "[2/4] Installing requirements..."
pip install -r requirements.txt -q

# ── 3. Run migrations ────────────────────────────────────────────────────────
echo "[3/4] Running Alembic migrations..."
alembic upgrade head

# ── 4. Seed database ─────────────────────────────────────────────────────────
echo "[4/4] Seeding development data..."
python seed_dev.py

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "┌─────────────────────────────────────────┐"
echo "│  Setup complete!                        │"
echo "│                                         │"
echo "│  Test credentials:                      │"
echo "│    Email:    admin@test.com             │"
echo "│    Password: TestPass123!               │"
echo "│    Role:     Super Admin                │"
echo "│                                         │"
echo "│  Start the API:  bash run_dev.sh        │"
echo "└─────────────────────────────────────────┘"
echo ""
