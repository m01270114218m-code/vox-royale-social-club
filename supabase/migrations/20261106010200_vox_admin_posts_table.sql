create table if not exists public.posts (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, body text not null check (char_length(body) between 1 and 5000), like_count integer not null default 0 check (like_count >= 0), created_at timestamptz not null default now());
alter table public.posts enable row level security;
drop policy if exists "Posts visible to signed in users" on public.posts;
create policy "Posts visible to signed in users" on public.posts for select to authenticated using (true);
drop policy if exists "Users create own posts" on public.posts;
create policy "Users create own posts" on public.posts for insert to authenticated with check (user_id=(select auth.uid()));
drop policy if exists "Admins manage posts" on public.posts;
create policy "Admins manage posts" on public.posts for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create index if not exists posts_created_at_idx on public.posts(created_at desc);
