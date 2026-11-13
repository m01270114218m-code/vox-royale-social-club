# VOX ROYALE — Yalla-inspired product UI implementation

## Approved direction
- Product: VOX ROYALE (retain its own name, logo, copy, and original artwork).
- Primary UX reference: Yalla — room discovery, room cards, voice-room composition, profile hierarchy, social navigation.
- Secondary feature references: WePlay for multiplayer game discovery and lobbies; BIGO LIVE for gift presentation, live interactions, and PK-style event patterns; Hello Yo for topic discovery and friend/social entry points.
- Asset direction: premium original 2D/3D asset library with remote catalog delivery and local caching. Do not copy competitor artwork, source code, trademarks, or proprietary screen assets.

## Existing architecture findings (admin-asset-center)
- The repository is a React 19 + TanStack Start + Vite application, not a Flutter-native application.
- Android currently has Capacitor configuration and an Android Web shell. A full native Android rewrite is a separate migration and must not be represented as complete by a successful APK build.
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
1. Baseline audit and build/test capture on this branch.
2. Shared design tokens, navigation and reusable components.
3. Home and discovery.
4. Voice room and gift presentation.
5. Profile, friends, messages and moments.
6. Store, wallet, VIP and asset ownership.
7. Games, events and leaderboards.
8. Admin Asset Center and moderation screens.
9. Accessibility, RTL, responsive and regression tests.
10. Android architecture decision: retain Capacitor temporarily or plan a dedicated Flutter/native client migration. Do not claim a native app until core screens and runtime are actually native.

## Acceptance criteria
- Every screen uses the shared VOX ROYALE design system and real backend state.
- All visible actions have working behavior, permission checks and failure feedback.
- No competitor branding or copied proprietary artwork.
- No fake production data, privileged access grants, secrets, automatic PR merge or deployment.
- Build success is reported only after the relevant CI job completes successfully and its artifact is verified.
