alter table public.gifts add column if not exists asset_key text;

drop policy if exists "public voice controls read" on public.admin_settings;
create policy "public voice controls read"
on public.admin_settings for select to authenticated
using (key = 'voice_controls');

create or replace function public.admin_adjust_wallet(
  _user uuid, _currency text, _amount bigint, _reason text default 'admin_adjustment'
) returns bigint
language plpgsql security definer set search_path = ''
as $$
declare v_coins bigint; v_diamonds bigint; v_balance bigint;
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then raise exception 'admin_required'; end if;
  if _currency not in ('coins','diamonds') then raise exception 'invalid_currency'; end if;
  if _amount = 0 or _amount < -1000000000 or _amount > 1000000000 then raise exception 'invalid_amount'; end if;
  if not exists (select 1 from public.profiles where id = _user) then raise exception 'user_not_found'; end if;
  insert into public.wallets(user_id,coins,diamonds) values (_user,0,0) on conflict (user_id) do nothing;
  select coins,diamonds into v_coins,v_diamonds from public.wallets where user_id = _user for update;
  if _currency = 'coins' then
    v_balance := v_coins + _amount;
    if v_balance < 0 then raise exception 'insufficient_balance'; end if;
    update public.wallets set coins=v_balance,updated_at=now() where user_id=_user;
  else
    v_balance := v_diamonds + _amount;
    if v_balance < 0 then raise exception 'insufficient_balance'; end if;
    update public.wallets set diamonds=v_balance,updated_at=now() where user_id=_user;
  end if;
  insert into public.wallet_transactions(user_id,amount,currency,reason)
  values (_user,_amount,_currency,left(coalesce(nullif(_reason,''),'admin_adjustment'),120));
  perform public.write_audit('admin_adjust_wallet',_currency||':'||_amount::text,_user,'user');
  return v_balance;
end;
$$;

create or replace function public.admin_grant_store_item(
  _user uuid, _item uuid, _equip boolean default false
) returns void
language plpgsql security definer set search_path = ''
as $$
declare v_kind text; v_asset_key text;
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then raise exception 'admin_required'; end if;
  select kind,asset_key into v_kind,v_asset_key from public.store_items where id=_item;
  if not found then raise exception 'store_item_not_found'; end if;
  if not exists(select 1 from public.profiles where id=_user) then raise exception 'user_not_found'; end if;
  insert into public.user_items(user_id,item_id,acquired_at)
  select _user,_item,now()
  where not exists(select 1 from public.user_items where user_id=_user and item_id=_item);
  if _equip then
    if v_kind='frame' then update public.profiles set equipped_frame=v_asset_key where id=_user;
    elsif v_kind='entry' then update public.profiles set equipped_entry=v_asset_key where id=_user;
    else raise exception 'item_cannot_be_equipped'; end if;
  end if;
  perform public.write_audit('admin_grant_store_item',v_kind||':'||v_asset_key,_user,'user');
end;
$$;

revoke all on function public.admin_adjust_wallet(uuid,text,bigint,text) from public,anon;
grant execute on function public.admin_adjust_wallet(uuid,text,bigint,text) to authenticated;
revoke all on function public.admin_grant_store_item(uuid,uuid,boolean) from public,anon;
grant execute on function public.admin_grant_store_item(uuid,uuid,boolean) to authenticated;
