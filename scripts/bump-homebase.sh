#!/usr/bin/env bash
# Roofer backend: pull latest CID_HomeBase and push (so Render gets new templates).
# Run from roofing-pdf-backend root:  bash scripts/bump-homebase.sh
# Optional message:  bash scripts/bump-homebase.sh "SUPP_ROOFER pdf2svg assets"

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MSG="${1:-Bump CID_HomeBase}"

cd "$ROOT"
if [[ ! -d CID_HomeBase ]]; then
  echo "ERROR: CID_HomeBase not found (run from roofing-pdf-backend root)"
  exit 1
fi

echo "→ roofing-pdf-backend ($ROOT)"
git submodule update --remote CID_HomeBase
git add CID_HomeBase
git status
git commit -m "$MSG"
git push
