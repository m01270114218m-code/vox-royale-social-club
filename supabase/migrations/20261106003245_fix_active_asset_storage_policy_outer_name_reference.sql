-- Qualify the outer storage.objects.name column to avoid resolving it to
-- admin_assets.name inside the EXISTS subquery.
drop policy if exists "Authenticated users can read app assets" on storage.objects;
create policy "Authenticated users can read app assets"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'admin-assets'
  and exists (
    select 1
    from public.admin_assets as asset
    where asset.is_active = true
      and (asset.url = objects.name or asset.metadata ->> 'storage_path' = objects.name)
  )
);
