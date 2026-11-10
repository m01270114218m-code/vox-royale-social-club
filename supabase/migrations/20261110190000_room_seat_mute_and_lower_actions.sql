-- Separate microphone mute from removing a user from the mic.
-- Owners can moderate all room members; moderators cannot target the owner or peer moderators.
create or replace function public.staff_room_member_seat_action(
  _room uuid,
  _user uuid,
  _action text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_owner uuid;
  v_seat integer;
  v_vip integer := 0;
begin
  if v_actor is null or not public.is_room_staff(_room, v_actor) then
    raise exception 'not allowed';
  end if;

  select r.owner_id into v_owner from public.rooms r where r.id = _room;
  if v_owner is null then raise exception 'room not found'; end if;
  if _user = v_actor or _user = v_owner then raise exception 'cannot_moderate_owner'; end if;

  if v_actor <> v_owner and exists (
    select 1 from public.room_moderators rm
    where rm.room_id = _room and rm.user_id = _user
  ) then
    raise exception 'cannot_moderate_peer';
  end if;

  select rs.seat_index into v_seat
  from public.room_seats rs
  where rs.room_id = _room and rs.user_id = _user
  for update;
  if v_seat is null then raise exception 'user_not_on_mic'; end if;

  select coalesce(p.vip_level, 0) into v_vip
  from public.profiles p where p.id = _user;

  if _action = 'mute' then
    if v_actor <> v_owner and public.vip_has_moderation_protection(v_vip) then
      raise exception 'vip_protected';
    end if;
    update public.room_seats set is_muted = true, updated_at = now()
    where room_id = _room and seat_index = v_seat and user_id = _user;
  elsif _action = 'unmute' then
    update public.room_seats set is_muted = false, updated_at = now()
    where room_id = _room and seat_index = v_seat and user_id = _user;
  elsif _action = 'lower' then
    if v_actor <> v_owner and v_vip >= 4 then raise exception 'vip_protected'; end if;
    update public.room_seats set user_id = null, is_muted = false, updated_at = now()
    where room_id = _room and seat_index = v_seat and user_id = _user;
  else
    raise exception 'unknown_action';
  end if;
end;
$function$;

revoke all on function public.staff_room_member_seat_action(uuid, uuid, text) from public, anon;
grant execute on function public.staff_room_member_seat_action(uuid, uuid, text) to authenticated;
