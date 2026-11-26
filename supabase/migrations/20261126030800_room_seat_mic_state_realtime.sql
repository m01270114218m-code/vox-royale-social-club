alter table public.room_seats
  add column if not exists mic_enabled boolean not null default false;

create or replace function public.normalize_room_seat_mic_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is null or new.seat_status = 'muted' then
    new.mic_enabled := false;
  elsif tg_op = 'INSERT' or new.user_id is distinct from old.user_id
     or new.seat_status is distinct from old.seat_status then
    new.mic_enabled := false;
  end if;
  return new;
end;
$$;

drop trigger if exists normalize_room_seat_mic_state on public.room_seats;
create trigger normalize_room_seat_mic_state
before insert or update of user_id, seat_status, mic_enabled on public.room_seats
for each row execute function public.normalize_room_seat_mic_state();

create or replace function public.set_room_seat_mic(p_room_id uuid, p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  result_row public.room_seats;
begin
  if actor is null then raise exception 'سجّل الدخول أولاً'; end if;
  if not exists (
    select 1 from public.room_members
    where room_id = p_room_id and user_id = actor
  ) then raise exception 'يجب أن تكون داخل الغرفة'; end if;

  update public.room_seats
  set mic_enabled = p_enabled, updated_at = now()
  where room_id = p_room_id
    and user_id = actor
    and seat_status = 'occupied'
  returning * into result_row;

  if result_row.id is null then
    if p_enabled and exists (
      select 1 from public.room_seats
      where room_id = p_room_id and user_id = actor and seat_status = 'muted'
    ) then raise exception 'المايك مكتوم من مشرف الغرفة'; end if;
    raise exception 'اصعد على مقعد أولاً لتشغيل المايك';
  end if;

  return to_jsonb(result_row);
end;
$$;

revoke all on function public.set_room_seat_mic(uuid, boolean) from public, anon;
grant execute on function public.set_room_seat_mic(uuid, boolean) to authenticated;
revoke all on function public.normalize_room_seat_mic_state() from public, anon, authenticated;

drop policy if exists room_members_can_receive_typing_broadcast on realtime.messages;
create policy room_members_can_receive_typing_broadcast
on realtime.messages
for select
to authenticated
using (
  extension = 'broadcast'
  and exists (
    select 1
    from public.room_members rm
    where rm.user_id = (select auth.uid())
      and rm.room_id = case
        when realtime.topic() ~ '^room-activity:[0-9a-fA-F-]{36}$'
        then split_part(realtime.topic(), ':', 2)::uuid
        else null
      end
  )
);

drop policy if exists room_members_can_send_typing_broadcast on realtime.messages;
create policy room_members_can_send_typing_broadcast
on realtime.messages
for insert
to authenticated
with check (
  extension = 'broadcast'
  and exists (
    select 1
    from public.room_members rm
    where rm.user_id = (select auth.uid())
      and rm.room_id = case
        when realtime.topic() ~ '^room-activity:[0-9a-fA-F-]{36}$'
        then split_part(realtime.topic(), ':', 2)::uuid
        else null
      end
  )
);
