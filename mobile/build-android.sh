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

# TanStack Start's Cloudflare preset emits the client bundle but does not emit
# a standalone HTML document in this build. Create the local Capacitor SPA shell
# that loads the exact hashed entry bundle and stylesheet generated above.
MAIN_JS="$(find "$WEB_DIR/assets" -maxdepth 1 -type f -name 'index-*.js' -print -quit)"
MAIN_CSS="$(find "$WEB_DIR/assets" -maxdepth 1 -type f -name 'styles-*.css' -print -quit)"
if [ -z "$MAIN_JS" ] || [ -z "$MAIN_CSS" ]; then
  echo "::error::Could not locate the generated app entry JavaScript or stylesheet"
  find "$WEB_DIR/assets" -maxdepth 1 -type f -print | sort
  exit 1
fi

rm -rf "$MOBILE/www"
mkdir -p "$MOBILE/www"
cp -a "$WEB_DIR/." "$MOBILE/www/"
rm -f "$MOBILE/www/_headers"
JS_ASSET="/assets/$(basename "$MAIN_JS")"
CSS_ASSET="/assets/$(basename "$MAIN_CSS")"
cat > "$MOBILE/www/index.html" <<EOF
<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#0d1226" />
    <title>صدى شات</title>
    <link rel="stylesheet" href="$CSS_ASSET" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="$JS_ASSET"></script>
  </body>
</html>
EOF

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
