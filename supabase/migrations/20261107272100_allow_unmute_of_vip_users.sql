-- VIP moderation protection prevents applying a mute or kick, not removing a mute.
create or replace function public.staff_seat_action(_room uuid, _seat integer, _action text)
returns void language plpgsql security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_actor uuid := (select auth.uid());
  v_target uuid;
  v_target_vip integer;
  v_owner uuid;
  v_actor_is_room_mod boolean;
begin
  if v_actor is null or not public.is_room_staff(_room,v_actor) then raise exception 'not allowed'; end if;
  select owner_id into v_owner from public.rooms where id=_room;
  if v_owner is null then raise exception 'room not found'; end if;
  select exists(select 1 from public.room_moderators where room_id=_room and user_id=v_actor)
    into v_actor_is_room_mod;
  select user_id into v_target from public.room_seats
    where room_id=_room and seat_index=_seat for update;
  if not found then raise exception 'seat not found'; end if;
  if v_actor_is_room_mod and v_target is not null and v_target<>v_actor then
    if v_target=v_owner then raise exception 'cannot_moderate_owner'; end if;
    if exists(select 1 from public.room_moderators where room_id=_room and user_id=v_target) then
      raise exception 'cannot_moderate_peer';
    end if;
  end if;
  if v_target is not null and v_target<>v_actor and v_actor<>v_owner then
    select coalesce(vip_level,0) into v_target_vip from public.profiles where id=v_target;
    if _action in ('mute','kick') and public.vip_has_moderation_protection(v_target_vip) then
      raise exception 'vip_protected';
    end if;
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
  else
    raise exception 'invalid_action';
  end if;
end $$;
revoke all on function public.staff_seat_action(uuid,integer,text) from public, anon;
grant execute on function public.staff_seat_action(uuid,integer,text) to authenticated;
