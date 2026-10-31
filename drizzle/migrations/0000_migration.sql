
create type public.app_role as enum ('super_admin','admin','moderator','user');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_no bigserial unique,
  display_name text not null default 'مستخدم',
  avatar_url text,
  bio text default '',
  country text default 'EG',
  gender text,
  show_gender boolean not null default true,
  birth_date date,
  show_age boolean not null default false,
  level int not null default 1,
  xp int not null default 0,
  vip_level int not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.profiles to authenticated;
grant update (display_name, avatar_url, bio, country, gender, show_gender, birth_date, show_age) on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles readable" on public.profiles for select to authenticated using (true);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id=_user_id and role=_role) $$;

create table public.wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  coins bigint not null default 0 check (coins >= 0),
  diamonds bigint not null default 0 check (diamonds >= 0),
  updated_at timestamptz not null default now()
);
grant select on public.wallets to authenticated;
grant all on public.wallets to service_role;
alter table public.wallets enable row level security;
create policy "own wallet" on public.wallets for select to authenticated using (user_id = auth.uid());

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1), 'مستخدم'), new.raw_user_meta_data->>'avatar_url');
  insert into public.wallets (user_id, coins) values (new.id, 1000);
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  room_no bigserial unique,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 40),
  description text default '' check (char_length(description) <= 300),
  category text not null default 'chat',
  country text not null default 'EG',
  cover_url text,
  is_private boolean not null default false,
  seat_count int not null default 8 check (seat_count in (4,6,8,9,12,16)),
  member_count int not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.rooms to authenticated;
grant all on public.rooms to service_role;
alter table public.rooms enable row level security;
create policy "rooms readable" on public.rooms for select to authenticated using (true);

create table public.room_moderators (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (room_id, user_id)
);
grant select on public.room_moderators to authenticated;
grant all on public.room_moderators to service_role;
alter table public.room_moderators enable row level security;
create policy "mods readable" on public.room_moderators for select to authenticated using (true);

create table public.room_bans (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  banned_by uuid not null,
  created_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
grant select on public.room_bans to authenticated;
grant all on public.room_bans to service_role;
alter table public.room_bans enable row level security;
create policy "bans readable by self or staff" on public.room_bans for select to authenticated using (true);

create table public.room_seats (
  room_id uuid not null references public.rooms(id) on delete cascade,
  seat_index int not null,
  user_id uuid references public.profiles(id) on delete set null,
  is_locked boolean not null default false,
  is_muted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (room_id, seat_index)
);
create unique index room_seats_one_per_user on public.room_seats(room_id, user_id) where user_id is not null;
grant select on public.room_seats to authenticated;
grant all on public.room_seats to service_role;
alter table public.room_seats enable row level security;
create policy "seats readable" on public.room_seats for select to authenticated using (true);

create table public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (room_id, user_id)
);
grant select on public.room_members to authenticated;
grant all on public.room_members to service_role;
alter table public.room_members enable row level security;
create policy "members readable" on public.room_members for select to authenticated using (true);

create table public.room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  kind text not null default 'text',
  created_at timestamptz not null default now()
);
create index on public.room_messages(room_id, created_at desc);
grant select on public.room_messages to authenticated;
grant all on public.room_messages to service_role;
alter table public.room_messages enable row level security;
create policy "messages readable" on public.room_messages for select to authenticated using (true);

-- helpers
create or replace function public.is_room_staff(_room uuid, _uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from rooms where id=_room and owner_id=_uid)
      or exists(select 1 from room_moderators where room_id=_room and user_id=_uid)
      or has_role(_uid,'super_admin') or has_role(_uid,'admin') $$;

