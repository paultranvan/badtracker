#!/usr/bin/env bash
set -euo pipefail

# Load .env if present
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

FIREBASE_APP_ID="${FIREBASE_APP_ID:-}"
TESTERS_GROUP="${TESTERS_GROUP:-testers}"
APK_PATH="android/app/build/outputs/apk/release/app-release.apk"

if [ -z "$FIREBASE_APP_ID" ]; then
  echo "Error: FIREBASE_APP_ID not set. Add it to .env or pass as env var."
  exit 1
fi

# Skip build if --no-build flag is passed
if [[ "${1:-}" != "--no-build" ]]; then
  echo "==> Building release APK..."
  npx expo run:android --variant release --no-install
  shift 0 2>/dev/null || true
else
  shift
fi

if [ ! -f "$APK_PATH" ]; then
  echo "Error: APK not found at $APK_PATH"
  exit 1
fi

echo "==> APK size: $(du -h "$APK_PATH" | cut -f1)"

NOTES="${1:-$(git log -1 --pretty=format:'%s')}"
echo "==> Uploading to Firebase App Distribution..."
echo "    Release notes: $NOTES"

firebase appdistribution:distribute "$APK_PATH" \
  --app "$FIREBASE_APP_ID" \
  --groups "$TESTERS_GROUP" \
  --release-notes "$NOTES"

echo "==> Done! Testers in group '$TESTERS_GROUP' will be notified."
