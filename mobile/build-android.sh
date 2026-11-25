#!/usr/bin/env bash
# Builds the Sada Chat Android app (APK) from this project.
# Needs: Node 22+, JDK 17+, Android SDK.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOBILE="$ROOT/mobile"

# 1) Build the app as a real local Capacitor bundle (no SSR server required).
cd "$ROOT"
npm install
CAPACITOR=1 VITE_LOGIN_VIDEO=/media/ice_palace_login.mp4 npx vite build --config vite.mobile.config.ts

# 2) Install the generated static app into Capacitor's webDir.
test -f "$ROOT/dist/mobile/index.html"
rm -rf "$MOBILE/www"
mkdir -p "$MOBILE/www"
cp -R "$ROOT/dist/mobile/." "$MOBILE/www/"
rm -f "$MOBILE/www/_headers"

# Optional login video (only when a published site URL is configured).
SITE_URL="${SITE_URL:-}"
if [ -n "$SITE_URL" ]; then
  VIDEO_PATH=$(node -e "console.log(require('$ROOT/src/assets/media/ice_palace_login.mp4.asset.json').url)")
  mkdir -p "$MOBILE/www/media"
  curl -fsSL "$SITE_URL$VIDEO_PATH" -o "$MOBILE/www/media/ice_palace_login.mp4" || echo "video download skipped"
fi

# 3) Sync and build the native Android project.
cd "$MOBILE"
npm install
npx cap sync android
cd android
chmod +x gradlew
./gradlew assembleDebug
APK="$MOBILE/android/app/build/outputs/apk/debug/app-debug.apk"
test -s "$APK"
echo "APK: $APK"