create or replace function public.create_room(_name text, _description text, _category text, _country text, _seat_count int, _is_private boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare rid uuid; i int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if (select count(*) from rooms where owner_id = auth.uid()) >= 3 then raise exception 'max 3 rooms per user'; end if;
  insert into rooms(owner_id,name,description,category,country,seat_count,is_private)
  values (auth.uid(), trim(_name), coalesce(_description,''), _category, _country, _seat_count, _is_private) returning id into rid;
  for i in 0.._seat_count-1 loop insert into room_seats(room_id, seat_index) values (rid, i); end loop;
  return rid;
end $$;

create or replace function public.join_room(_room uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if exists(select 1 from room_bans where room_id=_room and user_id=auth.uid()) then raise exception 'banned'; end if;
  insert into room_members(room_id,user_id) values (_room, auth.uid())
    on conflict (room_id,user_id) do update set last_seen = now();
  update rooms set member_count = (select count(*) from room_members where room_id=_room) where id=_room;
end $$;

create or replace function public.leave_room(_room uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update room_seats set user_id=null, is_muted=false, updated_at=now() where room_id=_room and user_id=auth.uid();
  delete from room_members where room_id=_room and user_id=auth.uid();
  update rooms set member_count = (select count(*) from room_members where room_id=_room) where id=_room;
end $$;

create or replace function public.take_seat(_room uuid, _seat int) returns void
language plpgsql security definer set search_path = public as $$
declare s room_seats;
begin
  if not exists(select 1 from room_members where room_id=_room and user_id=auth.uid()) then raise exception 'join the room first'; end if;
  select * into s from room_seats where room_id=_room and seat_index=_seat for update;
  if not found then raise exception 'seat not found'; end if;
  if s.user_id is not null then raise exception 'seat taken'; end if;
  if s.is_locked and not is_room_staff(_room, auth.uid()) then raise exception 'seat locked'; end if;
  update room_seats set user_id=null, is_muted=false, updated_at=now() where room_id=_room and user_id=auth.uid();
  update room_seats set user_id=auth.uid(), is_muted=false, updated_at=now() where room_id=_room and seat_index=_seat;
end $$;

create or replace function public.leave_seat(_room uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update room_seats set user_id=null, is_muted=false, updated_at=now() where room_id=_room and user_id=auth.uid();
end $$;

create or replace function public.toggle_my_mute(_room uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update room_seats set is_muted = not is_muted, updated_at=now() where room_id=_room and user_id=auth.uid();
end $$;

create or replace function public.staff_seat_action(_room uuid, _seat int, _action text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_room_staff(_room, auth.uid()) then raise exception 'not allowed'; end if;
  if _action='lock' then update room_seats set is_locked=true, user_id=null, updated_at=now() where room_id=_room and seat_index=_seat;
  elsif _action='unlock' then update room_seats set is_locked=false, updated_at=now() where room_id=_room and seat_index=_seat;
  elsif _action='mute' then update room_seats set is_muted=true, updated_at=now() where room_id=_room and seat_index=_seat;
  elsif _action='unmute' then update room_seats set is_muted=false, updated_at=now() where room_id=_room and seat_index=_seat;
  elsif _action='kick_seat' then update room_seats set user_id=null, is_muted=false, updated_at=now() where room_id=_room and seat_index=_seat;
  else raise exception 'unknown action'; end if;
end $$;

create or replace function public.ban_user(_room uuid, _user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_room_staff(_room, auth.uid()) then raise exception 'not allowed'; end if;
  if _user = (select owner_id from rooms where id=_room) then raise exception 'cannot ban owner'; end if;
  insert into room_bans(room_id,user_id,banned_by) values (_room,_user,auth.uid()) on conflict do nothing;
  update room_seats set user_id=null where room_id=_room and user_id=_user;
  delete from room_members where room_id=_room and user_id=_user;
end $$;

create or replace function public.send_room_message(_room uuid, _body text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists(select 1 from room_members where room_id=_room and user_id=auth.uid()) then raise exception 'join the room first'; end if;
  if (select count(*) from room_messages where user_id=auth.uid() and created_at > now() - interval '10 seconds') >= 5 then raise exception 'slow down'; end if;
  insert into room_messages(room_id,user_id,body) values (_room, auth.uid(), trim(_body));
end $$;

create or replace function public.delete_room(_room uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists(select 1 from rooms where id=_room and owner_id=auth.uid()) and not has_role(auth.uid(),'super_admin') then raise exception 'not allowed'; end if;
  delete from rooms where id=_room;
end $$;

revoke execute on all functions in schema public from anon;

alter publication supabase_realtime add table public.room_seats;
alter publication supabase_realtime add table public.room_messages;
alter publication supabase_realtime add table public.room_members;
