-- Repair role helper compatibility and create the private inbox schema used by the app.
-- Idempotent migration for the app_new branch.

create or replace function public.has_role(_role text)
returns boolean
language sql stable security definer
set search_path = public
as $$ select public.has_role(auth.uid(), _role); $$;

create table if not exists public.private_conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.private_conversation_members (
  conversation_id uuid not null references public.private_conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index if not exists private_conversation_members_user_idx
  on public.private_conversation_members(user_id, conversation_id);
create table if not exists public.private_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.private_conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text,
  message_type text not null default 'text',
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint private_messages_body_length check (body is null or char_length(body) <= 300)
);
create index if not exists private_messages_conversation_created_idx
  on public.private_messages(conversation_id, created_at desc);

alter table public.private_conversations enable row level security;
alter table public.private_conversation_members enable row level security;
alter table public.private_messages enable row level security;

create or replace function public.is_private_conversation_member(p_conversation_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.private_conversation_members
    where conversation_id = p_conversation_id and user_id = auth.uid()
  );
$$;
revoke all on function public.is_private_conversation_member(uuid) from public, anon;
grant execute on function public.is_private_conversation_member(uuid) to authenticated;

drop policy if exists "members read private conversations" on public.private_conversations;
create policy "members read private conversations" on public.private_conversations
for select to authenticated using (public.is_private_conversation_member(id));

drop policy if exists "members read private conversation members" on public.private_conversation_members;
create policy "members read private conversation members" on public.private_conversation_members
for select to authenticated using (public.is_private_conversation_member(private_conversation_members.conversation_id));

drop policy if exists "members read private messages" on public.private_messages;
create policy "members read private messages" on public.private_messages
for select to authenticated using (public.is_private_conversation_member(private_messages.conversation_id));

drop policy if exists "members send private messages" on public.private_messages;
create policy "members send private messages" on public.private_messages
for insert to authenticated with check (
  sender_id = auth.uid() and public.is_private_conversation_member(private_messages.conversation_id)
);

create or replace function public.get_or_create_private_conversation(p_other_user_id uuid)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare v_me uuid := auth.uid(); v_conversation_id uuid;
begin
  if v_me is null then raise exception 'سجّل الدخول أولاً'; end if;
  if p_other_user_id is null or p_other_user_id = v_me then raise exception 'اختر مستخدماً آخر'; end if;
  if not exists (select 1 from public.profiles where id = p_other_user_id and not banned) then
    raise exception 'المستخدم غير متاح';
  end if;
  select mine.conversation_id into v_conversation_id
  from public.private_conversation_members mine
  join public.private_conversation_members theirs on theirs.conversation_id = mine.conversation_id
  where mine.user_id = v_me and theirs.user_id = p_other_user_id
  limit 1;
  if v_conversation_id is null then
    insert into public.private_conversations default values returning id into v_conversation_id;
    insert into public.private_conversation_members(conversation_id, user_id)
    values (v_conversation_id, v_me), (v_conversation_id, p_other_user_id);
  end if;
  return v_conversation_id;
end;
$$;
revoke all on function public.get_or_create_private_conversation(uuid) from public, anon;
grant execute on function public.get_or_create_private_conversation(uuid) to authenticated;
grant select on public.private_conversations, public.private_conversation_members, public.private_messages to authenticated;
grant insert on public.private_messages to authenticated;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='private_messages') then
    alter publication supabase_realtime add table public.private_messages;
  end if;
end $$;

alter table public.chat_messages replica identity full;

create or replace function public.clear_room_chat(p_room_id uuid)
returns boolean language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_owner uuid;
begin
  if v_uid is null then raise exception 'غير مصرح'; end if;
  select owner_id into v_owner from public.rooms where id = p_room_id;
  if v_owner is null then raise exception 'الغرفة غير موجودة'; end if;
  if v_owner <> v_uid and not public.has_role(v_uid, 'admin') then
    raise exception 'ليس لديك صلاحية مسح دردشة الغرفة';
  end if;
  delete from public.chat_messages where room_id = p_room_id and message_type = 'text';
  return true;
end;
$$;
revoke all on function public.clear_room_chat(uuid) from public;
grant execute on function public.clear_room_chat(uuid) to authenticated;
