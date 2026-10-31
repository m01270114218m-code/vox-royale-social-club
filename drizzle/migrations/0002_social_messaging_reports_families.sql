
alter table public.profiles add column if not exists deletion_requested_at timestamptz;

create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
grant select, insert, delete on public.follows to authenticated;
grant all on public.follows to service_role;
alter table public.follows enable row level security;
create policy "follows readable" on public.follows for select to authenticated using (true);
create policy "follow self" on public.follows for insert to authenticated with check (follower_id = auth.uid());
create policy "unfollow self" on public.follows for delete to authenticated using (follower_id = auth.uid());

create table public.profile_visits (
  visitor_id uuid not null references public.profiles(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  visited_at timestamptz not null default now(),
  primary key (visitor_id, profile_id)
);
grant select on public.profile_visits to authenticated;
grant all on public.profile_visits to service_role;
alter table public.profile_visits enable row level security;
create policy "own visits" on public.profile_visits for select to authenticated using (profile_id = auth.uid() or visitor_id = auth.uid());

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 1000),
  image_url text,
  like_count int not null default 0,
  comment_count int not null default 0,
  created_at timestamptz not null default now(),
  check (char_length(body) > 0 or image_url is not null)
);
create index on public.posts(created_at desc);
grant select, delete on public.posts to authenticated;
grant insert (user_id, body, image_url) on public.posts to authenticated;
grant all on public.posts to service_role;
alter table public.posts enable row level security;
create policy "posts readable" on public.posts for select to authenticated using (true);
create policy "posts insert own" on public.posts for insert to authenticated with check (user_id = auth.uid());
create policy "posts delete own" on public.posts for delete to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'super_admin'));

create table public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (post_id, user_id)
);
grant select, insert, delete on public.post_likes to authenticated;
grant all on public.post_likes to service_role;
alter table public.post_likes enable row level security;
create policy "likes readable" on public.post_likes for select to authenticated using (true);
create policy "like own" on public.post_likes for insert to authenticated with check (user_id = auth.uid());
create policy "unlike own" on public.post_likes for delete to authenticated using (user_id = auth.uid());

create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now()
);
grant select, delete on public.post_comments to authenticated;
grant insert (post_id, user_id, body) on public.post_comments to authenticated;
grant all on public.post_comments to service_role;
alter table public.post_comments enable row level security;
create policy "comments readable" on public.post_comments for select to authenticated using (true);
create policy "comment own" on public.post_comments for insert to authenticated with check (user_id = auth.uid());
create policy "delete own comment" on public.post_comments for delete to authenticated using (user_id = auth.uid());

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  actor_id uuid references public.profiles(id) on delete set null,
  ref_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.notifications(user_id, created_at desc);
grant select, delete on public.notifications to authenticated;
grant update (is_read) on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "own notifs" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "own notifs update" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own notifs delete" on public.notifications for delete to authenticated using (user_id = auth.uid());

create or replace function public.notify(_user uuid, _kind text, _title text, _body text, _actor uuid, _ref uuid) returns void
language sql security definer set search_path = public as $$
  insert into notifications(user_id,kind,title,body,actor_id,ref_id) select _user,_kind,_title,_body,_actor,_ref where _user is distinct from _actor $$;
revoke execute on function public.notify(uuid,text,text,text,uuid,uuid) from public, anon, authenticated;

create or replace function public.trg_counts() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner uuid; nm text;
begin
  if tg_table_name = 'post_likes' then
    if tg_op = 'INSERT' then
      update posts set like_count = like_count + 1 where id = new.post_id returning user_id into owner;
      select display_name into nm from profiles where id = new.user_id;
      perform notify(owner,'like','إعجاب جديد', nm || ' أعجب بمنشورك', new.user_id, new.post_id);
    else update posts set like_count = greatest(like_count - 1,0) where id = old.post_id; end if;
  elsif tg_table_name = 'post_comments' then
    if tg_op = 'INSERT' then
      update posts set comment_count = comment_count + 1 where id = new.post_id returning user_id into owner;
      select display_name into nm from profiles where id = new.user_id;
      perform notify(owner,'comment','تعليق جديد', nm || ': ' || left(new.body,80), new.user_id, new.post_id);
    else update posts set comment_count = greatest(comment_count - 1,0) where id = old.post_id; end if;
  elsif tg_table_name = 'follows' and tg_op = 'INSERT' then
    select display_name into nm from profiles where id = new.follower_id;
    perform notify(new.following_id,'follow','متابع جديد', nm || ' بدأ بمتابعتك', new.follower_id, null);
  end if;
  return null;
