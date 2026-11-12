-- Normalize legacy signed Storage URLs stored in equipped_frame into stable admin asset keys.
update public.profiles p
set equipped_frame = a.asset_key
from public.admin_assets a
where p.equipped_frame like '%/storage/v1/object/sign/admin-assets/%'
  and split_part(
    regexp_replace(p.equipped_frame, '^.*?/storage/v1/object/sign/admin-assets/', ''),
    '?',
    1
  ) = coalesce(a.metadata->>'storage_path', '')
  and a.is_active = true
  and a.asset_key is not null;
