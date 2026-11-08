-- Use the exact catalog asset for equipped frames/entries.
-- Keep existing user ownership and never delete inventory.
create or replace function public.equip_item(_item_id uuid, _equip boolean)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog','public','private','auth','extensions','pg_temp'
as $function$
declare
  k text;
  v_asset_key text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select kind, asset_key into k, v_asset_key
  from public.store_items
  where id = _item_id;

  if not found then raise exception 'store_item_not_found'; end if;

  if not exists (
    select 1 from public.user_items
    where user_id = auth.uid() and item_id = _item_id
  ) then
    raise exception 'item not owned';
  end if;

  if k = 'entry' then
    update public.profiles
      set equipped_entry = case when _equip then v_asset_key else null end
      where id = auth.uid();
  elsif k = 'frame' then
    update public.profiles
      set equipped_frame = case when _equip then v_asset_key else null end
      where id = auth.uid();
  else
    raise exception 'item_cannot_be_equipped';
  end if;
end
$function$;

revoke all on function public.equip_item(uuid,boolean) from public, anon;
grant execute on function public.equip_item(uuid,boolean) to authenticated;
