-- Deliver catalog gifts only to a real member of the same room.
-- The function also records the gift in the sender ledger and notifies the recipient.
create or replace function public.send_catalog_gift(
  p_catalog_id uuid,
  p_receiver_id uuid,
  p_room_id uuid,
  p_quantity integer default 1
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender uuid := auth.uid();
  v_price bigint;
  v_total bigint;
  v_name text;
begin
  if v_sender is null then raise exception 'سجل الدخول'; end if;
  if p_receiver_id is null or not exists(select 1 from profiles where id=p_receiver_id and not banned) then
    raise exception 'المستخدم غير موجود';
  end if;
  if p_receiver_id = v_sender then raise exception 'لا يمكن إرسال هدية لنفسك'; end if;
  if p_room_id is null then raise exception 'الغرفة غير محددة'; end if;
  if not exists(select 1 from room_members where room_id=p_room_id and user_id=v_sender) then
    raise exception 'يجب أن تكون داخل الغرفة';
  end if;
  if not exists(select 1 from room_members where room_id=p_room_id and user_id=p_receiver_id) then
    raise exception 'المستخدم ليس موجودًا في هذه الغرفة';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 520 then
    raise exception 'كمية غير صحيحة';
  end if;

  select price, name into v_price, v_name
  from app_catalog
  where id=p_catalog_id and kind='gift' and enabled and url is not null
  for update;
  if not found then raise exception 'الهدية غير متاحة'; end if;

  v_total := v_price * p_quantity;

  update profiles
  set coins = coins - v_total, updated_at = now()
  where id=v_sender and coins >= v_total;
  if not found then raise exception 'رصيد غير كاف'; end if;

  update profiles
  set gift_value = coalesce(gift_value,0) + v_total,
      diamonds = coalesce(diamonds,0) + v_total,
      updated_at = now()
  where id=p_receiver_id and not banned;
  if not found then raise exception 'تعذر إضافة الهدية للمستخدم'; end if;

  insert into coin_ledger(sender_id,recipient_id,amount,kind)
  values(v_sender,p_receiver_id,v_total,'gift');

  insert into app_notifications(user_id,title,body,kind,coins)
  values(
    p_receiver_id,
    'هدية جديدة',
    'أرسل لك مستخدم داخل الغرفة ' || v_name || ' ×' || p_quantity,
    'gift',
    0
  );

  return jsonb_build_object(
    'ok',true,
    'total',v_total,
    'receiver_id',p_receiver_id,
    'gift_name',v_name
  );
end;
$$;

revoke all on function public.send_catalog_gift(uuid,uuid,uuid,integer) from public;
grant execute on function public.send_catalog_gift(uuid,uuid,uuid,integer) to authenticated;
