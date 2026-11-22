-- Replace expiring signed Storage URLs in lucky_gifts.asset_key with
-- the stable asset_key from the matching active admin_assets record.
update public.lucky_gifts as lg
set asset_key = aa.asset_key
from public.admin_assets as aa
where lg.asset_key like 'http%'
  and aa.is_active = true
  and aa.metadata->>'storage_path' = split_part(
    split_part(lg.asset_key, '/storage/v1/object/sign/admin-assets/', 2),
    '?', 1
  );
