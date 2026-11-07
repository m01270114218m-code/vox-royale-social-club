-- Fix ambiguous price variable and UUID/name operator collision in seat assignment.
create or replace function public.buy_item(_item_id uuid)
returns bigint language plpgsql
set search_path to 'pg_catalog','public','private','auth','extensions','pg_temp'
as $function$
declare v_price bigint;
begin
  select si.price into v_price from public.store_items si where si.id=_item_id;
  if v_price is null then raise exception 'item unavailable'; end if;
  update public.wallets set coins=coins-v_price,updated_at=now()
    where user_id=(select auth.uid()) and coins>=v_price;
  if not found then raise exception 'insufficient coins'; end if;
  insert into public.user_items(user_id,item_id) values((select auth.uid()),_item_id) on conflict do nothing;
  return v_price;
end
$function$;

create or replace function public.take_seat(_room uuid,_seat integer)
returns void language plpgsql
set search_path to 'pg_catalog','public','private','auth','extensions','pg_temp'
as $function$
declare v_uid uuid := (select auth.uid()); v_current_user_id uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from public.room_members rm where rm.room_id=_room and rm.user_id=v_uid) then raise exception 'join room first'; end if;
  select rs.user_id into v_current_user_id from public.room_seats rs
    where rs.room_id=_room and rs.seat_index=_seat for update;
  if not found then raise exception 'seat not found'; end if;
  if exists(select 1 from public.room_seats rs where rs.room_id=_room and rs.seat_index=_seat and rs.is_locked) then raise exception 'seat locked'; end if;
  if v_current_user_id is not null and v_current_user_id <> v_uid then raise exception 'seat occupied'; end if;
  update public.room_seats rs set user_id=null,updated_at=now() where rs.room_id=_room and rs.user_id=v_uid;
  update public.room_seats rs set user_id=v_uid,updated_at=now() where rs.room_id=_room and rs.seat_index=_seat;
end
$function$;