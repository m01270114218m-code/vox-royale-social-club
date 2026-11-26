-- Mirrors the production migration 20261126004259.
-- app_catalog references app_assets by asset_id; it has no c.url column.
create or replace function public.send_catalog_gift(
  p_catalog_id uuid, p_receiver_id uuid, p_room_id uuid, p_quantity integer default 1
) returns jsonb
language plpgsql security definer set search_path = ''
as $function$
declare
  v_sender uuid := auth.uid();
  v_price bigint;
  v_total bigint;
  v_name text;
  v_metadata jsonb;
  v_event_id uuid;
  v_lucky_x integer := 0;
  v_lucky_win bigint := 0;
  v_roll numeric;
begin
  if v_sender is null then raise exception 'سجل الدخول'; end if;
  if p_receiver_id is null or not exists (select 1 from public.profiles where id=p_receiver_id and not banned) then raise exception 'المستخدم غير موجود'; end if;
  if p_receiver_id=v_sender then raise exception 'لا يمكن إرسال هدية لنفسك'; end if;
  if p_room_id is null then raise exception 'الغرفة غير محددة'; end if;
  if not exists(select 1 from public.room_members where room_id=p_room_id and user_id=v_sender) then raise exception 'يجب أن تكون داخل الغرفة'; end if;
  if not exists(select 1 from public.room_members where room_id=p_room_id and user_id=p_receiver_id) then raise exception 'المستخدم ليس موجودًا في هذه الغرفة'; end if;
  if p_quantity is null or p_quantity<1 or p_quantity>520 then raise exception 'كمية غير صحيحة'; end if;

  select c.price,c.name,c.metadata into v_price,v_name,v_metadata
  from public.app_catalog c
  join public.app_assets a on a.id=c.asset_id and a.is_active=true and nullif(a.path,'') is not null
  where c.id=p_catalog_id and c.kind='gift' and c.enabled
  for update of c;
  if not found then raise exception 'الهدية غير متاحة أو ملفها غير نشط'; end if;
  if v_price<0 then raise exception 'سعر الهدية غير صالح'; end if;

  v_total:=v_price*p_quantity;
  update public.profiles set coins=coins-v_total,updated_at=now() where id=v_sender and coins>=v_total;
  if not found then raise exception 'رصيد غير كاف'; end if;
  update public.profiles set gift_value=coalesce(gift_value,0)+v_total,diamonds=coalesce(diamonds,0)+v_total,updated_at=now()
    where id=p_receiver_id and not banned;
  if not found then raise exception 'تعذر إضافة الهدية للمستخدم'; end if;

  if coalesce(v_metadata->>'type','')='lucky' then
    v_roll:=random()*100;
    v_lucky_x:=case when v_roll<0.02 then 500 when v_roll<0.32 then 50 when v_roll<2.32 then 10 when v_roll<5.32 then 5 when v_roll<10.32 then 2 when v_roll<30.32 then 1 else 0 end;
    v_lucky_win:=v_total*v_lucky_x;
    if v_lucky_win>0 then
      update public.profiles set coins=coins+v_lucky_win,updated_at=now() where id=v_sender;
      insert into public.coin_ledger(sender_id,recipient_id,amount,kind) values(v_sender,v_sender,v_lucky_win,'lucky_win');
    end if;
  end if;
  insert into public.coin_ledger(sender_id,recipient_id,amount,kind) values(v_sender,p_receiver_id,v_total,'gift');
  insert into public.app_notifications(user_id,title,body,kind,coins,catalog_id)
    values(p_receiver_id,'هدية جديدة','أرسل لك مستخدم داخل الغرفة '||v_name||' ×'||p_quantity,'gift',0,p_catalog_id);
  insert into public.room_gift_events(room_id,sender_id,receiver_id,catalog_id,gift_name,quantity,total_price,metadata,lucky_multiplier,lucky_win)
    values(p_room_id,v_sender,p_receiver_id,p_catalog_id,v_name,p_quantity,v_total,coalesce(v_metadata,'{}'::jsonb),v_lucky_x,v_lucky_win)
    returning id into v_event_id;
  return jsonb_build_object('ok',true,'total',v_total,'receiver_id',p_receiver_id,'gift_name',v_name,'event_id',v_event_id,'lucky_multiplier',v_lucky_x,'lucky_win',v_lucky_win);
end;
$function$;
revoke all on function public.send_catalog_gift(uuid,uuid,uuid,integer) from public,anon;
grant execute on function public.send_catalog_gift(uuid,uuid,uuid,integer) to authenticated;

create or replace function public.set_room_seat(
  p_room_id uuid,p_seat_number integer,p_user_id uuid,p_seat_status text
) returns jsonb
language plpgsql security definer set search_path = ''
as $function$
declare
  actor uuid:=auth.uid();
  owner_mode boolean;
  current_user uuid;
  result_row public.room_seats;
begin
  if actor is null then raise exception 'سجّل الدخول أولاً'; end if;
  if p_room_id is null or p_seat_number is null or p_seat_number<0 or p_seat_number>7 then raise exception 'رقم المقعد غير صحيح'; end if;
  if p_seat_status not in ('available','locked','occupied','muted') then raise exception 'حالة المقعد غير صحيحة'; end if;
  if not exists(select 1 from public.room_members where room_id=p_room_id and user_id=actor) then raise exception 'يجب أن تكون داخل الغرفة'; end if;
  select exists(select 1 from public.rooms where id=p_room_id and owner_id=actor) into owner_mode;
  select user_id into current_user from public.room_seats where room_id=p_room_id and seat_number=p_seat_number for update;

  if p_user_id is not null then
    if p_user_id<>actor and not owner_mode then raise exception 'ليس لديك صلاحية تعيين مستخدم آخر'; end if;
    if not exists(select 1 from public.room_members where room_id=p_room_id and user_id=p_user_id) then raise exception 'المستخدم ليس داخل الغرفة'; end if;
    if p_seat_status not in ('occupied','muted') then raise exception 'حالة المقعد لا تطابق المستخدم'; end if;
    if p_seat_status='muted' and not owner_mode then raise exception 'كتم المقعد من صلاحية مالك الغرفة'; end if;
    if exists(select 1 from public.room_seats where room_id=p_room_id and user_id=p_user_id and seat_number<>p_seat_number) then raise exception 'المستخدم يشغل مقعداً آخر'; end if;
    if current_user is not null and current_user<>actor and current_user<>p_user_id and not owner_mode then raise exception 'المقعد مشغول'; end if;
    update public.room_seats set user_id=null,seat_status='available',updated_at=now() where room_id=p_room_id and user_id=p_user_id and seat_number<>p_seat_number;
  else
    if p_seat_status='locked' and not owner_mode then raise exception 'قفل المقاعد من صلاحية مالك الغرفة'; end if;
    if current_user is not null and current_user<>actor and not owner_mode then raise exception 'لا يمكنك إزالة مستخدم آخر من المقعد'; end if;
    if p_seat_status in ('muted','occupied') then raise exception 'المقعد يحتاج مستخدماً'; end if;
  end if;

  insert into public.room_seats(room_id,seat_number,user_id,seat_status,updated_at) values(p_room_id,p_seat_number,p_user_id,p_seat_status,now())
  on conflict(room_id,seat_number) do update set user_id=excluded.user_id,seat_status=excluded.seat_status,updated_at=now()
  returning * into result_row;
  return to_jsonb(result_row);
end;
$function$;
revoke all on function public.set_room_seat(uuid,integer,uuid,text) from public,anon;
grant execute on function public.set_room_seat(uuid,integer,uuid,text) to authenticated;
