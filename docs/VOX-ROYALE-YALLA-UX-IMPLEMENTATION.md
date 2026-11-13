# VOX ROYALE — YallaChat-inspired Native Android implementation

## Approved direction
- Product: VOX ROYALE (retain its own name, logo, copy, and original artwork).
- Primary reference: **YallaChat: Voice & Video Calls** by Yalla Technology FZ-LLC, Android package `com.yallatech.yallachat` (Google Play: https://play.google.com/store/apps/details?id=com.yallatech.yallachat).
- Target: pursue up to 99% perceived UI/UX similarity where lawful and technically measurable, screen by screen; this is a target, not a claim of achieved parity.
- Core reference capabilities: secure messaging (text, stickers, photos, voice/video messages), 1:1 and group voice/video calls, persistent voice-chat rooms, interactive games, Moments sharing, and the listing's Athan/Qibla utilities.
- Build target: standalone Kotlin + Jetpack Compose Android app. Do not use WebView or Capacitor as the native app runtime.
- Asset direction: premium original 2D/3D asset library with remote catalog delivery and local caching. Recreate layout patterns and interactions with original VOX ROYALE artwork; do not copy competitor source code, trademarks, or proprietary assets.

## Existing architecture findings (admin-asset-center)
- The repository is a React 19 + TanStack Start + Vite application, not a Flutter-native application.
- The legacy client remains React 19 + TanStack Start + Vite with Capacitor configuration; it is retained as the behavior/backend reference.
- A standalone Kotlin + Jetpack Compose module now exists at `native-android/`. Its current implementation is an early navigation/screen shell only; it is not feature-complete and has no production service integration yet.
- A successful debug APK build alone does not establish production readiness or full native parity.
- Existing product routes include home, room, profile, store, VIP, messages, moments, friends, notifications, and help.
- Existing room, profile, store, VIP, Supabase, asset-media, and Agora integration code should be preserved and incrementally restyled rather than replaced wholesale.
- Existing asset infrastructure includes `src/lib/assets3d.ts`, `src/lib/media.ts`, `src/components/AdminAssetMedia.tsx`, and rendered asset files under `src/assets/3d/rendered`.

## Screen inventory and implementation scope
1. Home / room discovery — room categories, featured rooms, active rooms, country/topic filters, search, banners.
2. Room category listing — sort by active/new, country and topic filters, room cards and member counts.
3. Voice room — original branded room art, circular/semi-circular seat grid, mic states, host/moderator controls, member list.
4. Room chat — realtime text, emoji, image/media attachments where supported, moderation actions.
5. Gift tray — categories, owned balance, gift previews, quantity selection, send confirmation.
6. Gift playback — synchronized animation/audio playback and reward ticker, respecting configured asset duration.
7. My profile — avatar, frame, identity badges, VIP, level, followers/friends, owned assets and profile actions.
8. Public profile — follow/friend/message/report/block actions with privacy-aware visibility.
9. Friends — requests, contacts, online state, follow lists.
10. Private messages — conversations, text, voice notes and supported media.
11. Moments/community feed — posts, likes, comments, shares and reporting.
12. Store — categories and asset previews.
13. Frames and cosmetics — preview, ownership, equip/unequip and expiry.
14. VIP — tier comparison, privileges, subscription/payment state.
15. Wallet — balance, top-up entry and ledger.
16. Transaction history — immutable transaction rows and status.
17. Game hub — supported games, availability and lobby entry.
18. Game lobby — invitations, player slots, ready state and game session.
19. Leaderboards — daily/weekly/monthly rankings with explicit ranking rules.
20. Events and missions — eligibility, progress, claim state and expiry.
21. Create room — title, topic, country, visibility, seats and room artwork.
22. Room settings — room permissions, announcements and mic mode.
23. Seat management — seat order, lock/unlock, mute and speaker permissions.
24. Notifications — read/unread state and deep links.
25. Account settings — profile, language, privacy, security and device sessions.
26. Help and reports — report submission, case status and support information.
27. Admin Asset Center — upload, metadata, category, placement, targeting, schedule, preview and publish.
28. Admin user operations — moderation, bans, device controls, audit history and role-checked access.

## Shared design system
- Arabic-first RTL layout with consistent typography, spacing, touch targets, icon sizing and bottom navigation.
- Consistent cards, room tiles, avatar frames, bottom sheets, dialogs, toasts, loading skeletons, empty states, offline states and error states.
- One token system for colors, radii, elevation, motion and typography; screens must not invent independent visual styles.
- Preserve current business logic and Supabase/Realtime/Agora integrations while changing presentation in isolated, testable steps.
- No fake user, wallet, gift, room, ranking or transaction data in production UI. Empty states must remain empty when backend data is absent.

## Asset engine requirements
- Catalog metadata: stable key, category, media type, source path, thumbnail, dimensions, duration, audio path, scale, placement, animation profile, version, visibility, audience rules, effective dates and enabled state.
- Support original PNG/WebP/SVG, GIF, MP4/WebM, Lottie/Rive and GLB/GLTF only where a compatible renderer is implemented.
- Remote assets must be validated, versioned, cached and loaded lazily. Bundle only essential fallback assets in the APK.
- A newly uploaded asset may be activated without an APK release only when its asset type and rendering behavior are already supported by the installed client.
- User-targeted grants must remain private to the intended user; global catalog items may be visible to all eligible users after activation.

## Delivery sequence
1. Capture the YallaChat reference baseline screen-by-screen from the official listing and user-supplied in-app screenshots; record layout, navigation, states and interaction rules.
2. Stabilize the standalone Kotlin + Jetpack Compose build and establish automated compile/UI-test gates.
3. Implement account onboarding, phone verification, session persistence, permissions and account recovery.
4. Implement the native messaging stack: inbox, 1:1 chat, group chat, attachments, stickers, voice/video messages, delivery/read state and push notifications.
5. Implement native 1:1 and group voice/video calling with call lifecycle, audio routing, permissions and background handling.
6. Implement persistent voice rooms, discovery, create/join flows, moderation and realtime presence.
7. Implement Moments feed, media upload, reactions, comments, privacy and reporting.
8. Implement Discover, games/lobbies and the supported mini-game integrations.
9. Implement Athan/Qibla utilities only with explicit location permission and reliable calculation/source configuration.
10. Connect every feature to the existing production Supabase services and appropriate native media/call infrastructure; preserve auth, authorization, privacy and data integrity.
11. Implement profile, friends, wallet, VIP and cosmetic inventory only where supported by the VOX ROYALE product requirements and backend contracts.
12. Perform screenshot comparison, RTL/accessibility, performance, network/offline, security and real-device regression testing before release.

## Acceptance criteria
- Every screen uses the shared VOX ROYALE design system and real backend state.
- All visible actions have working behavior, permission checks and failure feedback.
- No competitor branding or copied proprietary artwork.
- No fake production data, privileged access grants, secrets, automatic PR merge or deployment.
- Build success is reported only after the relevant CI job completes successfully and its artifact is verified.
