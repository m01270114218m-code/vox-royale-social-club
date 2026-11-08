-- Repair the admin asset registry when Storage files were uploaded before registry rows existed.
-- Keep catalog/profile references stable: never persist expiring signed URLs.
insert into public.admin_assets (asset_key, name, category, url, metadata, is_active)
select
  'general-orphan-' || md5(o.name),
  regexp_replace(split_part(o.name, '/', array_length(string_to_array(o.name, '/'), 1)), '\\.[^.]+$', ''),
  'general',
  o.name,
  jsonb_build_object(
    'storage_path', o.name,
    'content_type', coalesce(o.metadata->>'mimetype', 'application/octet-stream'),
    'size', coalesce((o.metadata->>'size')::bigint, 0),
    'original_name', split_part(o.name, '/', array_length(string_to_array(o.name, '/'), 1))
  ),
  true
from storage.objects o
where o.bucket_id = 'admin-assets'
  and o.name <> '.emptyFolderPlaceholder'
  and not exists (
    select 1 from public.admin_assets a
    where coalesce(a.metadata->>'storage_path', a.url) = o.name
  );

update public.store_items si
set asset_key = a.asset_key
from public.admin_assets a
where si.asset_key like '%/storage/v1/object/sign/admin-assets/%'
  and a.is_active = true
  and coalesce(a.metadata->>'storage_path', a.url) =
      split_part(split_part(si.asset_key, '/storage/v1/object/sign/admin-assets/', 2), '?', 1);

update public.profiles p
set equipped_frame = a.asset_key
from public.admin_assets a
where p.equipped_frame like '%/storage/v1/object/sign/admin-assets/%'
  and a.is_active = true
  and coalesce(a.metadata->>'storage_path', a.url) =
      split_part(split_part(p.equipped_frame, '/storage/v1/object/sign/admin-assets/', 2), '?', 1);

update public.profiles p
set equipped_entry = a.asset_key
from public.admin_assets a
where p.equipped_entry like '%/storage/v1/object/sign/admin-assets/%'
  and a.is_active = true
  and coalesce(a.metadata->>'storage_path', a.url) =
      split_part(split_part(p.equipped_entry, '/storage/v1/object/sign/admin-assets/', 2), '?', 1);
