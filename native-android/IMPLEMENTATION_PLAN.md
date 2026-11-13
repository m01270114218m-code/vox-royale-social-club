# VOX ROYALE Native Android — Delivery Plan

This plan applies to the existing VOX ROYALE repository and the `vox-royale-native-yalla-chat` branch. It does not replace the legacy application, Supabase project, migrations, or production data.

## Product direction

Build a genuine installable Android application with Kotlin and Jetpack Compose. Use Yalla Chat as a product-reference for information architecture and interaction patterns, while retaining VOX ROYALE branding and original artwork/code. Do not copy proprietary logos, artwork, or source assets.

## Delivery gates

1. **Baseline and build reliability**
   - Run native unit tests and assemble a debug APK.
   - Keep the APK workflow green before expanding the app.
   - Verify the artifact exists and can be downloaded.

2. **Native foundation and design system**
   - Establish reusable typography, color, spacing, cards, navigation, loading, empty, and error states.
   - Implement responsive Arabic RTL layouts and accessibility labels.
   - Remove inert controls or connect them to real destinations/actions.

3. **Identity and account**
   - Implement Supabase Auth, secure session persistence, sign-in/sign-up/recovery, profile loading and logout.
   - Use the existing database schema and row-level security; do not invent sample users.

4. **Social discovery and messaging**
   - Connect room discovery, profiles, follows, conversations, messages, moments, and notifications to existing backend data.
   - Add pagination, loading/error/retry states, and Realtime only where supported by the schema.

5. **Live voice rooms**
   - Implement room lifecycle, circular seat layout, host/co-host controls, seat permissions, mute/hand-raise, reconnect and leave flows.
   - Integrate the configured voice provider only after its project credentials and native SDK setup are verified.

6. **Wallet, gifts, inventory and VIP**
   - Read balances and entitlements from authoritative backend records.
   - Route every credit/debit/gift operation through trusted server-side transactions.
   - Never store service-role credentials or trust client-supplied balances/prices.

7. **Quality and release**
   - Add unit, integration and device tests for critical flows.
   - Verify permissions, lifecycle, network loss/reconnect, security rules and accessibility.
   - Produce and verify a signed release APK/AAB only after signing configuration is supplied securely.

## Current verified baseline

The native module currently contains five Compose navigation sections and initial screen shells. Supabase values are injected into BuildConfig, but configuration presence is not proof of a live connection. Auth/session persistence, repositories, Realtime, voice-room SDK, wallet/gift transactions, push and moderation are not yet implemented in the native module.

No users, rooms, messages, wallet balances, gifts or inventory are to be fabricated for demonstration. A successful debug build is not evidence of production readiness or full feature parity.

## Change and verification policy

- Work on `vox-royale-native-yalla-chat`; do not modify `main`.
- Preserve the existing React/Capacitor app and Supabase migrations as the product/backend reference.
- For each milestone, run the relevant tests and native APK workflow, inspect the logs and artifact, and report what passed and what remains.
- Never describe an APK as ready unless the build is successful and the APK artifact is present.
