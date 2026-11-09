-- Allow room owners and appointed moderators to control occupied and empty seats.
create or replace function public.admin_seat_action(_room uuid, _seat integer, _action text)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not public.is_room_staff(_room, (select auth.uid())) then
    raise exception 'not allowed';
  end if;
  if _seat < 0 or _seat >= 20 then
    raise exception 'invalid_seat';
  end if;
  if _action = 'lock' then
    update public.room_seats set is_locked = true, updated_at = now()
    where room_id = _room and seat_index = _seat;
  elsif _action = 'unlock' then
    update public.room_seats set is_locked = false, updated_at = now()
    where room_id = _room and seat_index = _seat;
  elsif _action = 'mute' then
    update public.room_seats set is_muted = true, updated_at = now()
    where room_id = _room and seat_index = _seat;
  elsif _action = 'unmute' then
    update public.room_seats set is_muted = false, updated_at = now()
    where room_id = _room and seat_index = _seat;
  elsif _action = 'kick' then
    update public.room_seats set user_id = null, updated_at = now()
    where room_id = _room and seat_index = _seat;
  else
    raise exception 'unknown action';
  end if;
  if not found then raise exception 'seat_not_found'; end if;
end;
$function$;
revoke all on function public.admin_seat_action(uuid, integer, text) from public, anon;
grant execute on function public.admin_seat_action(uuid, integer, text) to authenticated;
