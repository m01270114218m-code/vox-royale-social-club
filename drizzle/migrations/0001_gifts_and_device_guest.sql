
create table public.gifts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  emoji text not null,
  price int not null check (price > 0),
  tier text not null default 'normal',
  sort int not null default 0,
  active boolean not null default true
);
grant select on public.gifts to authenticated;
grant all on public.gifts to service_role;
alter table public.gifts enable row level security;
create policy "gifts readable" on public.gifts for select to authenticated using (active);

create table public.gift_transactions (
  id uuid primary key default gen_random_uuid(),
  gift_id uuid not null references public.gifts(id),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  quantity int not null default 1 check (quantity between 1 and 999),
  total_price int not null,
  created_at timestamptz not null default now()
);
create index on public.gift_transactions(room_id, created_at desc);
grant select on public.gift_transactions to authenticated;
grant all on public.gift_transactions to service_role;
alter table public.gift_transactions enable row level security;
create policy "room gifts readable" on public.gift_transactions for select to authenticated using (true);

create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  currency text not null,
  amount bigint not null,
  reason text not null,
  ref_id uuid,
  created_at timestamptz not null default now()
);
create index on public.wallet_transactions(user_id, created_at desc);
grant select on public.wallet_transactions to authenticated;
grant all on public.wallet_transactions to service_role;
alter table public.wallet_transactions enable row level security;
create policy "own wallet tx" on public.wallet_transactions for select to authenticated using (user_id = auth.uid());

create table public.device_accounts (
  device_hash text primary key,
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
grant all on public.device_accounts to service_role;
alter table public.device_accounts enable row level security;

create or replace function public.register_device(_device text) returns text
language plpgsql security definer set search_path = public as $$
declare existing uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if char_length(_device) < 16 then raise exception 'bad device'; end if;
  select user_id into existing from device_accounts where device_hash = _device;
  if existing is null then
    insert into device_accounts(device_hash, user_id) values (_device, auth.uid());
    update profiles set display_name = 'ضيف ' || display_no where id = auth.uid() and display_name in ('مستخدم','');
    return 'created';
  elsif existing = auth.uid() then return 'ok';
  else raise exception 'device already has an account';
  end if;
end $$;

create or replace function public.send_gift(_room uuid, _receiver uuid, _gift uuid, _qty int) returns void
language plpgsql security definer set search_path = public as $$
declare g gifts; total bigint; bal bigint; txid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if _qty < 1 or _qty > 999 then raise exception 'bad quantity'; end if;
  if _receiver = auth.uid() then raise exception 'cannot gift yourself'; end if;
  if not exists(select 1 from room_members where room_id=_room and user_id=auth.uid()) then raise exception 'join the room first'; end if;
  select * into g from gifts where id=_gift and active;
  if not found then raise exception 'gift unavailable'; end if;
  total := g.price::bigint * _qty;
  select coins into bal from wallets where user_id=auth.uid() for update;
  if bal is null or bal < total then raise exception 'insufficient coins'; end if;
  update wallets set coins = coins - total, updated_at=now() where user_id=auth.uid();
  insert into wallets(user_id) values (_receiver) on conflict do nothing;
  update wallets set diamonds = diamonds + total, updated_at=now() where user_id=_receiver;
  insert into gift_transactions(gift_id,sender_id,receiver_id,room_id,quantity,total_price) values (g.id,auth.uid(),_receiver,_room,_qty,total) returning id into txid;
  insert into wallet_transactions(user_id,currency,amount,reason,ref_id) values (auth.uid(),'coins',-total,'gift_sent',txid),(_receiver,'diamonds',total,'gift_received',txid);
  update profiles set xp = xp + total::int, level = 1 + floor(sqrt((xp + total)/100.0))::int where id=auth.uid();
  insert into room_messages(room_id,user_id,body,kind) values (_room, auth.uid(), g.emoji || ' ' || g.name || ' x' || _qty || '→' || coalesce((select display_name from profiles where id=_receiver),''), 'gift');
end $$;

create or replace function public.claim_daily_bonus() returns bigint
language plpgsql security definer set search_path = public as $$
begin
  if exists(select 1 from wallet_transactions where user_id=auth.uid() and reason='daily_bonus' and created_at > now() - interval '20 hours') then raise exception 'already claimed'; end if;
  update wallets set coins = coins + 200, updated_at=now() where user_id=auth.uid();
  insert into wallet_transactions(user_id,currency,amount,reason) values (auth.uid(),'coins',200,'daily_bonus');
  return 200;
end $$;

revoke execute on all functions in schema public from anon;
alter publication supabase_realtime add table public.gift_transactions;
