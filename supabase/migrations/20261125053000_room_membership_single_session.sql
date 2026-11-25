alter table public.room_members
  add column if not exists last_seen_at timestamptz not null default now();

create or replace function public.join_room(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  existing_seen timestamptz;
begin
  if actor is null then raise exception 'سجّل الدخول أولاً'; end if;
  if exists(select 1 from public.profiles where id=actor and banned) then
    raise exception 'الحساب محظور';
  end if;
  if not private.can_join_room(p_room_id) then
    raise exception 'لا يمكن دخول هذه الغرفة';
  end if;

  select last_seen_at into existing_seen
  from public.room_members
  where room_id=p_room_id and user_id=actor
  for update;

  if found and existing_seen > now() - interval '60 seconds' then
    raise exception 'هذا الحساب موجود بالفعل في الغرفة على جهاز آخر';
  end if;

  insert into public.room_members(room_id,user_id,role,joined_at,last_seen_at)
  values(p_room_id,actor,'member',now(),now())
  on conflict(room_id,user_id) do update
    set joined_at=excluded.joined_at,last_seen_at=excluded.last_seen_at;

  return jsonb_build_object('ok',true);
end;
$$;

create or replace function public.heartbeat_room(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := auth.uid();
begin
  if actor is null then return false; end if;
  update public.room_members set last_seen_at=now()
  where room_id=p_room_id and user_id=actor;
  return found;
end;
$$;

create or replace function public.leave_room(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := auth.uid();
begin
  if actor is null then return false; end if;
  update public.room_seats
    set user_id=null,seat_status='available',updated_at=now()
    where room_id=p_room_id and user_id=actor;
  delete from public.room_members
    where room_id=p_room_id and user_id=actor;
  return true;
end;
$$;

revoke all on function public.join_room(uuid) from public, anon;
revoke all on function public.heartbeat_room(uuid) from public, anon;
revoke all on function public.leave_room(uuid) from public, anon;
grant execute on function public.join_room(uuid) to authenticated;
grant execute on function public.heartbeat_room(uuid) to authenticated;
grant execute on function public.leave_room(uuid) to authenticated;
