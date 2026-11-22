-- Granular permissions for individual admin accounts.
create table if not exists public.admin_user_permissions (
  user_id uuid not null references auth.users(id) on delete cascade,
  permission_key text not null check (permission_key in (
    'send_frame','send_entry','send_badge','send_profile_assets',
    'edit_user_id','ban_account','ban_device','manage_wallet','manage_vip'
  )),
  enabled boolean not null default true,
  granted_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (user_id, permission_key)
);
alter table public.admin_user_permissions enable row level security;
drop policy if exists admin_user_permissions_super_read on public.admin_user_permissions;
create policy admin_user_permissions_super_read on public.admin_user_permissions
for select to authenticated
using (private.has_role((select auth.uid()), 'super_admin'));
grant select on table public.admin_user_permissions to authenticated;

CREATE OR REPLACE FUNCTION public.admin_grant_badge_asset(_user uuid, _asset_id uuid, _equip boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_asset_key text; v_name text; v_category text; v_active boolean; v_color text;
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then raise exception 'admin_required'; end if;
  perform public.admin_require_permission('send_badge');
  select asset_key,name,category,is_active,coalesce(nullif(metadata->>'color',''),'#D4AF37')
    into v_asset_key,v_name,v_category,v_active,v_color
  from public.admin_assets where id=_asset_id;
  if not found then raise exception 'asset_not_found'; end if;
  if v_category<>'badge' then raise exception 'asset_not_badge'; end if;
  if not v_active then raise exception 'asset_inactive'; end if;
  if not exists(select 1 from public.profiles where id=_user) then raise exception 'user_not_found'; end if;
  if _equip then update public.user_badges set is_equipped=false where user_id=_user; end if;
  insert into public.user_badges(user_id,badge_key,badge_name,badge_asset_key,badge_color,is_equipped)
  values(_user,v_asset_key,v_name,v_asset_key,v_color,coalesce(_equip,false))
  on conflict(user_id,badge_key) do update set badge_name=excluded.badge_name,
    badge_asset_key=excluded.badge_asset_key,badge_color=excluded.badge_color,
    is_equipped=case when _equip then true else public.user_badges.is_equipped end;
  perform public.write_audit('admin_grant_badge_asset',v_asset_key,_user,'user');
end;
$function$


CREATE OR REPLACE FUNCTION public.admin_grant_coins(_user uuid, _amount bigint)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_balance bigint;
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then raise exception 'admin_required'; end if;
  perform public.admin_require_permission('manage_wallet');
  if _amount=0 then raise exception 'amount_must_not_be_zero'; end if;
  if _amount<0 and not exists(select 1 from public.wallets where user_id=_user) then raise exception 'insufficient_balance'; end if;
  insert into public.wallets(user_id,coins) values(_user,_amount)
  on conflict(user_id) do update set coins=public.wallets.coins+excluded.coins,updated_at=now()
    where public.wallets.coins+excluded.coins>=0
  returning coins into v_balance;
  if v_balance is null then raise exception 'insufficient_balance_or_user_not_found'; end if;
  insert into public.wallet_transactions(user_id,amount,currency,reason) values(_user,_amount,'coins','admin_adjustment');
  perform public.write_audit('admin_adjust_coins',_amount::text,_user,'user');
  return v_balance;
end;
$function$


CREATE OR REPLACE FUNCTION public.admin_grant_store_item(_user uuid, _item uuid, _equip boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_kind text; v_asset_key text; v_name text; v_permission text;
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then raise exception 'admin_required'; end if;
  select kind,asset_key,name into v_kind,v_asset_key,v_name from public.store_items where id=_item;
  if not found then raise exception 'store_item_not_found'; end if;
  v_permission := case v_kind when 'frame' then 'send_frame' when 'entry' then 'send_entry'
    when 'badge' then 'send_badge' else 'send_profile_assets' end;
  perform public.admin_require_permission(v_permission);
  if not exists(select 1 from public.profiles where id=_user) then raise exception 'user_not_found'; end if;
  insert into public.user_items(user_id,item_id,acquired_at) values(_user,_item,now())
  on conflict(user_id,item_id) do nothing;
  if v_kind='badge' then
    update public.user_badges set is_equipped=false where user_id=_user;
    insert into public.user_badges(user_id,badge_key,badge_name,badge_asset_key,badge_color,is_equipped)
    values(_user,v_asset_key,v_name,v_asset_key,'#D4AF37',true)
    on conflict(user_id,badge_key) do update set badge_name=excluded.badge_name,
      badge_asset_key=excluded.badge_asset_key,badge_color=excluded.badge_color,is_equipped=true;
  elsif _equip then
    if v_kind='frame' then update public.profiles set equipped_frame=v_asset_key where id=_user;
    elsif v_kind='entry' then update public.profiles set equipped_entry=v_asset_key where id=_user;
    else raise exception 'item_cannot_be_equipped'; end if;
  end if;
  perform public.write_audit('admin_grant_store_item',v_kind||':'||v_asset_key,_user,'user');
end;
$function$


CREATE OR REPLACE FUNCTION public.admin_require_permission(_permission text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if private.has_role(auth.uid(), 'super_admin') then return; end if;
  if not public.is_admin(auth.uid()) then raise exception 'admin_required'; end if;
  if not exists (
    select 1 from public.admin_user_permissions p
    where p.user_id = auth.uid()
      and p.permission_key = _permission
      and p.enabled = true
  ) then
    raise exception 'admin_permission_required:%', _permission;
  end if;
end;
$function$


CREATE OR REPLACE FUNCTION public.admin_set_device_ban(_user uuid, _banned boolean, _reason text DEFAULT ''::text, _hours integer DEFAULT NULL::integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_device text;
begin
  if auth.uid() is null or not public.is_admin((select auth.uid())) then raise exception 'not allowed'; end if;
  perform public.admin_require_permission('ban_device');
  if _user is null then raise exception 'invalid_user'; end if;
  if _hours is not null and (_hours < 0 or _hours > 87600) then raise exception 'invalid_ban_duration'; end if;
  if not _banned then
    update public.device_bans set revoked_at=now() where user_id=_user and revoked_at is null;
    return;
  end if;
  select da.device_hash into v_device from public.device_accounts da where da.user_id=_user;
  if v_device is null then raise exception 'device_not_registered'; end if;
  insert into public.device_bans(device_hash,user_id,reason,banned_by,created_at,expires_at,revoked_at)
  values(v_device,_user,coalesce(nullif(btrim(_reason),''),'حظر الجهاز'),auth.uid(),now(),
    case when coalesce(_hours,0)=0 then null else now()+make_interval(hours=>_hours) end,null)
  on conflict(device_hash) do update set user_id=excluded.user_id,reason=excluded.reason,
    banned_by=excluded.banned_by,created_at=now(),expires_at=excluded.expires_at,revoked_at=null;
end;
$function$


CREATE OR REPLACE FUNCTION public.admin_set_profile_style(_user uuid, _name_color text, _name_effect text, _speed integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not public.is_admin(auth.uid()) then raise exception 'not_admin'; end if;
  perform public.admin_require_permission('edit_user_id');
  if _name_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'invalid_color'; end if;
  if _speed < 500 or _speed > 5000 then raise exception 'invalid_speed'; end if;
  update public.profiles set name_color=_name_color,name_effect=coalesce(nullif(_name_effect,''),'none'),
    name_effect_speed=_speed where id=_user;
end;
$function$


CREATE OR REPLACE FUNCTION public.admin_set_user_ban(_user uuid, _banned boolean, _reason text DEFAULT ''::text, _hours integer DEFAULT NULL::integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null or not public.is_admin((select auth.uid())) then raise exception 'not allowed'; end if;
  perform public.admin_require_permission('ban_account');
  if _user is null then raise exception 'invalid_user'; end if;
  if _hours is not null and (_hours < 0 or _hours > 87600) then raise exception 'invalid_ban_duration'; end if;
  if _banned then
    insert into public.user_bans(user_id, reason, banned_by, created_at, expires_at, revoked_at)
    values (_user, coalesce(nullif(btrim(_reason), ''), 'مخالفة قواعد التطبيق'), auth.uid(), now(),
      case when coalesce(_hours, 0) = 0 then null else now() + make_interval(hours => _hours) end, null)
    on conflict (user_id) do update set reason=excluded.reason,banned_by=excluded.banned_by,
      created_at=now(),expires_at=excluded.expires_at,revoked_at=null;
  else
    update public.user_bans set revoked_at=now() where user_id=_user and revoked_at is null;
  end if;
end;
$function$


CREATE OR REPLACE FUNCTION public.admin_set_user_permission(_user uuid, _permission text, _enabled boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null or not private.has_role(auth.uid(), 'super_admin') then
    raise exception 'super_admin_required';
  end if;
  if _user is null then raise exception 'invalid_user'; end if;
  if _permission not in (
    'send_frame','send_entry','send_badge','send_profile_assets',
    'edit_user_id','ban_account','ban_device','manage_wallet','manage_vip'
  ) then raise exception 'invalid_admin_permission'; end if;
  if not (
    private.has_role(_user, 'admin') or private.has_role(_user, 'moderator')
  ) then raise exception 'admin_role_required'; end if;

  insert into public.admin_user_permissions(user_id, permission_key, enabled, granted_by, updated_at)
  values (_user, _permission, _enabled, auth.uid(), now())
  on conflict (user_id, permission_key) do update
    set enabled = excluded.enabled, granted_by = excluded.granted_by, updated_at = now();

  perform public.write_audit(
    'admin_user_permission',
    _permission || ':' || case when _enabled then 'enabled' else 'disabled' end,
    _user,
    'user'
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.admin_set_vip(_user uuid, _vip integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin((select auth.uid())) then raise exception 'not allowed'; end if;
  perform public.admin_require_permission('manage_vip');
  update public.profiles set vip_level=greatest(0,_vip) where id=_user;
  perform public.write_audit('admin_set_vip',_vip::text,_user,'user');
end;
$function$


CREATE OR REPLACE FUNCTION public.admin_update_user_identity(_user uuid, _display_no bigint DEFAULT NULL::bigint, _level integer DEFAULT NULL::integer, _id_color text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_old_no bigint; v_old_level integer; v_old_color text;
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then raise exception 'admin_required'; end if;
  perform public.admin_require_permission('edit_user_id');
  if _display_no is not null and (_display_no < 100000 or _display_no > 999999999999) then raise exception 'invalid_display_id'; end if;
  if _level is not null and (_level < 1 or _level > 999) then raise exception 'invalid_level'; end if;
  if _id_color is not null and _id_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'invalid_id_color'; end if;
  select display_no,level,id_color into v_old_no,v_old_level,v_old_color
  from public.profiles where id=_user for update;
  if not found then raise exception 'user_not_found'; end if;
  update public.profiles
  set display_no=coalesce(_display_no,display_no), level=coalesce(_level,level), id_color=coalesce(_id_color,id_color)
  where id=_user;
  perform public.write_audit('user_identity_updated',
    jsonb_build_object('old_display_no',v_old_no,'new_display_no',coalesce(_display_no,v_old_no),
      'old_level',v_old_level,'new_level',coalesce(_level,v_old_level),
      'old_id_color',v_old_color,'new_id_color',coalesce(_id_color,v_old_color))::text,
    _user,'user');
end;
$function$


CREATE OR REPLACE FUNCTION public.my_admin_permissions()
 RETURNS text[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(array_agg(permission_key order by permission_key), array[]::text[])
  from public.admin_user_permissions
  where user_id = auth.uid() and enabled = true;
$function$


CREATE OR REPLACE FUNCTION public.send_asset_to_user(_receiver uuid, _asset_key text, _asset_type text, _asset_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_id uuid; v_uid uuid:=auth.uid(); v_item uuid; v_asset_key text; v_asset_name text;
  v_input text:=nullif(btrim(_asset_key),''); v_storage_path text; v_permission text;
begin
  if v_uid is null or not public.is_admin(v_uid) then raise exception 'admin_required'; end if;
  v_permission := case _asset_type when 'frame' then 'send_frame' when 'entry' then 'send_entry'
    when 'badge' then 'send_badge' else 'send_profile_assets' end;
  perform public.admin_require_permission(v_permission);
  if _receiver is null or not exists(select 1 from public.profiles where id=_receiver) then raise exception 'user_not_found'; end if;
  if _receiver=v_uid then raise exception 'cannot_send_to_self'; end if;
  if _asset_type not in ('frame','entry','badge','bubble','sound_wave','profile_card') then raise exception 'invalid_asset_type'; end if;
  if v_input is not null and strpos(v_input,'/storage/v1/object/')>0 then
    v_storage_path:=regexp_replace(split_part(v_input,'?',1),'^.*?/storage/v1/object/(sign|public|authenticated)/admin-assets/','');
  else v_storage_path:=regexp_replace(coalesce(v_input,''),'^/+',''); end if;
  select a.asset_key,coalesce(nullif(trim(_asset_name),''),a.name) into v_asset_key,v_asset_name
  from public.admin_assets a where a.is_active=true and (
    a.asset_key=v_input or a.id::text=v_input or a.url=v_input
    or coalesce(a.metadata->>'storage_path','')=v_input
    or coalesce(a.metadata->>'storage_path','')=v_storage_path
    or ltrim(coalesce(a.url,''),'/')=v_storage_path)
  order by case when a.asset_key=v_input then 0 when a.id::text=v_input then 1 when a.url=v_input then 2 else 3 end,a.created_at desc limit 1;
  if v_asset_key is null then raise exception 'asset_unavailable'; end if;
  insert into public.user_asset_grants(sender_id,receiver_id,asset_key,asset_type,asset_name)
  values(v_uid,_receiver,v_asset_key,_asset_type,v_asset_name) returning id into v_id;
  if _asset_type in ('frame','entry','bubble','sound_wave','profile_card') then
    insert into public.store_items(kind,name,description,price,asset_key,sort_order,is_direct_grant)
    values(_asset_type,v_asset_name,'عنصر مرسل مباشرة',0,v_asset_key,999999,true)
    on conflict(kind,asset_key) where asset_key is not null do nothing returning id into v_item;
    if v_item is null then select id into v_item from public.store_items where kind=_asset_type and asset_key=v_asset_key limit 1; end if;
    insert into public.user_items(user_id,item_id) values(_receiver,v_item) on conflict do nothing;
  end if;
  if _asset_type='badge' then
    insert into public.user_badges(user_id,badge_key,badge_name,badge_asset_key,badge_color,is_equipped)
    values(_receiver,v_asset_key,v_asset_name,v_asset_key,'#D4AF37',true)
    on conflict(user_id,badge_key) do update set is_equipped=true,badge_name=excluded.badge_name,badge_asset_key=excluded.badge_asset_key;
  elsif _asset_type='bubble' then update public.profiles set chat_bubble_asset_key=v_asset_key where id=_receiver;
  elsif _asset_type='sound_wave' then update public.profiles set sound_wave_asset_key=v_asset_key where id=_receiver;
  elsif _asset_type='profile_card' then update public.profiles set profile_card_asset_key=v_asset_key where id=_receiver;
  end if;
  perform public.write_audit('send_asset_to_user',_asset_type||':'||v_asset_key,_receiver,'user');
  return v_id;
end;
$function$


revoke all on function public.admin_set_user_permission(uuid,text,boolean) from public, anon;
grant execute on function public.admin_set_user_permission(uuid,text,boolean) to authenticated;
revoke all on function public.my_admin_permissions() from public, anon;
grant execute on function public.my_admin_permissions() to authenticated;
revoke all on function public.admin_require_permission(text) from public, anon;
grant execute on function public.admin_require_permission(text) to authenticated;
