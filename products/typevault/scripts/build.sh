#!/usr/bin/env bash
# Packages the extension into an uploadable Chrome Web Store zip.
# If an `extpay.id` file exists at the product root, its ExtensionPay ID is
# injected into the staged copy's config.js at build time — so source stays
# EXTPAY_ID:null (tests exercise the free path) while the shipped zip carries
# the production ID and `npm run build` reproduces the real artifact.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p dist
VERSION=$(node -p "require('./extension/manifest.json').version")
OUT="$PWD/dist/typevault-v$VERSION.zip"
rm -f "$OUT"

STAGE="$(mktemp -d)"
cp -r extension/. "$STAGE/"
if [ -f extpay.id ]; then
  ID="$(tr -d '[:space:]' < extpay.id)"
  if [ -n "$ID" ]; then
    node -e "const f='$STAGE/src/lib/config.js';const fs=require('fs');fs.writeFileSync(f,fs.readFileSync(f,'utf8').replace('EXTPAY_ID: null','EXTPAY_ID: \"$ID\"'));"
    echo "injected ExtensionPay ID: $ID"
  fi
fi
(cd "$STAGE" && zip -qr "$OUT" . -x "*.DS_Store")
rm -rf "$STAGE"
echo "$OUT"
unzip -l "$OUT" | tail -3
