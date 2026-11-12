-- Voice rooms use direct mic access by default. No request/approval flow.
alter table public.rooms
  alter column mic_mode set default 'direct';

update public.rooms
set mic_mode = 'direct'
where mic_mode <> 'direct' or mic_mode is null;

create or replace function public.update_room_mic_mode(_room uuid, _mode text)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog','public','private','auth','extensions','pg_temp'
as $function$
begin
  if not public.is_room_staff(_room,(select auth.uid())) then
    raise exception 'not allowed';
  end if;
  -- Direct mic is the only supported mode.
  update public.rooms set mic_mode='direct' where id=_room;
end
$function$;

grant execute on function public.update_room_mic_mode(uuid,text) to authenticated;
