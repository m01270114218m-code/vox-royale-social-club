# VOX ROYALE — External Admin Control Panel

Standalone Arabic RTL admin console connected to the production Supabase project. It provides Dashboard, Users, Rooms, Seats, VIP, Wallet, Gifts, Banners, Notifications, 3D Assets, Reports, Admin Roles, Settings, Analytics, and Audit Log.

## Local run
From the repository root:
`npx --yes http-server admin-app -p 4173`
Open `http://localhost:4173`.

## External hosting
Deploy the contents of `admin-app/` as a static site on Cloudflare Pages, Netlify, or Vercel. Set the output/root directory to `admin-app`. The admin site is a separate deployable artifact; it is not publicly hosted until you deploy it to your chosen host.

## Authentication and security
- Sign in using Supabase Auth.
- Only authenticated users with `super_admin`, `admin`, or `moderator` can enter.
- The first authenticated non-anonymous account may claim the first-admin slot; the database advisory lock ensures only one account can succeed.
- The first role is `super_admin`; only this role can manage admin roles.
- Every table operation remains subject to PostgreSQL RLS.
- The browser uses only the Supabase publishable key. Never put a secret/service_role key in this folder.
- Wallet transactions and audit history are read-only in the general JSON editor.
- Uploaded files go to the private `admin-assets` bucket; stored object paths are private.

## Notes
The panel uses the current `sada-voice` database schema. Some modules display existing data and support JSON-based record edits; financial balance changes must be implemented through a dedicated audited atomic RPC, not direct client-side balance edits.
