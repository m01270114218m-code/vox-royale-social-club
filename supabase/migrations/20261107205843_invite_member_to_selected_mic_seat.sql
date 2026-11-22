-- Invite a chosen room member to the exact empty microphone seat selected by room staff.
create or replace function public.staff_invite_to_seat(_room uuid, _seat integer, _user uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_actor uuid := (select auth.uid());
  v_owner uuid;
  v_current_user uuid;
  v_locked boolean;
begin
  if v_actor is null or not public.is_room_staff(_room, v_actor) then
    raise exception 'not allowed';
  end if;

  select owner_id into v_owner from public.rooms where id = _room;
  if v_owner is null then raise exception 'room not found'; end if;
  if _user = v_owner or _user = v_actor then
    raise exception 'invalid_invited_user';
  end if;
  if not exists (
    select 1 from public.room_members
    where room_id = _room and user_id = _user
  ) then
    raise exception 'user_not_in_room';
  end if;
  if exists (
    select 1 from public.room_seats
    where room_id = _room and user_id = _user
  ) then
    raise exception 'already_on_mic';
  end if;

  select user_id, is_locked into v_current_user, v_locked
  from public.room_seats
  where room_id = _room and seat_index = _seat
  for update;

  if not found then raise exception 'seat_not_found'; end if;
  if v_locked then raise exception 'mic_locked'; end if;
  if v_current_user is not null then raise exception 'seat_occupied'; end if;

  update public.room_seats
  set user_id = _user, is_muted = false, updated_at = now()
  where room_id = _room and seat_index = _seat;

  update public.room_mic_requests
  set status = 'approved', decided_at = now(), decided_by = v_actor
  where room_id = _room and user_id = _user and status = 'pending';
end;
$$;

revoke all on function public.staff_invite_to_seat(uuid, integer, uuid) from public, anon;
grant execute on function public.staff_invite_to_seat(uuid, integer, uuid) to authenticated;
