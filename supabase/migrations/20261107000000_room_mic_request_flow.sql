-- Real room microphone request/approval flow.
create table if not exists public.room_mic_requests (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id) on delete set null
);
create unique index if not exists room_mic_requests_one_pending
  on public.room_mic_requests(room_id,user_id) where status='pending';
create index if not exists room_mic_requests_room_status
  on public.room_mic_requests(room_id,status,created_at);

grant select on public.room_mic_requests to authenticated;
grant all on public.room_mic_requests to service_role;
alter table public.room_mic_requests enable row level security;

drop policy if exists room_mic_requests_read on public.room_mic_requests;
create policy room_mic_requests_read on public.room_mic_requests
for select to authenticated using (
  user_id = (select auth.uid())
  or public.is_room_staff(room_id, (select auth.uid()))
);

create or replace function public.request_mic(_room uuid)
returns uuid
language plpgsql security definer set search_path=public
as $$
declare rid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from room_members where room_id=_room and user_id=auth.uid()) then
    raise exception 'join the room first';
  end if;
  if exists(select 1 from room_bans where room_id=_room and user_id=auth.uid()) then
    raise exception 'banned';
  end if;
  if exists(select 1 from room_seats where room_id=_room and user_id=auth.uid()) then
    raise exception 'already on mic';
  end if;
  insert into room_mic_requests(room_id,user_id,status)
    values (_room,auth.uid(),'pending')
    on conflict (room_id,user_id) where status='pending' do nothing
    returning id into rid;
  if rid is null then
    select id into rid from room_mic_requests
      where room_id=_room and user_id=auth.uid() and status='pending'
      limit 1;
  end if;
  return rid;
end $$;

create or replace function public.decide_mic_request(_request uuid, _accept boolean)
returns void
language plpgsql security definer set search_path=public
as $$
declare req room_mic_requests;
       free_seat int;
begin
  select * into req from room_mic_requests where id=_request for update;
  if not found then raise exception 'request not found'; end if;
  if not public.is_room_staff(req.room_id, auth.uid()) then raise exception 'not allowed'; end if;
  if req.status <> 'pending' then raise exception 'request already decided'; end if;

  if not _accept then
    update room_mic_requests
      set status='rejected', decided_at=now(), decided_by=auth.uid()
      where id=req.id;
    return;
  end if;

  select seat_index into free_seat
    from room_seats
    where room_id=req.room_id and user_id is null and not is_locked
    order by seat_index
    limit 1
    for update skip locked;
  if free_seat is null then raise exception 'no free mic seat'; end if;

  update room_seats
    set user_id=req.user_id, is_muted=false, updated_at=now()
    where room_id=req.room_id and seat_index=free_seat;

  update room_mic_requests
    set status='approved', decided_at=now(), decided_by=auth.uid()
    where id=req.id;
end $$;

create or replace function public.cancel_mic_request(_request uuid)
returns void
language plpgsql security definer set search_path=public
as $$
begin
  update room_mic_requests
    set status='cancelled', decided_at=now(), decided_by=auth.uid()
    where id=_request and user_id=auth.uid() and status='pending';
end $$;

alter publication supabase_realtime add table public.room_mic_requests;
