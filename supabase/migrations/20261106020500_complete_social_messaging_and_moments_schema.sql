-- Complete the social data contract used by messaging, friends and moments.
alter table public.posts
  add column if not exists image_url text,
  add column if not exists comment_count integer not null default 0;

create or replace view public.follows
with (security_invoker = true)
as select follower_id, followed_id as following_id, created_at from public.user_follows;
grant select, insert, delete on public.follows to authenticated;

create table if not exists public.profile_visits (
  visitor_id uuid not null references public.profiles(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  visited_at timestamptz not null default now(),
  primary key(visitor_id,profile_id),
  check(visitor_id <> profile_id)
);
alter table public.profile_visits enable row level security;
drop policy if exists "Profile owners read visits" on public.profile_visits;
create policy "Profile owners read visits" on public.profile_visits for select to authenticated
using (profile_id = (select auth.uid()));
drop policy if exists "Visitors record own visits" on public.profile_visits;
create policy "Visitors record own visits" on public.profile_visits for insert to authenticated
with check (visitor_id = (select auth.uid()) and profile_id <> (select auth.uid()));

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(blocker_id,blocked_id),
  check(blocker_id <> blocked_id)
);
alter table public.user_blocks enable row level security;
drop policy if exists "Users manage their own blocks" on public.user_blocks;
create policy "Users manage their own blocks" on public.user_blocks for all to authenticated
using (blocker_id = (select auth.uid()))
with check (blocker_id = (select auth.uid()));

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(post_id,user_id)
);
alter table public.post_likes enable row level security;
drop policy if exists "Post likes visible to signed-in users" on public.post_likes;
create policy "Post likes visible to signed-in users" on public.post_likes for select to authenticated using (true);
drop policy if exists "Users like posts as themselves" on public.post_likes;
create policy "Users like posts as themselves" on public.post_likes for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "Users remove own post likes" on public.post_likes;
create policy "Users remove own post likes" on public.post_likes for delete to authenticated using (user_id = (select auth.uid()));

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now()
);
alter table public.post_comments enable row level security;
drop policy if exists "Post comments visible to signed-in users" on public.post_comments;
create policy "Post comments visible to signed-in users" on public.post_comments for select to authenticated using (true);
drop policy if exists "Users create own post comments" on public.post_comments;
create policy "Users create own post comments" on public.post_comments for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "Users delete own post comments" on public.post_comments;
create policy "Users delete own post comments" on public.post_comments for delete to authenticated using (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "Users delete own posts" on public.posts;
create policy "Users delete own posts" on public.posts for delete to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Users update own posts" on public.posts;
create policy "Users update own posts" on public.posts for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create or replace function private.update_post_like_count()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.posts set like_count = greatest(0,like_count - 1) where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;
drop trigger if exists post_like_count_trigger on public.post_likes;
create trigger post_like_count_trigger after insert or delete on public.post_likes
for each row execute function private.update_post_like_count();

create or replace function private.update_post_comment_count()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.posts set comment_count = greatest(0,comment_count - 1) where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;
drop trigger if exists post_comment_count_trigger on public.post_comments;
create trigger post_comment_count_trigger after insert or delete on public.post_comments
for each row execute function private.update_post_comment_count();

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  last_message text,
  last_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check(user_a <> user_b),
  unique(user_a,user_b)
);
alter table public.conversations enable row level security;
drop policy if exists "Conversation participants read conversations" on public.conversations;
create policy "Conversation participants read conversations" on public.conversations for select to authenticated
using ((select auth.uid()) in (user_a,user_b));

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
alter table public.messages enable row level security;
drop policy if exists "Conversation participants read messages" on public.messages;
create policy "Conversation participants read messages" on public.messages for select to authenticated
using (exists(select 1 from public.conversations c where c.id=conversation_id and (select auth.uid()) in (c.user_a,c.user_b)));
drop policy if exists "Recipients mark messages read" on public.messages;
create policy "Recipients mark messages read" on public.messages for update to authenticated
using (sender_id <> (select auth.uid()) and exists(select 1 from public.conversations c where c.id=conversation_id and (select auth.uid()) in (c.user_a,c.user_b)))
with check (sender_id <> (select auth.uid()) and exists(select 1 from public.conversations c where c.id=conversation_id and (select auth.uid()) in (c.user_a,c.user_b)));
revoke update on public.messages from authenticated;
grant update(read_at) on public.messages to authenticated;

create or replace function public.visit_profile(_profile uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  if _profile = (select auth.uid()) then return; end if;
  insert into public.profile_visits(visitor_id,profile_id) values((select auth.uid()),_profile)
  on conflict(visitor_id,profile_id) do update set visited_at=now();
end;
$$;

create or replace function public.get_or_create_conversation(_other uuid) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := (select auth.uid()); v_a uuid; v_b uuid; v_id uuid;
begin
  if v_uid is null then raise exception 'authentication required'; end if;
  if _other is null or _other=v_uid then raise exception 'invalid recipient'; end if;
  if exists(select 1 from public.user_blocks where (blocker_id=v_uid and blocked_id=_other) or (blocker_id=_other and blocked_id=v_uid)) then raise exception 'user blocked'; end if;
  v_a := least(v_uid,_other); v_b := greatest(v_uid,_other);
  insert into public.conversations(user_a,user_b) values(v_a,v_b)
  on conflict(user_a,user_b) do update set last_at=public.conversations.last_at
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.send_dm(_conv uuid,_body text) returns void
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'authentication required'; end if;
  if char_length(trim(coalesce(_body,'')))=0 or char_length(_body)>2000 then raise exception 'invalid message'; end if;
  if not exists(select 1 from public.conversations c where c.id=_conv and v_uid in (c.user_a,c.user_b)) then raise exception 'not allowed'; end if;
  if exists(select 1 from public.conversations c join public.user_blocks b on
      (b.blocker_id=c.user_a and b.blocked_id=c.user_b) or (b.blocker_id=c.user_b and b.blocked_id=c.user_a)
      where c.id=_conv) then raise exception 'user blocked'; end if;
  insert into public.messages(conversation_id,sender_id,body) values(_conv,v_uid,trim(_body));
  update public.conversations set last_message=left(trim(_body),200),last_at=now() where id=_conv;
end;
$$;

create or replace function public.mark_conv_read(_conv uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := (select auth.uid());
begin
  if not exists(select 1 from public.conversations c where c.id=_conv and v_uid in (c.user_a,c.user_b)) then raise exception 'not allowed'; end if;
  update public.messages set read_at=now() where conversation_id=_conv and sender_id<>v_uid and read_at is null;
end;
$$;

create or replace function public.submit_report(_type text,_target text,_category text,_details text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := (select auth.uid()); v_id uuid;
begin
  if v_uid is null then raise exception 'authentication required'; end if;
  if _type not in ('user','post','room','message') then raise exception 'invalid report type'; end if;
  insert into public.admin_reports(reporter_id,target_type,target_id,reason,status)
  values(v_uid,_type,_target,concat_ws(': ',nullif(_category,''),nullif(_details,'')),'open')
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.visit_profile(uuid) to authenticated;
grant execute on function public.get_or_create_conversation(uuid) to authenticated;
grant execute on function public.send_dm(uuid,text) to authenticated;
grant execute on function public.mark_conv_read(uuid) to authenticated;
grant execute on function public.submit_report(text,text,text,text) to authenticated;

do $$
declare t text;
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach t in array array['conversations','messages','user_notifications','room_seats','room_members','room_messages'] loop
      if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
        execute format('alter publication supabase_realtime add table public.%I',t);
      end if;
    end loop;
  end if;
end;
$$;
