# VOX ROYALE Native Android

This directory is the start of a standalone Android application written in Kotlin and Jetpack Compose. It is not a WebView and does not load the React/Vite site.

## Build

From this directory, with JDK 17 and Android SDK platform 36 installed:

```sh
gradle :app:assembleDebug
```

The APK output is:

`app/build/outputs/apk/debug/app-debug.apk`

A GitHub Actions workflow is provided at `.github/workflows/native-android-apk.yml`.

## Current implementation status

- Native Android launcher and Compose UI foundation.
- Native bottom navigation for Home, Rooms, Games, Messages, and Profile.
- Initial Home and Rooms layouts using VOX ROYALE styling.
- No WebView, Capacitor runtime, or remote website entry point in this app module.

## Not yet production-connected

The current screens intentionally show empty states instead of fabricated users, rooms, balances, gifts, or messages. Production work remains for Supabase Auth/data/realtime, Agora native voice rooms, wallet ledger and gift transactions, profile/inventory, notifications, and the complete screen set. Do not treat this foundation APK as a production release until those integrations and device tests pass.

The existing React/Capacit​​or project remains untouched and is retained as the functional reference during the native migration.
