<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Sensitive room actions (seats, bans, messages, room create/delete, wallet) go through SECURITY DEFINER Postgres RPCs; clients have SELECT-only grants so permissions are enforced server-side.
- Android packaging uses a Capacitor wrapper (capacitor.config.json) around the web app; Flutter/native builds are not possible in this environment.
