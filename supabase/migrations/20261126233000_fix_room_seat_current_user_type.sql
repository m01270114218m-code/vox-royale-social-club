-- Fix room seat assignment: current_user is a PostgreSQL special identifier of type name.
-- Using it as a PL/pgSQL variable caused "operator does not exist: name <> uuid".
create or replace function public.set_room_seat(
  p_room_id uuid,
  p_seat_number integer,
  p_user_id uuid,
  p_seat_status text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  actor uuid := auth.uid();
  owner_mode boolean;
  current_seat_user uuid;
  result_row public.room_seats;
begin
  if actor is null then raise exception 'سجّل الدخول أولاً'; end if;
  if p_room_id is null or p_seat_number is null or p_seat_number < 0 or p_seat_number > 7 then
    raise exception 'رقم المقعد غير صحيح';
  end if;
  if p_seat_status not in ('available','locked','occupied','muted') then
    raise exception 'حالة المقعد غير صحيحة';
  end if;
  if not exists (select 1 from public.room_members where room_id=p_room_id and user_id=actor) then
    raise exception 'يجب أن تكون داخل الغرفة';
  end if;

  select exists(select 1 from public.rooms where id=p_room_id and owner_id=actor) into owner_mode;
  select rs.user_id into current_seat_user
  from public.room_seats rs
  where rs.room_id=p_room_id and rs.seat_number=p_seat_number
  for update;

  if p_user_id is not null then
    if p_user_id <> actor and not owner_mode then
      raise exception 'ليس لديك صلاحية تعيين مستخدم آخر';
    end if;
    if not exists(select 1 from public.room_members where room_id=p_room_id and user_id=p_user_id) then
      raise exception 'المستخدم ليس داخل الغرفة';
    end if;
    if p_seat_status not in ('occupied','muted') then
      raise exception 'حالة المقعد لا تطابق المستخدم';
    end if;
    if p_seat_status='muted' and not owner_mode then
      raise exception 'كتم المقعد من صلاحية مالك الغرفة';
    end if;
    if exists(select 1 from public.room_seats where room_id=p_room_id and user_id=p_user_id and seat_number<>p_seat_number) then
      raise exception 'المستخدم يشغل مقعداً آخر';
    end if;
    if current_seat_user is not null and current_seat_user <> actor and current_seat_user <> p_user_id and not owner_mode then
      raise exception 'المقعد مشغول';
    end if;
    update public.room_seats
      set user_id=null, seat_status='available', updated_at=now()
      where room_id=p_room_id and user_id=p_user_id and seat_number<>p_seat_number;
  else
    if p_seat_status='locked' and not owner_mode then
      raise exception 'قفل المقاعد من صلاحية مالك الغرفة';
    end if;
    if current_seat_user is not null and current_seat_user<>actor and not owner_mode then
      raise exception 'لا يمكنك إزالة مستخدم آخر من المقعد';
    end if;
    if p_seat_status='muted' or p_seat_status='occupied' then
      raise exception 'المقعد يحتاج مستخدماً';
    end if;
  end if;

  insert into public.room_seats(room_id,seat_number,user_id,seat_status,updated_at)
    values(p_room_id,p_seat_number,p_user_id,p_seat_status,now())
  on conflict(room_id,seat_number) do update
    set user_id=excluded.user_id, seat_status=excluded.seat_status, updated_at=now()
  returning * into result_row;

  return to_jsonb(result_row);
end;
$function$;
