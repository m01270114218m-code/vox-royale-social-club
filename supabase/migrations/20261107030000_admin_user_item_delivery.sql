-- Admin delivery for frames, room entries, badges and other catalog items.
-- Keep one inventory row per user/catalog item so repeated grants are idempotent.
delete from public.user_items a
using public.user_items b
where a.user_id=b.user_id
  and a.item_id=b.item_id
  and a.acquired_at > b.acquired_at;

create unique index if not exists user_items_user_item_unique
  on public.user_items(user_id,item_id);

create or replace function public.admin_grant_store_item(
  _user uuid, _item uuid, _equip boolean default false
) returns void
language plpgsql security definer set search_path = ''
as $$
declare v_kind text; v_asset_key text;
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then
    raise exception 'admin_required';
  end if;
  select kind,asset_key into v_kind,v_asset_key
  from public.store_items where id=_item;
  if not found then raise exception 'store_item_not_found'; end if;
  if not exists(select 1 from public.profiles where id=_user) then
    raise exception 'user_not_found';
  end if;
  insert into public.user_items(user_id,item_id,acquired_at)
  values (_user,_item,now())
  on conflict (user_id,item_id) do nothing;
  if _equip then
    if v_kind='frame' then
      update public.profiles set equipped_frame=v_asset_key where id=_user;
    elsif v_kind='entry' then
      update public.profiles set equipped_entry=v_asset_key where id=_user;
    else
      raise exception 'item_cannot_be_equipped';
    end if;
  end if;
  perform public.write_audit(
    'admin_grant_store_item',
    v_kind||':'||v_asset_key,
    _user,
    'user'
  );
end;
$$;

create or replace function public.admin_revoke_store_item(
  _user uuid, _item uuid
) returns void
language plpgsql security definer set search_path = ''
as $$
declare v_kind text; v_asset_key text; v_deleted integer;
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then
    raise exception 'admin_required';
  end if;
  select kind,asset_key into v_kind,v_asset_key
  from public.store_items where id=_item;
  if not found then raise exception 'store_item_not_found'; end if;
  delete from public.user_items where user_id=_user and item_id=_item;
  get diagnostics v_deleted = row_count;
  if v_deleted=0 then raise exception 'user_item_not_found'; end if;
  if v_kind='frame' then
    update public.profiles set equipped_frame=null
    where id=_user and equipped_frame=v_asset_key;
  elsif v_kind='entry' then
    update public.profiles set equipped_entry=null
    where id=_user and equipped_entry=v_asset_key;
  end if;
  perform public.write_audit(
    'admin_revoke_store_item',
    v_kind||':'||v_asset_key,
    _user,
    'user'
  );
end;
$$;

revoke all on function public.admin_grant_store_item(uuid,uuid,boolean) from public,anon;
grant execute on function public.admin_grant_store_item(uuid,uuid,boolean) to authenticated;
revoke all on function public.admin_revoke_store_item(uuid,uuid) from public,anon;
grant execute on function public.admin_revoke_store_item(uuid,uuid) to authenticated;
