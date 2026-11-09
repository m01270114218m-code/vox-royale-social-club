do $block$
declare
  v_frame_key text;
begin
  select asset_key into v_frame_key
  from public.admin_assets
  where is_active = true
    and (asset_key ilike 'room_frame-%' or metadata->>'kind' = 'room_frame')
  order by created_at desc
  limit 1;

  if v_frame_key is not null then
    execute format(
      'alter table public.rooms alter column room_frame_asset_key set default %L',
      v_frame_key
    );
    update public.rooms
    set room_frame_asset_key = v_frame_key
    where room_frame_asset_key is null;
  end if;
end;
$block$;
