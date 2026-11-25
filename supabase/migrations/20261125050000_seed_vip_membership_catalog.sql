-- Publish purchasable VIP memberships for every authenticated account.
-- app_action('buy') already performs the atomic coin debit, ownership insert,
-- equip operation, and profiles.vip / profiles.vip_until update.
insert into public.app_catalog (
  kind, name, asset_id, price, rank, description, link,
  enabled, home, position, duration_days, in_store, metadata
)
select
  'vip',
  'VIP ' || n,
  null,
  n * 30000,
  n,
  'عضوية VIP مستوى ' || n || ' لمدة 30 يومًا',
  '',
  true,
  false,
  n * 10,
  30,
  true,
  jsonb_build_object('source','vip-membership','purchase_action','app_action.buy')
from generate_series(1,12) as n
where not exists (
  select 1 from public.app_catalog c
  where c.kind='vip' and c.rank=n
);
