-- Room member moderation controls requested for the Advanced room experience.
-- All sensitive mutations are SECURITY DEFINER RPCs with explicit room-role checks.

create table if not exists public.room_temporary_kicks (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kicked_by uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index if not exists room_temporary_kicks_expiry
  on public.room_temporary_kicks(room_id, expires_at);

create table if not exists public.room_chat_mutes (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  muted_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
alter table public.room_temporary_kicks enable row level security;
alter table public.room_chat_mutes enable row level security;
grant select on public.room_temporary_kicks, public.room_chat_mutes to authenticated;
drop policy if exists room_temporary_kicks_staff_read on public.room_temporary_kicks;
create policy room_temporary_kicks_staff_read on public.room_temporary_kicks
for select to authenticated using (public.is_room_staff(room_id, (select auth.uid())) or user_id=(select auth.uid()));
drop policy if exists room_chat_mutes_staff_read on public.room_chat_mutes;
create policy room_chat_mutes_staff_read on public.room_chat_mutes
for select to authenticated using (public.is_room_staff(room_id, (select auth.uid())) or user_id=(select auth.uid()));

-- Keep the existing permanent-ban behavior and also enforce active 24-hour kicks.
create or replace function public.join_room(_room uuid)
returns void language plpgsql security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if exists(select 1 from public.room_bans where room_id=_room and user_id=v_uid) then
    raise exception 'banned';
  end if;
  if exists(select 1 from public.room_temporary_kicks where room_id=_room and user_id=v_uid and expires_at > now()) then
    raise exception 'kicked_24h';
  end if;
  delete from public.room_temporary_kicks where room_id=_room and user_id=v_uid and expires_at <= now();
  insert into public.room_members(room_id,user_id) values (_room,v_uid)
    on conflict (room_id,user_id) do update set last_seen=now();
  update public.rooms set member_count=(select count(*) from public.room_members where room_id=_room) where id=_room;
end $$;

create or replace function public.send_room_message(_room uuid, _body text)
returns void language plpgsql security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from public.room_members where room_id=_room and user_id=v_uid) then
    raise exception 'join the room first';
  end if;
  if exists(select 1 from public.room_chat_mutes where room_id=_room and user_id=v_uid) then
    raise exception 'chat_muted';
  end if;
  if char_length(trim(coalesce(_body,''))) not between 1 and 500 then raise exception 'invalid message'; end if;
  if (select count(*) from public.room_messages where user_id=v_uid and created_at > now()-interval '10 seconds') >= 5 then
    raise exception 'slow down';
  end if;
  insert into public.room_messages(room_id,user_id,body) values (_room,v_uid,trim(_body));
end $$;

create or replace function public.staff_is_chat_muted(_room uuid, _user uuid)
returns boolean language plpgsql stable security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  if not public.is_room_staff(_room,(select auth.uid())) then raise exception 'not allowed'; end if;
  return exists(select 1 from public.room_chat_mutes where room_id=_room and user_id=_user);
end $$;

create or replace function public.staff_set_chat_mute(_room uuid, _user uuid, _muted boolean)
returns void language plpgsql security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare v_actor uuid := (select auth.uid()); v_owner uuid;
begin
  if v_actor is null or not public.is_room_staff(_room,v_actor) then raise exception 'not allowed'; end if;
  select owner_id into v_owner from public.rooms where id=_room;
  if _user=v_actor or _user=v_owner then raise exception 'cannot_moderate_owner'; end if;
  if v_actor<>v_owner and exists(select 1 from public.room_moderators where room_id=_room and user_id=_user) then
    raise exception 'cannot_moderate_peer';
  end if;
  if _muted then
    insert into public.room_chat_mutes(room_id,user_id,muted_by) values(_room,_user,v_actor)
    on conflict(room_id,user_id) do update set muted_by=excluded.muted_by,created_at=now();
  else
    delete from public.room_chat_mutes where room_id=_room and user_id=_user;
  end if;
end $$;

create or replace function public.staff_kick_room_user(_room uuid, _user uuid)
returns void language plpgsql security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare v_actor uuid := (select auth.uid()); v_owner uuid; v_vip integer;
begin
  if v_actor is null or not public.is_room_staff(_room,v_actor) then raise exception 'not allowed'; end if;
  select owner_id into v_owner from public.rooms where id=_room;
  if _user=v_actor or _user=v_owner then raise exception 'cannot_kick_owner'; end if;
  if v_actor<>v_owner and exists(select 1 from public.room_moderators where room_id=_room and user_id=_user) then
    raise exception 'cannot_moderate_peer';
  end if;
  select coalesce(vip_level,0) into v_vip from public.profiles where id=_user;
  if v_actor<>v_owner and public.vip_has_moderation_protection(v_vip) then raise exception 'vip_protected'; end if;
  delete from public.room_seats where room_id=_room and user_id=_user;
  delete from public.room_mic_requests where room_id=_room and user_id=_user and status='pending';
  delete from public.room_members where room_id=_room and user_id=_user;
  update public.rooms set member_count=(select count(*) from public.room_members where room_id=_room) where id=_room;
end $$;

create or replace function public.staff_kick_user_24h(_room uuid, _user uuid)
returns void language plpgsql security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare v_actor uuid := (select auth.uid()); v_owner uuid; v_vip integer;
begin
  if v_actor is null or not public.is_room_staff(_room,v_actor) then raise exception 'not allowed'; end if;
  select owner_id into v_owner from public.rooms where id=_room;
  if _user=v_actor or _user=v_owner then raise exception 'cannot_kick_owner'; end if;
  if v_actor<>v_owner and exists(select 1 from public.room_moderators where room_id=_room and user_id=_user) then
    raise exception 'cannot_moderate_peer';
  end if;
  select coalesce(vip_level,0) into v_vip from public.profiles where id=_user;
  if v_actor<>v_owner and public.vip_has_moderation_protection(v_vip) then raise exception 'vip_protected'; end if;
  insert into public.room_temporary_kicks(room_id,user_id,kicked_by,expires_at)
    values(_room,_user,v_actor,now()+interval '24 hours')
    on conflict(room_id,user_id) do update set kicked_by=excluded.kicked_by,expires_at=excluded.expires_at,created_at=now();
  delete from public.room_seats where room_id=_room and user_id=_user;
  delete from public.room_mic_requests where room_id=_room and user_id=_user and status='pending';
  delete from public.room_members where room_id=_room and user_id=_user;
  update public.rooms set member_count=(select count(*) from public.room_members where room_id=_room) where id=_room;
end $$;

create or replace function public.staff_set_room_moderator(_room uuid, _user uuid, _enabled boolean)
returns void language plpgsql security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare v_actor uuid := (select auth.uid()); v_owner uuid;
begin
  select owner_id into v_owner from public.rooms where id=_room;
  if v_actor is null or v_actor<>v_owner then raise exception 'owner_only'; end if;
  if _user=v_owner then raise exception 'owner_cannot_be_moderator'; end if;
  if not exists(select 1 from public.room_members where room_id=_room and user_id=_user) then
    raise exception 'user_not_in_room';
  end if;
  if _enabled then
    insert into public.room_moderators(room_id,user_id) values(_room,_user) on conflict do nothing;
  else
    delete from public.room_moderators where room_id=_room and user_id=_user;
  end if;
end $$;

create or replace function public.staff_invite_to_mic(_room uuid, _user uuid)
returns integer language plpgsql security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare v_actor uuid := (select auth.uid()); v_seat integer;
begin
  if v_actor is null or not public.is_room_staff(_room,v_actor) then raise exception 'not allowed'; end if;
  if not exists(select 1 from public.room_members where room_id=_room and user_id=_user) then
    raise exception 'user_not_in_room';
  end if;
  if exists(select 1 from public.room_seats where room_id=_room and user_id=_user) then
    raise exception 'already_on_mic';
  end if;
  select seat_index into v_seat from public.room_seats
    where room_id=_room and user_id is null and not is_locked
    order by seat_index limit 1 for update skip locked;
  if v_seat is null then raise exception 'no_free_mic'; end if;
  update public.room_seats set user_id=_user,is_muted=false,updated_at=now()
    where room_id=_room and seat_index=v_seat;
  return v_seat;
end $$;

-- Existing permanent ban is tightened so moderators cannot ban the owner or peer moderators.
create or replace function public.ban_user(_room uuid, _user uuid)
returns void language plpgsql security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare v_actor uuid := (select auth.uid()); v_owner uuid; v_vip integer;
begin
  if v_actor is null or not public.is_room_staff(_room,v_actor) then raise exception 'not allowed'; end if;
  select owner_id into v_owner from public.rooms where id=_room;
  if _user=v_actor or _user=v_owner then raise exception 'cannot_ban_owner'; end if;
  if v_actor<>v_owner and exists(select 1 from public.room_moderators where room_id=_room and user_id=_user) then
    raise exception 'cannot_moderate_peer';
  end if;
  select coalesce(vip_level,0) into v_vip from public.profiles where id=_user;
  if v_actor<>v_owner and public.vip_has_moderation_protection(v_vip) then raise exception 'vip_protected'; end if;
  insert into public.room_bans(room_id,user_id,banned_by) values(_room,_user,v_actor)
    on conflict(room_id,user_id) do update set banned_by=excluded.banned_by,created_at=now();
  delete from public.room_seats where room_id=_room and user_id=_user;
  delete from public.room_mic_requests where room_id=_room and user_id=_user and status='pending';
  delete from public.room_members where room_id=_room and user_id=_user;
  update public.rooms set member_count=(select count(*) from public.room_members where room_id=_room) where id=_room;
end $$;

revoke all on function public.staff_is_chat_muted(uuid,uuid) from public;
revoke all on function public.staff_set_chat_mute(uuid,uuid,boolean) from public;
revoke all on function public.staff_kick_room_user(uuid,uuid) from public;
revoke all on function public.staff_kick_user_24h(uuid,uuid) from public;
revoke all on function public.staff_set_room_moderator(uuid,uuid,boolean) from public;
revoke all on function public.staff_invite_to_mic(uuid,uuid) from public;
revoke all on function public.ban_user(uuid,uuid) from public;
grant execute on function public.staff_is_chat_muted(uuid,uuid) to authenticated;
grant execute on function public.staff_set_chat_mute(uuid,uuid,boolean) to authenticated;
grant execute on function public.staff_kick_room_user(uuid,uuid) to authenticated;
grant execute on function public.staff_kick_user_24h(uuid,uuid) to authenticated;
grant execute on function public.staff_set_room_moderator(uuid,uuid,boolean) to authenticated;
grant execute on function public.staff_invite_to_mic(uuid,uuid) to authenticated;
grant execute on function public.ban_user(uuid,uuid) to authenticated;

-- Publish moderation state changes to every connected room client.
do $$
begin
  if not exists(select 1 from pg_catalog.pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='room_chat_mutes') then
    alter publication supabase_realtime add table public.room_chat_mutes;
  end if;
  if not exists(select 1 from pg_catalog.pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='room_temporary_kicks') then
    alter publication supabase_realtime add table public.room_temporary_kicks;
  end if;
end $$;
