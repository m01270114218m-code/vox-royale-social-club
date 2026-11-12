-- Accept room-frame asset keys, registered Storage paths, and Storage object URLs.
-- Always persist the canonical active admin_assets.asset_key.
create or replace function public.set_room_frame(_room uuid, _asset_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_input text := nullif(btrim(_asset_key), '');
  v_storage_path text;
  v_asset_key text;
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then
    raise exception 'not allowed';
  end if;

  if not exists (select 1 from public.rooms where id = _room) then
    raise exception 'room_not_found';
  end if;

  if v_input is not null then
    if strpos(v_input, '/storage/v1/object/') > 0 then
      v_storage_path := regexp_replace(
        split_part(v_input, '?', 1),
        '^.*?/storage/v1/object/(sign|public|authenticated)/admin-assets/',
        ''
      );
    else
      v_storage_path := regexp_replace(v_input, '^/+', '');
    end if;

    select a.asset_key
      into v_asset_key
    from public.admin_assets a
    where a.is_active = true
      and (
        a.asset_key = v_input
        or coalesce(a.metadata->>'storage_path', '') = v_input
        or ltrim(coalesce(a.url, ''), '/') = v_storage_path
        or coalesce(a.metadata->>'storage_path', '') = v_storage_path
      )
    order by a.created_at desc
    limit 1;

    if v_asset_key is null then
      raise exception 'asset unavailable';
    end if;
  end if;

  update public.rooms
  set room_frame_asset_key = v_asset_key
  where id = _room;
end;
$function$;

revoke all on function public.set_room_frame(uuid, text) from public, anon;
grant execute on function public.set_room_frame(uuid, text) to authenticated;
