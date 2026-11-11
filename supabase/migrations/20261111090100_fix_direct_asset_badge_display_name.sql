-- Correct the display label stored for a directly delivered badge.
create or replace function public.send_asset_to_user(
  _receiver uuid, _asset_key text, _asset_type text, _asset_name text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_id uuid;
  v_uid uuid := auth.uid();
  v_item uuid;
  v_asset_key text;
  v_asset_name text;
  v_input text := nullif(btrim(_asset_key), '');
  v_storage_path text;
begin
  if v_uid is null or not public.is_admin(v_uid) then raise exception 'admin_required'; end if;
  if _receiver is null or not exists(select 1 from public.profiles where id = _receiver) then raise exception 'user_not_found'; end if;
  if _receiver = v_uid then raise exception 'cannot_send_to_self'; end if;
  if _asset_type not in ('frame','entry','badge','bubble','sound_wave','profile_card') then raise exception 'invalid_asset_type'; end if;
  if v_input is not null and strpos(v_input, '/storage/v1/object/') > 0 then
    v_storage_path := regexp_replace(split_part(v_input, '?', 1), '^.*?/storage/v1/object/(sign|public|authenticated)/admin-assets/', '');
  else
    v_storage_path := regexp_replace(coalesce(v_input,''), '^/+', '');
  end if;
  select a.asset_key, coalesce(nullif(trim(_asset_name),''),a.name)
    into v_asset_key, v_asset_name
  from public.admin_assets a
  where a.is_active = true
    and (a.asset_key = v_input or a.id::text = v_input or a.url = v_input
      or coalesce(a.metadata->>'storage_path','') = v_input
      or coalesce(a.metadata->>'storage_path','') = v_storage_path
      or ltrim(coalesce(a.url,''),'/') = v_storage_path)
  order by case when a.asset_key = v_input then 0 when a.id::text = v_input then 1 when a.url = v_input then 2 else 3 end, a.created_at desc
  limit 1;
  if v_asset_key is null then raise exception 'asset_unavailable'; end if;
  insert into public.user_asset_grants(sender_id, receiver_id, asset_key, asset_type, asset_name)
  values(v_uid, _receiver, v_asset_key, _asset_type, v_asset_name)
  returning id into v_id;
  if _asset_type in ('frame','entry','bubble','sound_wave','profile_card') then
    insert into public.store_items(kind,name,description,price,asset_key,sort_order,is_direct_grant)
    values(_asset_type,v_asset_name,'عنصر مرسل مباشرة',0,v_asset_key,999999,true)
    on conflict (kind,asset_key) where asset_key is not null do nothing
    returning id into v_item;
    if v_item is null then
      select id into v_item from public.store_items where kind = _asset_type and asset_key = v_asset_key limit 1;
    end if;
    insert into public.user_items(user_id,item_id) values(_receiver,v_item) on conflict do nothing;
  end if;
  if _asset_type = 'badge' then
    insert into public.user_badges(user_id,badge_key,badge_name,badge_asset_key,badge_color,is_equipped)
    values(_receiver,v_asset_key,v_asset_name,v_asset_key,'#D4AF37',true)
    on conflict (user_id,badge_key) do update
    set is_equipped = true, badge_name = excluded.badge_name, badge_asset_key = excluded.badge_asset_key;
  elsif _asset_type = 'bubble' then
    update public.profiles set chat_bubble_asset_key = v_asset_key where id = _receiver;
  elsif _asset_type = 'sound_wave' then
    update public.profiles set sound_wave_asset_key = v_asset_key where id = _receiver;
  elsif _asset_type = 'profile_card' then
    update public.profiles set profile_card_asset_key = v_asset_key where id = _receiver;
  end if;
  perform public.write_audit('send_asset_to_user', _asset_type || ':' || v_asset_key, _receiver, 'user');
  return v_id;
end
$function$;
revoke all on function public.send_asset_to_user(uuid,text,text,text) from public, anon;
grant execute on function public.send_asset_to_user(uuid,text,text,text) to authenticated;
