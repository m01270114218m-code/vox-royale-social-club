-- Prevent one account from occupying multiple voice seats in the same room.
create unique index if not exists room_seats_one_user_per_room
  on public.room_seats (room_id, user_id)
  where user_id is not null;

-- Serialize concurrent mic approvals for the same account/room.
create or replace function public.decide_mic_request(_request uuid, _accept boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  req public.room_mic_requests;
  free_seat int;
  existing_seat int;
begin
  select * into req
  from public.room_mic_requests
  where id = _request
  for update;

  if not found then raise exception 'request not found'; end if;
  if not public.is_room_staff(req.room_id, auth.uid()) then raise exception 'not allowed'; end if;
  if req.status <> 'pending' then raise exception 'request already decided'; end if;

  if not _accept then
    update public.room_mic_requests
      set status='rejected', decided_at=now(), decided_by=auth.uid()
      where id=req.id;
    return;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(req.room_id::text || ':' || req.user_id::text, 0)
  );

  select seat_index into existing_seat
  from public.room_seats
  where room_id=req.room_id and user_id=req.user_id
  order by seat_index
  limit 1
  for update;

  if existing_seat is not null then
    update public.room_mic_requests
      set status='approved', decided_at=now(), decided_by=auth.uid()
      where id=req.id;
    return;
  end if;

  select seat_index into free_seat
  from public.room_seats
  where room_id=req.room_id and user_id is null and not is_locked
  order by seat_index
  limit 1
  for update skip locked;

  if free_seat is null then raise exception 'no free mic seat'; end if;

  update public.room_seats
    set user_id=req.user_id, is_muted=false, updated_at=now()
    where room_id=req.room_id and seat_index=free_seat;

  update public.room_mic_requests
    set status='approved', decided_at=now(), decided_by=auth.uid()
    where id=req.id;
end
$function$;

revoke execute on function public.decide_mic_request(uuid, boolean) from anon;
grant execute on function public.decide_mic_request(uuid, boolean) to authenticated;
