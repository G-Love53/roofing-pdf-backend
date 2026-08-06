#!/usr/bin/env bash
# Render unmapped SUPP_ROOFER (SVG → Puppeteer), save to Desktop, open.
# One terminal, no local server. Uses Render backend by default.
#
# Usage:  bash scripts/deliver-unmapped-supp-roofer.sh
# Local:  BASE_URL=http://localhost:8080 bash scripts/deliver-unmapped-supp-roofer.sh

set -e
BASE="${BASE_URL:-https://roofing-pdf-backend.onrender.com}"
OUT="${OUT:-$HOME/Desktop/SUPP_ROOFER-unmapped.pdf}"

echo "Rendering SUPP_ROOFER (unmapped) via $BASE/render-pdf -> $OUT"
curl -s -X POST "$BASE/render-pdf" \
  -H "Content-Type: application/json" \
  -d '{"templates":[{"name":"SUPP_ROOFER","data":{}}]}' \
  -o "$OUT"

if [[ ! -s "$OUT" ]]; then
  echo "No output. Is the server up? For local: npm start then BASE_URL=http://localhost:8080 $0"
  exit 1
fi

# If server returned JSON error, show it instead of opening
if [[ $(head -c1 "$OUT") == "{" ]]; then
  echo "Server returned an error (not a PDF):"
  cat "$OUT"
  echo ""
  exit 1
fi

echo "Saved $(wc -c < "$OUT") bytes -> $OUT"
open "$OUT"
echo "Opened."
