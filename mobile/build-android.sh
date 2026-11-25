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

WEB_DIR="$ROOT/.output/public"
if [ ! -d "$WEB_DIR/assets" ]; then
  echo "::error::Vite did not generate .output/public/assets"
  find "$ROOT/.output" -maxdepth 3 -type f | head -100 || true
  exit 1
fi

# TanStack Start SPA mode prerenders the real application shell. Use that
# generated document so its StartClient bootstrap, router manifest, and asset
# references stay exactly as produced by the framework. A hand-written HTML
# page with a guessed entry bundle is not a valid TanStack Start client shell.
SHELL_HTML=""
for candidate in "$WEB_DIR/_shell.html" "$WEB_DIR/index.html"; do
  if [ -s "$candidate" ]; then
    SHELL_HTML="$candidate"
    break
  fi
done
if [ -z "$SHELL_HTML" ]; then
  echo "::error::TanStack Start did not generate its SPA shell (_shell.html or index.html)"
  find "$WEB_DIR" -maxdepth 3 -type f | sort | head -200
  exit 1
fi

rm -rf "$MOBILE/www"
mkdir -p "$MOBILE/www"
cp -a "$WEB_DIR/." "$MOBILE/www/"
rm -f "$MOBILE/www/_headers"
if [ "$SHELL_HTML" != "$WEB_DIR/index.html" ]; then
  cp "$SHELL_HTML" "$MOBILE/www/index.html"
fi
test -s "$MOBILE/www/index.html"
grep -qE '<script[^>]+src=' "$MOBILE/www/index.html" || {
  echo "::error::Generated SPA shell has no client bootstrap script"
  sed -n '1,160p' "$MOBILE/www/index.html"
  exit 1
}

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
