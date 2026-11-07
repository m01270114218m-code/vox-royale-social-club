-- Direct mic access: users do not need a mic request/approval.
-- Also make the specific-seat RPC resilient to a stale client seat snapshot.
create or replace function public.take_seat(_room uuid, _seat integer)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog','public','private','auth','extensions','pg_temp'
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_target integer;
  v_locked boolean;
  v_current_user_id uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  if not exists (
    select 1 from public.room_members
    where room_id=_room and user_id=v_uid
  ) then
    raise exception 'join room first';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(_room::text || ':' || v_uid::text, 0)
  );

  -- Prefer the requested seat. If the client is stale and that row no longer
  -- exists, fall back to the first real free/unlocked seat instead of
  -- returning the confusing "seat not found" error.
  select rs.seat_index, rs.is_locked, rs.user_id
    into v_target, v_locked, v_current_user_id
  from public.room_seats rs
  where rs.room_id=_room and rs.seat_index=_seat
  for update;

  if v_target is null then
    select rs.seat_index, rs.is_locked, rs.user_id
      into v_target, v_locked, v_current_user_id
    from public.room_seats rs
    where rs.room_id=_room
      and rs.user_id is null
      and not rs.is_locked
    order by rs.seat_index
    limit 1
    for update skip locked;

    if v_target is null then
      raise exception 'no free mic seat';
    end if;
  end if;

  if v_locked then
    raise exception 'seat locked';
  end if;

  if v_current_user_id is not null and v_current_user_id <> v_uid then
    raise exception 'seat occupied';
  end if;

  update public.room_seats
    set user_id=null,is_muted=false,updated_at=now()
    where room_id=_room and user_id=v_uid;

  update public.room_seats
    set user_id=v_uid,is_muted=false,updated_at=now()
    where room_id=_room and seat_index=v_target;
end
$function$;

grant execute on function public.take_seat(uuid,integer) to authenticated;
