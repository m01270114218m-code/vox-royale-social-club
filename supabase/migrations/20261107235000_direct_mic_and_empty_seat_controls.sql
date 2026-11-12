-- Direct mic access and empty-seat moderation fixes.
create or replace function public.take_any_seat(_room uuid)
returns integer
language plpgsql
security definer
set search_path to 'pg_catalog','public','private','auth','extensions','pg_temp'
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_seat integer;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.room_members where room_id=_room and user_id=v_uid) then
    raise exception 'join room first';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(_room::text || ':' || v_uid::text, 0));
  select seat_index into v_seat
  from public.room_seats
  where room_id=_room and user_id is null and not is_locked
  order by seat_index
  limit 1
  for update skip locked;
  if v_seat is null then raise exception 'no free mic seat'; end if;
  update public.room_seats set user_id=null,is_muted=false,updated_at=now()
    where room_id=_room and user_id=v_uid;
  update public.room_seats set user_id=v_uid,is_muted=false,updated_at=now()
    where room_id=_room and seat_index=v_seat;
  return v_seat;
end
$function$;
grant execute on function public.take_any_seat(uuid) to authenticated;

create or replace function public.staff_seat_action(_room uuid, _seat integer, _action text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_actor uuid:=auth.uid();
  v_target uuid;
  v_target_vip integer;
  v_owner uuid;
begin
  if v_actor is null or not public.is_room_staff(_room,v_actor) then raise exception 'not allowed'; end if;
  select owner_id into v_owner from public.rooms where id=_room;
  select user_id into v_target from public.room_seats where room_id=_room and seat_index=_seat for update;
  if not found then raise exception 'seat not found'; end if;
  if v_target is not null and v_target<>v_actor and v_actor<>v_owner then
    select coalesce(vip_level,0) into v_target_vip from public.profiles where id=v_target;
    if _action in ('mute','kick') and public.vip_has_moderation_protection(v_target_vip) then raise exception 'vip_protected'; end if;
  end if;
  if _action='mute' then
    update public.room_seats set is_muted=true,updated_at=now() where room_id=_room and seat_index=_seat;
  elsif _action='unmute' then
    update public.room_seats set is_muted=false,updated_at=now() where room_id=_room and seat_index=_seat;
  elsif _action='kick' then
    update public.room_seats set user_id=null,is_muted=false,updated_at=now() where room_id=_room and seat_index=_seat;
  elsif _action='lock' then
    update public.room_seats set is_locked=true,updated_at=now() where room_id=_room and seat_index=_seat;
  elsif _action='unlock' then
    update public.room_seats set is_locked=false,updated_at=now() where room_id=_room and seat_index=_seat;
  else raise exception 'invalid_action'; end if;
end
$function$;
grant execute on function public.staff_seat_action(uuid,integer,text) to authenticated;
