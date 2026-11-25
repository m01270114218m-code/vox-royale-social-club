#!/usr/bin/env bash
# Builds the Sada Chat Android app (APK) from this project.
# Needs: Node/Bun, JDK 17+, Android SDK (Android Studio installs both).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOBILE="$ROOT/mobile"

# 1) static single-page build of the app
cd "$ROOT"
npm install
CAPACITOR=1 VITE_LOGIN_VIDEO=/media/ice_palace_login.mp4 npx vite build

# 2) copy it into the Android web folder
rm -rf "$MOBILE/www" && cp -r "$ROOT/dist/client" "$MOBILE/www"
cp "$MOBILE/www/_shell.html" "$MOBILE/www/index.html"
rm -f "$MOBILE/www/_headers"
mkdir -p "$MOBILE/www/media"
# login video (served from the published site's asset storage)
SITE_URL="${SITE_URL:-}"
if [ -n "$SITE_URL" ]; then
  VIDEO_PATH=$(node -e "console.log(require('$ROOT/src/assets/media/ice_palace_login.mp4.asset.json').url)")
  curl -fsSL "$SITE_URL$VIDEO_PATH" -o "$MOBILE/www/media/ice_palace_login.mp4" || echo "video download skipped"
fi

# 3) sync and build
cd "$MOBILE"
npm install
npx cap sync android
cd android
chmod +x gradlew
./gradlew assembleDebug
echo "APK: $MOBILE/android/app/build/outputs/apk/debug/app-debug.apk"
