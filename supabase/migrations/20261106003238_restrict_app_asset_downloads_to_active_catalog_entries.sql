-- Authenticated app users may download only assets currently published in the
-- admin asset catalog. Admins retain their separate full-access policy.
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
      and (asset.url = name or asset.metadata ->> 'storage_path' = name)
  )
);
