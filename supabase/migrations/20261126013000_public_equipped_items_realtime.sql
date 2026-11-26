-- Expose only equipped, enabled cosmetics across accounts.
-- Private inventory remains restricted to its owner.
create or replace view public.public_equipped_items
with (security_barrier = true, security_invoker = false)
as
select ui.id, ui.user_id, ui.catalog_id, ui.equipped, ui.expires_at
from public.user_items ui
join public.app_catalog c on c.id = ui.catalog_id
where ui.equipped = true
  and c.enabled = true
  and (ui.expires_at is null or ui.expires_at > now());

grant select on public.public_equipped_items to authenticated;

-- Make cosmetic equip/unequip changes invalidate the shared profile stream.
create or replace function public.bump_profile_for_item_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare target uuid;
begin
  target := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
  update public.profiles set updated_at = now() where id = target;
  if tg_op = 'UPDATE' and old.user_id is distinct from new.user_id then
    update public.profiles set updated_at = now() where id = old.user_id;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists user_items_bump_profile_realtime on public.user_items;
create trigger user_items_bump_profile_realtime
after insert or update or delete on public.user_items
for each row execute function public.bump_profile_for_item_change();
