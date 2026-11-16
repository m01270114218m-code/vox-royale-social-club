-- Register existing files in the admin-assets bucket that were uploaded
-- before an admin_assets registry row was created.
INSERT INTO public.admin_assets (asset_key, name, category, url, metadata, is_active)
SELECT
  'general-orphan-' || md5(o.name),
  regexp_replace(split_part(o.name, '/', array_length(string_to_array(o.name, '/'), 1)), '\\.[^.]+$', ''),
  'general',
  o.name,
  jsonb_build_object(
    'storage_path', o.name,
    'content_type', COALESCE(o.metadata->>'mimetype','application/octet-stream'),
    'size', COALESCE((o.metadata->>'size')::bigint, 0),
    'original_name', split_part(o.name, '/', array_length(string_to_array(o.name, '/'), 1))
  ),
  true
FROM storage.objects o
WHERE o.bucket_id = 'admin-assets'
  AND o.name <> '.emptyFolderPlaceholder'
  AND NOT EXISTS (
    SELECT 1 FROM public.admin_assets a
    WHERE COALESCE(a.metadata->>'storage_path', a.url) = o.name
  );