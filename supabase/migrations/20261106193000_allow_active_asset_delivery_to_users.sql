drop policy if exists "Authenticated users read active admin assets" on storage.objects;
create policy "Authenticated users read active admin assets"
on storage.objects for select to authenticated
using (
  bucket_id = 'admin-assets'
  and exists (
    select 1 from public.admin_assets a
    where a.is_active = true
      and coalesce(a.metadata->>'storage_path',a.url) = storage.objects.name
  )
);