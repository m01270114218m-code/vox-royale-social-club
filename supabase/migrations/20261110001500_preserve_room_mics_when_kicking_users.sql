-- Preserve room seat rows when removing a user so the mic layout remains stable.
CREATE OR REPLACE FUNCTION public.staff_kick_room_user(_room uuid, _user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth', 'pg_temp'
AS $function$
declare v_actor uuid := (select auth.uid()); v_owner uuid; v_vip integer;
begin
  if v_actor is null or not public.is_room_staff(_room,v_actor) then raise exception 'not allowed'; end if;
  select owner_id into v_owner from public.rooms where id=_room;
  if _user=v_actor or _user=v_owner then raise exception 'cannot_kick_owner'; end if;
  if v_actor<>v_owner and exists(select 1 from public.room_moderators where room_id=_room and user_id=_user) then raise exception 'cannot_moderate_peer'; end if;
  select coalesce(vip_level,0) into v_vip from public.profiles where id=_user;
  if v_actor<>v_owner and public.vip_has_moderation_protection(v_vip) then raise exception 'vip_protected'; end if;
  update public.room_seats set user_id=null,is_muted=false,updated_at=now() where room_id=_room and user_id=_user;
  delete from public.room_mic_requests where room_id=_room and user_id=_user and status='pending';
  delete from public.room_members where room_id=_room and user_id=_user;
  update public.rooms set member_count=(select count(*) from public.room_members where room_id=_room) where id=_room;
end $function$;

CREATE OR REPLACE FUNCTION public.staff_kick_user_24h(_room uuid, _user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth', 'pg_temp'
AS $function$
declare v_actor uuid := (select auth.uid()); v_owner uuid; v_vip integer;
begin
  if v_actor is null or not public.is_room_staff(_room,v_actor) then raise exception 'not allowed'; end if;
  select owner_id into v_owner from public.rooms where id=_room;
  if _user=v_actor or _user=v_owner then raise exception 'cannot_kick_owner'; end if;
  if v_actor<>v_owner and exists(select 1 from public.room_moderators where room_id=_room and user_id=_user) then raise exception 'cannot_moderate_peer'; end if;
  select coalesce(vip_level,0) into v_vip from public.profiles where id=_user;
  if v_actor<>v_owner and public.vip_has_moderation_protection(v_vip) then raise exception 'vip_protected'; end if;
  insert into public.room_temporary_kicks(room_id,user_id,kicked_by,expires_at)
    values(_room,_user,v_actor,now()+interval '24 hours')
    on conflict(room_id,user_id) do update set kicked_by=excluded.kicked_by,expires_at=excluded.expires_at,created_at=now();
  update public.room_seats set user_id=null,is_muted=false,updated_at=now() where room_id=_room and user_id=_user;
  delete from public.room_mic_requests where room_id=_room and user_id=_user and status='pending';
  delete from public.room_members where room_id=_room and user_id=_user;
  update public.rooms set member_count=(select count(*) from public.room_members where room_id=_room) where id=_room;
end $function$;

REVOKE ALL ON FUNCTION public.staff_kick_room_user(uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_kick_user_24h(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_kick_room_user(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_kick_user_24h(uuid,uuid) TO authenticated;
