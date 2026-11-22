alter table public.store_items
  add column if not exists expires_at timestamptz;

alter table public.user_asset_grants
  add column if not exists expires_at timestamptz;

create index if not exists store_items_active_expiry_idx
  on public.store_items (expires_at)
  where is_direct_grant = false;

create index if not exists user_asset_grants_active_expiry_idx
  on public.user_asset_grants (receiver_id, expires_at);

create or replace function public.admin_save_store_item(
  _id uuid,
  _asset_key text,
  _description text,
  _kind text,
  _name text,
  _price bigint,
  _sort_order integer,
  _hours integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare v_expires timestamptz;
begin
  if not public.is_admin((select auth.uid())) then raise exception 'not allowed'; end if;
  if _hours is null or _hours < 0 or _hours > 87600 then raise exception 'invalid_store_duration'; end if;
  v_expires := case when _hours = 0 then null else now() + make_interval(hours => _hours) end;
  if _id is null then
    insert into public.store_items(asset_key,description,kind,name,price,sort_order,expires_at)
    values(_asset_key,_description,_kind,_name,_price,_sort_order,v_expires)
    returning id into _id;
  else
    update public.store_items
      set asset_key=_asset_key,description=_description,kind=_kind,name=_name,price=_price,sort_order=_sort_order,expires_at=v_expires
      where id=_id;
  end if;
  return _id;
end
$function$;

create or replace function public.buy_item(_item_id uuid)
returns bigint
language plpgsql
security definer
set search_path = 'public', 'auth', 'pg_temp'
as $function$
declare v_price bigint; v_kind text; v_name text; v_balance bigint;
begin
  select price,kind,name into v_price,v_kind,v_name from public.store_items
  where id=_item_id and coalesce(is_direct_grant,false)=false and (expires_at is null or expires_at > now());
  if v_price is null then raise exception 'item unavailable'; end if;
  select coins into v_balance from public.wallets where user_id=auth.uid() for update;
  if coalesce(v_balance,0)<v_price then raise exception 'insufficient coins'; end if;
  update public.wallets set coins=coins-v_price,updated_at=now() where user_id=auth.uid();
  insert into public.user_items(user_id,item_id) values(auth.uid(),_item_id) on conflict do nothing;
  insert into public.wallet_transactions(user_id,currency,amount,reason,kind,note,ref_id)
  values(auth.uid(),'coins',-v_price,'item_purchase','purchase','شراء '||v_name,_item_id);
  return v_balance-v_price;
end;
$function$;

create or replace function public.equip_item(_item_id uuid, _equip boolean)
returns void
language plpgsql
security definer
set search_path = 'public', 'auth', 'pg_temp'
as $function$
declare k text; v_asset_key text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select kind,asset_key into k,v_asset_key from public.store_items
  where id=_item_id and (expires_at is null or expires_at > now());
  if not found then raise exception 'store_item_expired'; end if;
  if not exists(select 1 from public.user_items where user_id=auth.uid() and item_id=_item_id) then raise exception 'item not owned'; end if;
  if k='entry' then update public.profiles set equipped_entry=case when _equip then v_asset_key else null end where id=auth.uid();
  elsif k='frame' then update public.profiles set equipped_frame=case when _equip then v_asset_key else null end where id=auth.uid();
  elsif k='bubble' then update public.profiles set chat_bubble_asset_key=case when _equip then v_asset_key else null end where id=auth.uid();
  elsif k='sound_wave' then update public.profiles set sound_wave_asset_key=case when _equip then v_asset_key else null end where id=auth.uid();
  elsif k='profile_card' then update public.profiles set profile_card_asset_key=case when _equip then v_asset_key else null end where id=auth.uid();
  else raise exception 'item_cannot_be_equipped'; end if;
end;
$function$;

create or replace function public.send_asset_to_user(
  _receiver uuid,_asset_key text,_asset_type text,_asset_name text,_hours integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = 'public', 'auth', 'pg_temp'
as $function$
declare v_id uuid; v_uid uuid:=auth.uid(); v_asset_key text; v_asset_name text; v_input text:=nullif(btrim(_asset_key),''); v_storage_path text; v_expires timestamptz;
begin
  if v_uid is null or not public.is_admin(v_uid) then raise exception 'admin_required'; end if;
  if _receiver is null or not exists(select 1 from public.profiles where id=_receiver) then raise exception 'user_not_found'; end if;
  if _receiver=v_uid then raise exception 'cannot_send_to_self'; end if;
  if _asset_type not in ('frame','entry','badge','bubble','sound_wave','profile_card') then raise exception 'invalid_asset_type'; end if;
  if _hours is null or _hours<0 or _hours>87600 then raise exception 'invalid_asset_duration'; end if;
  v_expires:=case when _hours=0 then null else now()+make_interval(hours=>_hours) end;
  if v_input is not null and strpos(v_input,'/storage/v1/object/')>0 then
    v_storage_path:=regexp_replace(split_part(v_input,'?',1),'^.*?/storage/v1/object/(sign|public|authenticated)/admin-assets/','');
  else v_storage_path:=regexp_replace(coalesce(v_input,''),'^/+',''); end if;
  select a.asset_key,coalesce(nullif(trim(_asset_name),''),a.name) into v_asset_key,v_asset_name
  from public.admin_assets a
  where a.is_active=true and (a.asset_key=v_input or a.id::text=v_input or a.url=v_input
    or coalesce(a.metadata->>'storage_path','')=v_input or coalesce(a.metadata->>'storage_path','')=v_storage_path
    or ltrim(coalesce(a.url,''),'/')=v_storage_path)
  order by case when a.asset_key=v_input then 0 when a.id::text=v_input then 1 when a.url=v_input then 2 else 3 end,a.created_at desc limit 1;
  if v_asset_key is null then raise exception 'asset_unavailable'; end if;
  if exists(select 1 from public.store_items where kind=_asset_type and asset_key=v_asset_key and coalesce(is_direct_grant,false)=false) then raise exception 'asset_already_in_store_upload_private_copy'; end if;
  insert into public.user_asset_grants(sender_id,receiver_id,asset_key,asset_type,asset_name,expires_at)
  values(v_uid,_receiver,v_asset_key,_asset_type,v_asset_name,v_expires) returning id into v_id;
  update public.admin_assets set is_private_direct=true where asset_key=v_asset_key;
  if _asset_type='frame' then update public.profiles set equipped_frame=v_asset_key where id=_receiver;
  elsif _asset_type='entry' then update public.profiles set equipped_entry=v_asset_key where id=_receiver;
  elsif _asset_type='badge' then
    insert into public.user_badges(user_id,badge_key,badge_name,badge_asset_key,badge_color,is_equipped)
    values(_receiver,v_asset_key,v_asset_name,v_asset_key,'#D4AF37',true)
    on conflict(user_id,badge_key) do update set is_equipped=true,badge_name=excluded.badge_name,badge_asset_key=excluded.badge_asset_key;
  elsif _asset_type='bubble' then update public.profiles set chat_bubble_asset_key=v_asset_key where id=_receiver;
  elsif _asset_type='sound_wave' then update public.profiles set sound_wave_asset_key=v_asset_key where id=_receiver;
  elsif _asset_type='profile_card' then update public.profiles set profile_card_asset_key=v_asset_key where id=_receiver;
  end if;
  perform public.write_audit('send_asset_to_user',_asset_type||':'||v_asset_key||case when v_expires is null then '' else ':expires='||v_expires::text end,_receiver,'user');
  return v_id;
end
$function$;

create or replace function public.enforce_user_asset_expirations(_user uuid default auth.uid())
returns void language plpgsql security definer set search_path=''
as $function$
begin
  if _user is null then raise exception 'not_authenticated'; end if;
  if auth.uid() is null or (auth.uid()<>_user and not public.is_admin(auth.uid())) then raise exception 'not_allowed'; end if;
  update public.profiles p set equipped_frame=null where p.id=_user and p.equipped_frame is not null
    and exists(select 1 from public.user_asset_grants g where g.receiver_id=_user and g.asset_type='frame' and g.asset_key=p.equipped_frame and g.expires_at is not null and g.expires_at<=now())
    and not exists(select 1 from public.user_asset_grants g where g.receiver_id=_user and g.asset_type='frame' and g.asset_key=p.equipped_frame and (g.expires_at is null or g.expires_at>now()));
  update public.profiles p set equipped_entry=null where p.id=_user and p.equipped_entry is not null
    and exists(select 1 from public.user_asset_grants g where g.receiver_id=_user and g.asset_type='entry' and g.asset_key=p.equipped_entry and g.expires_at is not null and g.expires_at<=now())
    and not exists(select 1 from public.user_asset_grants g where g.receiver_id=_user and g.asset_type='entry' and g.asset_key=p.equipped_entry and (g.expires_at is null or g.expires_at>now()));
  update public.profiles p set chat_bubble_asset_key=null where p.id=_user and p.chat_bubble_asset_key is not null
    and exists(select 1 from public.user_asset_grants g where g.receiver_id=_user and g.asset_type='bubble' and g.asset_key=p.chat_bubble_asset_key and g.expires_at is not null and g.expires_at<=now())
    and not exists(select 1 from public.user_asset_grants g where g.receiver_id=_user and g.asset_type='bubble' and g.asset_key=p.chat_bubble_asset_key and (g.expires_at is null or g.expires_at>now()));
  update public.profiles p set sound_wave_asset_key=null where p.id=_user and p.sound_wave_asset_key is not null
    and exists(select 1 from public.user_asset_grants g where g.receiver_id=_user and g.asset_type='sound_wave' and g.asset_key=p.sound_wave_asset_key and g.expires_at is not null and g.expires_at<=now())
    and not exists(select 1 from public.user_asset_grants g where g.receiver_id=_user and g.asset_type='sound_wave' and g.asset_key=p.sound_wave_asset_key and (g.expires_at is null or g.expires_at>now()));
  update public.profiles p set profile_card_asset_key=null where p.id=_user and p.profile_card_asset_key is not null
    and exists(select 1 from public.user_asset_grants g where g.receiver_id=_user and g.asset_type='profile_card' and g.asset_key=p.profile_card_asset_key and g.expires_at is not null and g.expires_at<=now())
    and not exists(select 1 from public.user_asset_grants g where g.receiver_id=_user and g.asset_type='profile_card' and g.asset_key=p.profile_card_asset_key and (g.expires_at is null or g.expires_at>now()));
end
$function$;

revoke execute on function public.enforce_user_asset_expirations(uuid) from public,anon;
grant execute on function public.enforce_user_asset_expirations(uuid) to authenticated;
revoke execute on function public.admin_save_store_item(uuid,text,text,text,text,bigint,integer,integer) from public,anon,authenticated;
grant execute on function public.admin_save_store_item(uuid,text,text,text,text,bigint,integer,integer) to authenticated;
revoke execute on function public.send_asset_to_user(uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.send_asset_to_user(uuid,text,text,text,integer) to authenticated;