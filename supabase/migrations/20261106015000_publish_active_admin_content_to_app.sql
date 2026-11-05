-- Allow signed-in app clients to read only published content managed by admins.
drop policy if exists "Authenticated users can read active banners" on public.admin_banners;
create policy "Authenticated users can read active banners"
on public.admin_banners for select to authenticated
using (
  is_active
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at > now())
);

drop policy if exists "Authenticated users can read active app assets" on public.admin_assets;
create policy "Authenticated users can read active app assets"
on public.admin_assets for select to authenticated
using (is_active);
