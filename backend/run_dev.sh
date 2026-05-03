#!/usr/bin/env bash
# Start the EduMag NG FastAPI dev server with hot-reload.
# Run from the project root OR ./backend:
#   bash backend/run_dev.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Activate virtualenv if present
if [ -f "venv/Scripts/activate" ]; then
    # shellcheck disable=SC1091
    source venv/Scripts/activate
elif [ -f "venv/bin/activate" ]; then
    # shellcheck disable=SC1091
    source venv/bin/activate
fi

echo "Starting EduMag NG API on http://localhost:8000"
echo "API docs → http://localhost:8000/api/docs"
echo ""

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
