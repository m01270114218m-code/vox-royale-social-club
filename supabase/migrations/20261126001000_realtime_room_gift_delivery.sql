-- Persist catalog gift sends as room-scoped realtime events.
-- Every active member of the room can see the same gift animation; the sender
-- balance and recipient gift value are still changed atomically by the RPC.

create table if not exists public.room_gift_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  receiver_id uuid not null references public.profiles(id),
  catalog_id uuid not null references public.app_catalog(id),
  gift_name text not null,
  quantity integer not null check (quantity between 1 and 520),
  total_price bigint not null check (total_price >= 0),
  metadata jsonb not null default '{}'::jsonb,
  lucky_multiplier integer not null default 0,
  lucky_win bigint not null default 0,
  created_at timestamptz not null default now()
);

alter table public.room_gift_events enable row level security;
revoke all on public.room_gift_events from anon, public;
grant select on public.room_gift_events to authenticated;

drop policy if exists room_members_read_gift_events on public.room_gift_events;
create policy room_members_read_gift_events on public.room_gift_events
for select to authenticated
using (
  exists (
    select 1
    from public.room_members rm
    where rm.room_id = room_gift_events.room_id
      and rm.user_id = (select auth.uid())
  )
);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'room_gift_events'
  ) then
    alter publication supabase_realtime add table public.room_gift_events;
  end if;
end $$;

create or replace function public.send_catalog_gift(
  p_catalog_id uuid,
  p_receiver_id uuid,
  p_room_id uuid,
  p_quantity integer default 1
) returns jsonb
language plpgsql
security definer
set search_path = ''
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
  if p_receiver_id is null or not exists (
    select 1 from public.profiles where id = p_receiver_id and not banned
  ) then raise exception 'المستخدم غير موجود'; end if;
  if p_receiver_id = v_sender then raise exception 'لا يمكن إرسال هدية لنفسك'; end if;
  if p_room_id is null then raise exception 'الغرفة غير محددة'; end if;
  if not exists (
    select 1 from public.room_members where room_id = p_room_id and user_id = v_sender
  ) then raise exception 'يجب أن تكون داخل الغرفة'; end if;
  if not exists (
    select 1 from public.room_members where room_id = p_room_id and user_id = p_receiver_id
  ) then raise exception 'المستخدم ليس موجودًا في هذه الغرفة'; end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 520 then
    raise exception 'كمية غير صحيحة';
  end if;

  select c.price, c.name, c.metadata
    into v_price, v_name, v_metadata
  from public.app_catalog c
  where c.id = p_catalog_id
    and c.kind = 'gift'
    and c.enabled
    and c.url is not null
  for update;
  if not found then raise exception 'الهدية غير متاحة'; end if;
  if v_price < 0 then raise exception 'سعر الهدية غير صالح'; end if;

  v_total := v_price * p_quantity;

  update public.profiles
    set coins = coins - v_total, updated_at = now()
    where id = v_sender and coins >= v_total;
  if not found then raise exception 'رصيد غير كاف'; end if;

  update public.profiles
    set gift_value = coalesce(gift_value, 0) + v_total,
        diamonds = coalesce(diamonds, 0) + v_total,
        updated_at = now()
    where id = p_receiver_id and not banned;
  if not found then raise exception 'تعذر إضافة الهدية للمستخدم'; end if;

  -- Lucky payouts are calculated on the server, never on the client.
  if coalesce(v_metadata->>'type', '') = 'lucky' then
    v_roll := random() * 100;
    v_lucky_x := case
      when v_roll < 0.02 then 500
      when v_roll < 0.32 then 50
      when v_roll < 2.32 then 10
      when v_roll < 5.32 then 5
      when v_roll < 10.32 then 2
      when v_roll < 30.32 then 1
      else 0
    end;
    v_lucky_win := v_total * v_lucky_x;
    if v_lucky_win > 0 then
      update public.profiles
        set coins = coins + v_lucky_win, updated_at = now()
        where id = v_sender;
      insert into public.coin_ledger(sender_id, recipient_id, amount, kind)
        values (v_sender, v_sender, v_lucky_win, 'lucky_win');
    end if;
  end if;

  insert into public.coin_ledger(sender_id, recipient_id, amount, kind)
    values (v_sender, p_receiver_id, v_total, 'gift');

  insert into public.app_notifications(user_id, title, body, kind, coins, catalog_id)
    values (
      p_receiver_id, 'هدية جديدة',
      'أرسل لك مستخدم داخل الغرفة ' || v_name || ' ×' || p_quantity,
      'gift', 0, p_catalog_id
    );

  insert into public.room_gift_events(
    room_id, sender_id, receiver_id, catalog_id, gift_name, quantity,
    total_price, metadata, lucky_multiplier, lucky_win
  ) values (
    p_room_id, v_sender, p_receiver_id, p_catalog_id, v_name, p_quantity,
    v_total, coalesce(v_metadata, '{}'::jsonb), v_lucky_x, v_lucky_win
  ) returning id into v_event_id;

  return jsonb_build_object(
    'ok', true,
    'total', v_total,
    'receiver_id', p_receiver_id,
    'gift_name', v_name,
    'event_id', v_event_id,
    'lucky_multiplier', v_lucky_x,
    'lucky_win', v_lucky_win
  );
end;
$function$;

revoke all on function public.send_catalog_gift(uuid, uuid, uuid, integer) from public, anon;
grant execute on function public.send_catalog_gift(uuid, uuid, uuid, integer) to authenticated;
