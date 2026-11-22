drop policy if exists "public auth methods read" on public.admin_settings;
create policy "public auth methods read"
on public.admin_settings
for select
to anon, authenticated
using (key = 'auth_methods');
