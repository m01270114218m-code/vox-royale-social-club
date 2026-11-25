#!/usr/bin/env bash
# Build the Sada Chat Android WebView wrapper from the existing web UI.
# The current frontend is bundled locally; no browser chrome or remote-site wrapper.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOBILE="$ROOT/mobile"
APK="$MOBILE/android/app/build/outputs/apk/debug/app-debug.apk"

cd "$ROOT"
npm install --no-audit --no-fund
CAPACITOR=1 VITE_LOGIN_VIDEO=/media/ice_palace_login.mp4 npx vite build

WEB_DIR="$ROOT/dist/client"
if [ ! -s "$WEB_DIR/_shell.html" ]; then
  echo "::error::Expected SPA shell was not generated at dist/client/_shell.html"
  echo "Generated client files:"
  find "$WEB_DIR" -maxdepth 2 -type f | head -80 || true
  exit 1
fi

rm -rf "$MOBILE/www"
mkdir -p "$MOBILE/www"
cp -a "$WEB_DIR/." "$MOBILE/www/"
cp "$MOBILE/www/_shell.html" "$MOBILE/www/index.html"
rm -f "$MOBILE/www/_headers"

mkdir -p "$MOBILE/www/media"
SITE_URL="${SITE_URL:-}"
if [ -n "$SITE_URL" ]; then
  VIDEO_PATH=$(node -e "console.log(require('$ROOT/src/assets/media/ice_palace_login.mp4.asset.json').url)")
  curl -fsSL "$SITE_URL$VIDEO_PATH" -o "$MOBILE/www/media/ice_palace_login.mp4" || {
    echo "Login video download skipped; using the app's existing fallback."
    rm -f "$MOBILE/www/media/ice_palace_login.mp4"
  }
fi

cd "$MOBILE"
npm install --no-audit --no-fund
npx cap sync android

cd "$MOBILE/android"
chmod +x gradlew
./gradlew --no-daemon assembleDebug
test -s "$APK"
echo "APK successfully built: $APK"
