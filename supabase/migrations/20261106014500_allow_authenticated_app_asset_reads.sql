-- Published app assets remain in a private bucket; authenticated app users can
-- obtain signed URLs for active visual assets. Upload/update/delete remain admin-only.
drop policy if exists "Authenticated users can read app assets" on storage.objects;
create policy "Authenticated users can read app assets"
on storage.objects for select to authenticated
using (bucket_id = 'admin-assets');
