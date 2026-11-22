-- Keep admin-managed media references stable.
-- Persist asset keys, not expiring signed URLs, and recover legacy equipped values.
UPDATE public.store_items si
SET asset_key = aa.asset_key
FROM public.admin_assets aa
WHERE si.asset_key LIKE '%/storage/v1/object/sign/admin-assets/%'
  AND aa.is_active
  AND (si.asset_key LIKE '%' || COALESCE(aa.metadata->>'storage_path','') || '%' OR si.asset_key LIKE '%' || aa.url || '%');

UPDATE public.gifts g
SET asset_key = aa.asset_key
FROM public.admin_assets aa
WHERE g.asset_key LIKE '%/storage/v1/object/sign/admin-assets/%'
  AND aa.is_active
  AND (g.asset_key LIKE '%' || COALESCE(aa.metadata->>'storage_path','') || '%' OR g.asset_key LIKE '%' || aa.url || '%');

UPDATE public.profiles p
SET equipped_frame = aa.asset_key
FROM public.admin_assets aa
WHERE p.equipped_frame LIKE '%/storage/v1/object/sign/admin-assets/%'
  AND aa.is_active
  AND (p.equipped_frame LIKE '%' || COALESCE(aa.metadata->>'storage_path','') || '%' OR p.equipped_frame LIKE '%' || aa.url || '%');

UPDATE public.profiles p
SET equipped_entry = aa.asset_key
FROM public.admin_assets aa
WHERE p.equipped_entry LIKE '%/storage/v1/object/sign/admin-assets/%'
  AND aa.is_active
  AND (p.equipped_entry LIKE '%' || COALESCE(aa.metadata->>'storage_path','') || '%' OR p.equipped_entry LIKE '%' || aa.url || '%');

UPDATE public.profiles p
SET equipped_frame = si.asset_key
FROM public.store_items si
WHERE p.equipped_frame ~ '^[0-9a-fA-F-]{36}$'
  AND p.equipped_frame::uuid = si.id
  AND si.kind = 'frame';

UPDATE public.profiles p
SET equipped_entry = si.asset_key
FROM public.store_items si
WHERE p.equipped_entry ~ '^[0-9a-fA-F-]{36}$'
  AND p.equipped_entry::uuid = si.id
  AND si.kind = 'entry';