end $$;
create trigger likes_count after insert or delete on public.post_likes for each row execute function public.trg_counts();
create trigger comments_count after insert or delete on public.post_comments for each row execute function public.trg_counts();
create trigger follows_notify after insert on public.follows for each row execute function public.trg_counts();

-- Direct messages
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  last_message text,
  last_at timestamptz not null default now(),
  unique (user_a, user_b),
  check (user_a < user_b)
);
grant select on public.conversations to authenticated;
grant all on public.conversations to service_role;
alter table public.conversations enable row level security;
create policy "own convs" on public.conversations for select to authenticated using (auth.uid() in (user_a, user_b));

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.messages(conversation_id, created_at desc);
grant select on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;
create policy "conv members read" on public.messages for select to authenticated using (exists(select 1 from conversations c where c.id = conversation_id and auth.uid() in (c.user_a, c.user_b)));

create table public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  primary key (blocker_id, blocked_id)
);
grant select, insert, delete on public.user_blocks to authenticated;
grant all on public.user_blocks to service_role;
alter table public.user_blocks enable row level security;
create policy "own blocks" on public.user_blocks for select to authenticated using (blocker_id = auth.uid());
create policy "block" on public.user_blocks for insert to authenticated with check (blocker_id = auth.uid());
create policy "unblock" on public.user_blocks for delete to authenticated using (blocker_id = auth.uid());

create or replace function public.get_or_create_conversation(_other uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare a uuid; b uuid; cid uuid;
begin
  if auth.uid() is null or _other = auth.uid() then raise exception 'not allowed'; end if;
  a := least(auth.uid(), _other); b := greatest(auth.uid(), _other);
  insert into conversations(user_a,user_b) values (a,b) on conflict (user_a,user_b) do nothing;
  select id into cid from conversations where user_a=a and user_b=b;
  return cid;
end $$;

create or replace function public.send_dm(_conv uuid, _body text) returns void
language plpgsql security definer set search_path = public as $$
declare c conversations; other uuid; nm text;
begin
  select * into c from conversations where id=_conv;
  if not found or auth.uid() not in (c.user_a, c.user_b) then raise exception 'not allowed'; end if;
  other := case when c.user_a = auth.uid() then c.user_b else c.user_a end;
  if exists(select 1 from user_blocks where blocker_id=other and blocked_id=auth.uid()) then raise exception 'blocked'; end if;
  if (select count(*) from messages where sender_id=auth.uid() and created_at > now() - interval '10 seconds') >= 8 then raise exception 'slow down'; end if;
  insert into messages(conversation_id,sender_id,body) values (_conv, auth.uid(), trim(_body));
  update conversations set last_message = left(trim(_body),80), last_at = now() where id=_conv;
end $$;

create or replace function public.mark_conv_read(_conv uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update messages set read_at = now() where conversation_id=_conv and sender_id <> auth.uid() and read_at is null
    and exists(select 1 from conversations c where c.id=_conv and auth.uid() in (c.user_a,c.user_b));
end $$;

create or replace function public.visit_profile(_profile uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or auth.uid() = _profile then return; end if;
  insert into profile_visits(visitor_id,profile_id) values (auth.uid(),_profile)
    on conflict (visitor_id,profile_id) do update set visited_at = now();
end $$;

-- Reports & support tickets
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('user','room','post','message','support')),
  target_id uuid,
  category text not null,
  details text not null default '' check (char_length(details) <= 2000),
  evidence jsonb,
  status text not null default 'open',
  admin_reply text,
  created_at timestamptz not null default now()
);
grant select on public.reports to authenticated;
grant all on public.reports to service_role;
alter table public.reports enable row level security;
create policy "own reports" on public.reports for select to authenticated using (reporter_id = auth.uid() or public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'super_admin'));

create or replace function public.submit_report(_type text, _target uuid, _category text, _details text) returns uuid
language plpgsql security definer set search_path = public as $$
declare rid uuid; ev jsonb;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if (select count(*) from reports where reporter_id=auth.uid() and created_at > now() - interval '1 hour') >= 10 then raise exception 'slow down'; end if;
  if _type = 'room' then
    select jsonb_agg(jsonb_build_object('user',user_id,'body',body,'at',created_at)) into ev
    from (select user_id, body, created_at from room_messages where room_id=_target order by created_at desc limit 30) t;
  end if;
  insert into reports(reporter_id,target_type,target_id,category,details,evidence)
  values (auth.uid(),_type,_target,_category,left(coalesce(_details,''),2000),ev) returning id into rid;
  return rid;
end $$;

