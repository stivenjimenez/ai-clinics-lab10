#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="$ROOT_DIR/apps/web"
API_DIR="$ROOT_DIR/apps/api"

cleanup() {
  echo ""
  echo "Stopping dev servers..."
  kill 0 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Starting backend (FastAPI) on http://localhost:8000"
(
  cd "$API_DIR"
  source .venv/bin/activate
  uvicorn main:app --reload --port 8000
) &

echo "Starting frontend (Next.js) on http://localhost:3000"
(
  cd "$WEB_DIR"
  pnpm dev
) &

wait
