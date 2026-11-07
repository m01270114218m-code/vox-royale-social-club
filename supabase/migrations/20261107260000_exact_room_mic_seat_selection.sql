-- Keep exactly the configured number of numbered mic seats for every room.
-- Seat indexes are zero-based in storage and displayed to users as 1..seat_count.
create or replace function public.ensure_room_seats(_room uuid)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog','public','auth','pg_temp'
as $function$
declare
  v_count integer;
begin
  select greatest(coalesce(r.seat_count, 0), 0)
    into v_count
  from public.rooms r
  where r.id = _room;

  if v_count is null then
    raise exception 'room not found';
  end if;

  insert into public.room_seats (room_id, seat_index, user_id, is_locked, is_muted)
  select _room, n, null, false, false
  from generate_series(0, v_count - 1) as n
  on conflict (room_id, seat_index) do nothing;
end
$function$;

create or replace function public.ensure_room_seats_after_room_change()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','public','auth','pg_temp'
as $function$
begin
  perform public.ensure_room_seats(new.id);
  return new;
end
$function$;

drop trigger if exists rooms_ensure_mic_seats on public.rooms;
create trigger rooms_ensure_mic_seats
after insert or update of seat_count on public.rooms
for each row execute function public.ensure_room_seats_after_room_change();

-- Backfill all currently configured seats for existing rooms.
select public.ensure_room_seats(r.id) from public.rooms r;

-- Assign the exact seat requested by the user. Moving from one seat to another
-- is atomic and never falls back to a different seat.
create or replace function public.take_seat(_room uuid, _seat integer)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog','public','private','auth','extensions','pg_temp'
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_count integer;
  v_locked boolean;
  v_target_user uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from public.room_members rm
    where rm.room_id = _room and rm.user_id = v_uid
  ) then
    raise exception 'join room first';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(_room::text || ':' || v_uid::text, 0)
  );

  select greatest(coalesce(r.seat_count, 0), 0)
    into v_count
  from public.rooms r
  where r.id = _room;

  if v_count is null then
    raise exception 'room not found';
  end if;

  if _seat is null or _seat < 0 or _seat >= v_count then
    raise exception 'invalid mic number';
  end if;

  perform public.ensure_room_seats(_room);

  select rs.is_locked, rs.user_id
    into v_locked, v_target_user
  from public.room_seats rs
  where rs.room_id = _room and rs.seat_index = _seat
  for update;

  if not found then
    raise exception 'seat not found';
  end if;

  if v_locked then
    raise exception 'seat locked';
  end if;

  if v_target_user is not null and v_target_user <> v_uid then
    raise exception 'seat occupied';
  end if;

  -- Already on the requested seat: do not reset or duplicate membership.
  if v_target_user = v_uid then
    return;
  end if;

  update public.room_seats
    set user_id = null, is_muted = false, updated_at = now()
  where room_id = _room and user_id = v_uid;

  update public.room_seats
    set user_id = v_uid, is_muted = false, updated_at = now()
  where room_id = _room and seat_index = _seat;
end
$function$;

grant execute on function public.take_seat(uuid, integer) to authenticated;
