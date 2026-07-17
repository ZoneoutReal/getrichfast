#!/usr/bin/env bash
# Packages the extension into an uploadable Chrome Web Store zip.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p dist
VERSION=$(node -p "require('./extension/manifest.json').version")
OUT="dist/snipshot-v$VERSION.zip"
rm -f "$OUT"
(cd extension && zip -qr "../$OUT" . -x "*.DS_Store")
echo "$OUT"
unzip -l "$OUT" | tail -3
