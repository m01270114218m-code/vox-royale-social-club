alter table public.rooms add column if not exists mic_mode text not null default 'request' check (mic_mode in ('request','direct'));

create or replace function public.update_room_mic_mode(_room uuid, _mode text)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private, auth, extensions, pg_temp
as $$
begin
  if not public.is_room_staff(_room,(select auth.uid())) then raise exception 'not allowed'; end if;
  if _mode not in ('request','direct') then raise exception 'invalid_mic_mode'; end if;
  update public.rooms set mic_mode=_mode where id=_room;
end $$;

grant execute on function public.update_room_mic_mode(uuid,text) to authenticated;

create or replace function public.ban_user(_room uuid, _user uuid)
returns void language plpgsql security definer
set search_path = public
as $$
declare v_actor uuid:=auth.uid(); v_vip integer;
begin
 if v_actor is null or not public.is_room_staff(_room,v_actor) then raise exception 'not allowed'; end if;
 if _user=v_actor then raise exception 'cannot_ban_self'; end if;
 select coalesce(vip_level,0) into v_vip from public.profiles where id=_user;
 if v_actor <> (select owner_id from public.rooms where id=_room) and public.vip_has_moderation_protection(v_vip) then raise exception 'vip_protected'; end if;
 insert into public.room_bans(room_id,user_id,banned_by) values(_room,_user,v_actor)
 on conflict(room_id,user_id) do update set banned_by=excluded.banned_by,banned_at=now();
 delete from public.room_seats where room_id=_room and user_id=_user;
 delete from public.room_members where room_id=_room and user_id=_user;
end $$;

create or replace function public.staff_seat_action(_room uuid, _seat integer, _action text)
returns void language plpgsql security definer
set search_path = public
as $$
declare v_actor uuid:=auth.uid(); v_target uuid; v_target_vip integer; v_owner uuid;
begin
 if v_actor is null or not public.is_room_staff(_room,v_actor) then raise exception 'not allowed'; end if;
 select owner_id into v_owner from public.rooms where id=_room;
 select user_id into v_target from public.room_seats where room_id=_room and seat_index=_seat for update;
 if v_target is null then raise exception 'seat empty'; end if;
 if v_target<>v_actor and v_actor<>v_owner then
   select coalesce(vip_level,0) into v_target_vip from public.profiles where id=v_target;
   if _action in ('mute','kick') and public.vip_has_moderation_protection(v_target_vip) then raise exception 'vip_protected'; end if;
 end if;
 if _action='mute' then update public.room_seats set is_muted=true,updated_at=now() where room_id=_room and seat_index=_seat;
 elsif _action='unmute' then update public.room_seats set is_muted=false,updated_at=now() where room_id=_room and seat_index=_seat;
 elsif _action='kick' then update public.room_seats set user_id=null,is_muted=false,updated_at=now() where room_id=_room and seat_index=_seat;
 elsif _action='lock' then update public.room_seats set is_locked=true,updated_at=now() where room_id=_room and seat_index=_seat;
 elsif _action='unlock' then update public.room_seats set is_locked=false,updated_at=now() where room_id=_room and seat_index=_seat;
 else raise exception 'invalid_action'; end if;
end $$;