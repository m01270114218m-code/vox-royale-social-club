<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- Image assets live in `src/assets/{avatars,covers,gifts,icons,store,ui,emoji,frames,entries,roles}` as webp (room emoji are animated webp) and are wired only through `src/components/app/data.ts`; pages never use emoji or remote avatar services for visuals, so all art stays consistent and offline.
- Layout targets a 360px Android viewport, capped at 440px wide; shared compact pieces (SubHeader, Chip/surface utilities, Coin, RoomCard) live in `AppShell.tsx`/`styles.css` so sizing stays uniform.
- Never name a module-level variable `hot` in route files: it collides with Vite's HMR binding in the router code-splitter.
- The voice room is rendered by `AppShell` (not the `/room/$id` route) from the active-room store in `session.ts`, so a minimized room keeps its state and timers while the user browses.
- Cloud Auth now owns sessions through the single AuthBridge in session.ts; useAuth is the shared read path, and local profile fields never authorize Cloud operations.
- Cloud administration uses RLS-protected catalog/settings tables and the transactional app_action RPC for role changes, credits, transfers, grants and agencies; this prevents client-side privilege escalation and partial transfers.
- Cloud catalog assets are private Storage objects resolved into signed URLs and installed through data.ts; this preserves the central art registry and workspace privacy policy.
- Administration sections use ControlPanel and agency surfaces share AgencyCenter so mobile layouts and activation states remain consistent.
- Bundled catalog media is resolved by data.ts before private Storage signing; imported catalog records remain managed through the same administration flow.
- Rank artwork is stored as individual transparent asset pointers and exposed only through data.ts; no complete sprite sheet is rendered as a badge.
- RoomMusic remains mounted with RoomView and owns temporary audio object URLs; minimized rooms retain playback until closed.
- `mobile/` is the Capacitor Android project; `CAPACITOR=1` makes Vite emit a static SPA shell for it, and `mobile/build-android.sh` rebuilds the APK.
- Daily rewards, recharge requests/decisions, room create/save, timed items and timed VIP run only inside the `app_action` RPC; `daily.ts` mirrors the reward table for display and tests, so balances and expiry cannot be forged from the client.
- User rooms are cloud rows keyed by the owner's account ID and installed into the `data.ts` room registry by `fetchCloud` before it returns; simulated guests exist only in the bundled demo rooms, never in user rooms.
- Admin uploads go through `uploadAsset` (admin-kit) with an asset section, and every asset is rendered by `Media`, which lazy-loads the SVGA player in the browser only; this keeps one upload path and SSR-safe media.
- The phone back button is handled by the Capacitor App listener in `AppShell` using the `back.ts` stack (sheets close first), and main tabs navigate with `replace`; this keeps back to one step and stops accidental app exits.
- `/admin` renders only for the admin role and every link to it is role-gated; non-admins are redirected home so the panel never appears in the app.
- The opening ad is an asset in the `splash` section referenced by the `splash` app setting and resolved by `splash.ts`; it is the one library section every signed-in user may read, so ads need no catalog entry.
- `supabase/schema.sql` is a full snapshot for standing up the backend on a fresh project and `.github/workflows/android-apk.yml` builds the APK from repository secrets; regenerate the snapshot after schema changes so exports stay installable.
