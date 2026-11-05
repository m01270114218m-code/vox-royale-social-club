-- Align the Android/web client room flows with the live Supabase schema.
-- Additive only: existing rows and balances are preserved.
alter table public.rooms
  add column if not exists category text not null default 'chat',
  add column if not exists description text,
  add column if not exists cover_url text,
  add column if not exists seat_count integer not null default 8;

alter table public.rooms drop constraint if exists rooms_seat_count_check;
alter table public.rooms add constraint rooms_seat_count_check check (seat_count between 1 and 8);

create or replace function public.create_room(
  _name text, _description text, _category text, _country text, _seat_count integer, _is_private boolean
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := (select auth.uid()); v_room uuid; v_count integer;
begin
  if v_uid is null then raise exception 'authentication required'; end if;
  if char_length(trim(coalesce(_name,''))) < 2 or char_length(trim(_name)) > 80 then raise exception 'invalid room name'; end if;
  if _seat_count < 1 or _seat_count > 8 then raise exception 'seat count must be between 1 and 8'; end if;
  select count(*) into v_count from public.rooms where owner_id=v_uid;
  if v_count >= 3 then raise exception 'max 3 rooms per user'; end if;
  insert into public.profiles(id,display_name) values(v_uid,'مستخدم جديد') on conflict(id) do nothing;
  insert into public.rooms(owner_id,name,topic,description,category,country,seat_count,join_mode)
  values(v_uid,trim(_name),coalesce(_description,''),coalesce(_description,''),coalesce(_category,'chat'),coalesce(_country,'EG'),_seat_count,case when coalesce(_is_private,false) then 'followers' else 'open' end)
  returning id into v_room;
  insert into public.room_members(room_id,user_id,role) values(v_room,v_uid,'owner') on conflict(room_id,user_id) do nothing;
  insert into public.room_seats(room_id,seat_number) select v_room,n::smallint from generate_series(0,_seat_count-1) n;
  update public.rooms set member_count=1 where id=v_room;
  return v_room;
end;
$$;

create or replace function public.join_room(_room uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := (select auth.uid()); v_owner uuid; v_mode text; v_banned boolean;
begin
  if v_uid is null then raise exception 'authentication required'; end if;
  select owner_id,join_mode into v_owner,v_mode from public.rooms where id=_room;
  if not found then raise exception 'room not found'; end if;
  if exists(select 1 from public.user_bans where user_id=v_uid and (banned_until is null or banned_until>now())) then raise exception 'banned'; end if;
  select is_banned into v_banned from public.room_members where room_id=_room and user_id=v_uid;
  if coalesce(v_banned,false) then raise exception 'banned'; end if;
  if v_mode='password' then raise exception 'password required'; end if;
  if v_mode='followers' and v_uid<>v_owner and not exists(select 1 from public.user_follows where follower_id=v_uid and followed_id=v_owner) then raise exception 'followers only'; end if;
  insert into public.room_members(room_id,user_id,role) values(_room,v_uid,'member') on conflict(room_id,user_id) do nothing;
  update public.rooms set member_count=(select count(*) from public.room_members where room_id=_room and not is_banned) where id=_room;
end;
$$;

create or replace function public.leave_room(_room uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'authentication required'; end if;
  if exists(select 1 from public.rooms where id=_room and owner_id=v_uid) then return; end if;
  delete from public.room_seats where room_id=_room and user_id=v_uid;
  delete from public.room_members where room_id=_room and user_id=v_uid;
  update public.rooms set member_count=(select count(*) from public.room_members where room_id=_room and not is_banned) where id=_room;
end;
$$;

create or replace function public.take_seat(_room uuid,_seat smallint) returns void
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'authentication required'; end if;
  if not exists(select 1 from public.room_members where room_id=_room and user_id=v_uid and not is_banned) then raise exception 'join the room first'; end if;
  if exists(select 1 from public.room_seats where room_id=_room and user_id=v_uid) then raise exception 'already seated'; end if;
  update public.room_seats set user_id=v_uid,is_muted=false
  where room_id=_room and seat_number=_seat and user_id is null and not is_locked;
  if not found then
    if exists(select 1 from public.room_seats where room_id=_room and seat_number=_seat and is_locked) then raise exception 'seat locked'; end if;
    raise exception 'seat taken';
  end if;
end;
$$;

create or replace function public.leave_seat(_room uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.room_seats set user_id=null,is_muted=false where room_id=_room and user_id=(select auth.uid());
end;
$$;

create or replace function public.toggle_my_mute(_room uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.room_seats set is_muted=not is_muted where room_id=_room and user_id=(select auth.uid());
  if not found then raise exception 'not seated'; end if;
end;
$$;

create or replace function public.staff_seat_action(_room uuid,_seat smallint,_action text) returns void
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := (select auth.uid());
begin
  if not exists(select 1 from public.rooms r where r.id=_room and (r.owner_id=v_uid or exists(select 1 from public.room_members m where m.room_id=r.id and m.user_id=v_uid and m.role in ('owner','admin') and not m.is_banned))) then raise exception 'not allowed'; end if;
  if _action='lock' then update public.room_seats set is_locked=true where room_id=_room and seat_number=_seat;
  elsif _action='unlock' then update public.room_seats set is_locked=false where room_id=_room and seat_number=_seat;
  elsif _action='mute' then update public.room_seats set is_muted=true where room_id=_room and seat_number=_seat;
  elsif _action='unmute' then update public.room_seats set is_muted=false where room_id=_room and seat_number=_seat;
  elsif _action='kick_seat' then update public.room_seats set user_id=null,is_muted=false where room_id=_room and seat_number=_seat;
  else raise exception 'invalid seat action'; end if;
end;
$$;

create or replace function public.ban_user(_room uuid,_user uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := (select auth.uid());
begin
  if not exists(select 1 from public.rooms r where r.id=_room and (r.owner_id=v_uid or exists(select 1 from public.room_members m where m.room_id=r.id and m.user_id=v_uid and m.role in ('owner','admin') and not m.is_banned))) then raise exception 'not allowed'; end if;
  if exists(select 1 from public.rooms where id=_room and owner_id=_user) then raise exception 'cannot ban owner'; end if;
  update public.room_members set is_banned=true where room_id=_room and user_id=_user;
  delete from public.room_seats where room_id=_room and user_id=_user;
  update public.rooms set member_count=(select count(*) from public.room_members where room_id=_room and not is_banned) where id=_room;
end;
$$;

create or replace function public.send_room_message(_room uuid,_body text) returns void
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'authentication required'; end if;
  if char_length(trim(coalesce(_body,'')))=0 or char_length(_body)>500 then raise exception 'invalid message'; end if;
  if not exists(select 1 from public.rooms where id=_room and chat_enabled) then raise exception 'chat disabled'; end if;
  if not exists(select 1 from public.room_members where room_id=_room and user_id=v_uid and not is_banned) then raise exception 'join the room first'; end if;
  insert into public.room_messages(room_id,user_id,body) values(_room,v_uid,trim(_body));
end;
$$;

create or replace function public.update_room(
  _room uuid,_name text,_description text,_category text,_is_private boolean,_cover_url text
) returns void
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := (select auth.uid());
begin
  if not exists(select 1 from public.rooms r where r.id=_room and (r.owner_id=v_uid or exists(select 1 from public.room_members m where m.room_id=r.id and m.user_id=v_uid and m.role in ('owner','admin') and not m.is_banned))) then raise exception 'not allowed'; end if;
  update public.rooms set name=trim(_name),topic=coalesce(_description,''),description=coalesce(_description,''),category=coalesce(_category,'chat'),
    join_mode=case when coalesce(_is_private,false) then 'followers' else 'open' end,
    cover=coalesce(nullif(_cover_url,''),cover),cover_url=nullif(_cover_url,'')
  where id=_room;
end;
$$;

create or replace function public.delete_room(_room uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := (select auth.uid());
begin
  if not exists(select 1 from public.rooms r where r.id=_room and (r.owner_id=v_uid or (select private.is_admin()))) then raise exception 'not allowed'; end if;
  delete from public.room_messages where room_id=_room;
  delete from public.room_seats where room_id=_room;
  delete from public.room_members where room_id=_room;
  delete from public.rooms where id=_room;
end;
$$;

grant execute on function public.create_room(text,text,text,text,integer,boolean) to authenticated;
grant execute on function public.join_room(uuid) to authenticated;
grant execute on function public.leave_room(uuid) to authenticated;
grant execute on function public.take_seat(uuid,smallint) to authenticated;
grant execute on function public.leave_seat(uuid) to authenticated;
grant execute on function public.toggle_my_mute(uuid) to authenticated;
grant execute on function public.staff_seat_action(uuid,smallint,text) to authenticated;
grant execute on function public.ban_user(uuid,uuid) to authenticated;
grant execute on function public.send_room_message(uuid,text) to authenticated;
grant execute on function public.update_room(uuid,text,text,text,boolean,text) to authenticated;
grant execute on function public.delete_room(uuid) to authenticated;