-- Families
create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 2 and 30),
  emblem text not null default '🛡️',
  description text default '' check (char_length(description) <= 300),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  points bigint not null default 0,
  member_count int not null default 1,
  created_at timestamptz not null default now()
);
grant select on public.families to authenticated;
grant all on public.families to service_role;
alter table public.families enable row level security;
create policy "families readable" on public.families for select to authenticated using (true);

create table public.family_members (
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  role text not null default 'member',
  status text not null default 'pending',
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id)
);
grant select on public.family_members to authenticated;
grant all on public.family_members to service_role;
alter table public.family_members enable row level security;
create policy "family members readable" on public.family_members for select to authenticated using (true);

create or replace function public.create_family(_name text, _emblem text, _description text) returns uuid
language plpgsql security definer set search_path = public as $$
declare fid uuid; bal bigint;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if exists(select 1 from family_members where user_id=auth.uid()) then raise exception 'already in a family'; end if;
  select coins into bal from wallets where user_id=auth.uid() for update;
  if bal < 5000 then raise exception 'insufficient coins'; end if;
  update wallets set coins = coins - 5000 where user_id=auth.uid();
  insert into families(name,emblem,description,owner_id) values (trim(_name), coalesce(nullif(_emblem,''),'🛡️'), coalesce(_description,''), auth.uid()) returning id into fid;
  insert into family_members(family_id,user_id,role,status) values (fid,auth.uid(),'owner','active');
  insert into wallet_transactions(user_id,currency,amount,reason,ref_id) values (auth.uid(),'coins',-5000,'family_created',fid);
  return fid;
end $$;

create or replace function public.request_join_family(_family uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o uuid; nm text;
begin
  if exists(select 1 from family_members where user_id=auth.uid()) then raise exception 'already in a family'; end if;
  insert into family_members(family_id,user_id) values (_family, auth.uid());
  select owner_id into o from families where id=_family;
  select display_name into nm from profiles where id=auth.uid();
  perform notify(o,'family','طلب انضمام للعائلة', nm || ' يريد الانضمام', auth.uid(), _family);
end $$;

create or replace function public.family_decide(_family uuid, _user uuid, _accept boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists(select 1 from family_members where family_id=_family and user_id=auth.uid() and role in ('owner','manager') and status='active') then raise exception 'not allowed'; end if;
  if _accept then
    update family_members set status='active', joined_at=now() where family_id=_family and user_id=_user and status='pending';
    perform notify(_user,'family','تم قبولك في العائلة','', auth.uid(), _family);
  else
    delete from family_members where family_id=_family and user_id=_user and status='pending';
  end if;
  update families set member_count = (select count(*) from family_members where family_id=_family and status='active') where id=_family;
end $$;

create or replace function public.leave_family() returns void
language plpgsql security definer set search_path = public as $$
declare fid uuid; r text;
begin
  select family_id, role into fid, r from family_members where user_id=auth.uid();
  if fid is null then return; end if;
  if r = 'owner' then delete from families where id=fid; return; end if;
  delete from family_members where user_id=auth.uid();
  update families set member_count = (select count(*) from family_members where family_id=fid and status='active') where id=fid;
end $$;

create or replace function public.request_account_deletion(_cancel boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update profiles set deletion_requested_at = case when _cancel then null else now() end where id = auth.uid();
end $$;

-- Gift notifications + family points
create or replace function public.trg_gift_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  select display_name into nm from profiles where id=new.sender_id;
  perform notify(new.receiver_id,'gift','وصلتك هدية', nm || ' أرسل لك هدية بقيمة ' || new.total_price, new.sender_id, new.room_id);
  update families set points = points + new.total_price where id = (select family_id from family_members where user_id=new.sender_id and status='active');
  return null;
end $$;
create trigger gift_notify after insert on public.gift_transactions for each row execute function public.trg_gift_notify();

-- system messages in rooms for joins and seats
create or replace function public.trg_room_system() returns trigger
language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  if tg_table_name = 'room_members' and tg_op = 'INSERT' then
    select display_name into nm from profiles where id=new.user_id;
    insert into room_messages(room_id,user_id,body,kind) values (new.room_id,new.user_id, nm || ' انضم إلى الغرفة','system');
  elsif tg_table_name = 'room_seats' and new.user_id is not null and new.user_id is distinct from old.user_id then
    select display_name into nm from profiles where id=new.user_id;
    insert into room_messages(room_id,user_id,body,kind) values (new.room_id,new.user_id, nm || ' صعد على المايك ' || (new.seat_index+1),'system');
  end if;
  return null;
end $$;
create trigger room_member_sys after insert on public.room_members for each row execute function public.trg_room_system();
create trigger room_seat_sys after update on public.room_seats for each row execute function public.trg_room_system();

revoke execute on all functions in schema public from anon;

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.notifications;
