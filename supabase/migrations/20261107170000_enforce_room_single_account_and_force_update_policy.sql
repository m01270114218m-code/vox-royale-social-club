-- Enforce one account on at most one microphone seat in a room and add an admin-controlled force-update policy.
create unique index if not exists room_seats_one_user_per_room
  on public.room_seats(room_id, user_id)
  where user_id is not null;

create or replace function public.take_seat(_room uuid,_seat integer)
returns void
language plpgsql
set search_path to 'pg_catalog','public','private','auth','extensions','pg_temp'
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_current_user_id uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from public.room_members rm where rm.room_id=_room and rm.user_id=v_uid) then
    raise exception 'join room first';
  end if;
  select rs.user_id into v_current_user_id
    from public.room_seats rs
    where rs.room_id=_room and rs.seat_index=_seat
    for update;
  if not found then raise exception 'seat not found'; end if;
  if exists(select 1 from public.room_seats rs where rs.room_id=_room and rs.seat_index=_seat and rs.is_locked) then
    raise exception 'seat locked';
  end if;
  if v_current_user_id is not null and v_current_user_id <> v_uid then raise exception 'seat occupied'; end if;
  update public.room_seats
    set user_id=null, is_muted=false, updated_at=now()
    where room_id=_room and user_id=v_uid and seat_index<>_seat;
  update public.room_seats
    set user_id=v_uid, is_muted=false, updated_at=now()
    where room_id=_room and seat_index=_seat;
end
$function$;

create or replace function public.decide_mic_request(_request uuid, _accept boolean)
returns void
language plpgsql security definer set search_path=public
as $$
declare req public.room_mic_requests; free_seat int;
begin
  select * into req from public.room_mic_requests where id=_request for update;
  if not found then raise exception 'request not found'; end if;
  if not public.is_room_staff(req.room_id, auth.uid()) then raise exception 'not allowed'; end if;
  if req.status <> 'pending' then raise exception 'request already decided'; end if;
  if not _accept then
    update public.room_mic_requests set status='rejected', decided_at=now(), decided_by=auth.uid() where id=req.id;
    return;
  end if;
  if exists(select 1 from public.room_seats where room_id=req.room_id and user_id=req.user_id) then
    update public.room_mic_requests set status='approved', decided_at=now(), decided_by=auth.uid() where id=req.id;
    return;
  end if;
  select seat_index into free_seat from public.room_seats
    where room_id=req.room_id and user_id is null and not is_locked
    order by seat_index limit 1 for update skip locked;
  if free_seat is null then raise exception 'no free mic seat'; end if;
  update public.room_seats set user_id=req.user_id, is_muted=false, updated_at=now()
    where room_id=req.room_id and seat_index=free_seat;
  update public.room_mic_requests set status='approved', decided_at=now(), decided_by=auth.uid() where id=req.id;
end $$;

drop policy if exists "public app update policy read" on public.admin_settings;
create policy "public app update policy read" on public.admin_settings
for select to anon, authenticated using (key = 'app_update_policy');

insert into public.admin_settings(key,value,updated_at)
values ('app_update_policy', jsonb_build_object(
  'enabled', false, 'min_version', '1.0.0', 'blocked_versions', jsonb_build_array(),
  'latest_version', '1.0.0', 'download_url', '',
  'message', 'يتوفر إصدار جديد من صدي شات. يرجى تحديث التطبيق للمتابعة.'
), now())
on conflict (key) do nothing;

insert into public.admin_settings(key,value,updated_at)
values ('app_branding', jsonb_build_object('app_name','صدي شات','logo_path','','logo_url',''), now())
on conflict (key) do update set value=public.admin_settings.value || jsonb_build_object('app_name','صدي شات'), updated_at=now();

insert into public.admin_settings(key,value,updated_at)
values ('ui.branding', jsonb_build_object('app_name','صدي شات','logo_path','','logo_url',''), now())
on conflict (key) do update set value=public.admin_settings.value || jsonb_build_object('app_name','صدي شات'), updated_at=now();
