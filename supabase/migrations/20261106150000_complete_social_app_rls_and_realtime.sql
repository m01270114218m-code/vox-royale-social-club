-- Complete authenticated app read/write policies for the social and room features.
-- Sensitive finance and gift ledgers remain read-only to their owners; writes stay inside RPCs.

-- Social graph
drop policy if exists follows_read_authenticated on public.follows;
create policy follows_read_authenticated on public.follows
for select to authenticated using (true);
drop policy if exists follows_insert_self on public.follows;
create policy follows_insert_self on public.follows
for insert to authenticated with check (follower_id = (select auth.uid()));
drop policy if exists follows_delete_self on public.follows;
create policy follows_delete_self on public.follows
for delete to authenticated using (follower_id = (select auth.uid()));

-- Public social feed and comments
drop policy if exists posts_read_authenticated on public.posts;
create policy posts_read_authenticated on public.posts
for select to authenticated using (true);
drop policy if exists posts_insert_self on public.posts;
create policy posts_insert_self on public.posts
for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists posts_update_self on public.posts;
create policy posts_update_self on public.posts
for update to authenticated using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
drop policy if exists posts_delete_self on public.posts;
create policy posts_delete_self on public.posts
for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists post_comments_read_authenticated on public.post_comments;
create policy post_comments_read_authenticated on public.post_comments
for select to authenticated using (true);
drop policy if exists post_comments_insert_self on public.post_comments;
create policy post_comments_insert_self on public.post_comments
for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists post_comments_update_self on public.post_comments;
create policy post_comments_update_self on public.post_comments
for update to authenticated using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
drop policy if exists post_comments_delete_self on public.post_comments;
create policy post_comments_delete_self on public.post_comments
for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists post_likes_read_authenticated on public.post_likes;
create policy post_likes_read_authenticated on public.post_likes
for select to authenticated using (true);
drop policy if exists post_likes_insert_self on public.post_likes;
create policy post_likes_insert_self on public.post_likes
for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists post_likes_delete_self on public.post_likes;
create policy post_likes_delete_self on public.post_likes
for delete to authenticated using (user_id = (select auth.uid()));

-- Families and membership roster
drop policy if exists families_read_authenticated on public.families;
create policy families_read_authenticated on public.families
for select to authenticated using (true);
drop policy if exists family_members_read_authenticated on public.family_members;
create policy family_members_read_authenticated on public.family_members
for select to authenticated using (true);

-- Profile visits are visible only to the visitor and visited profile owner.
drop policy if exists profile_visits_read_participants on public.profile_visits;
create policy profile_visits_read_participants on public.profile_visits
for select to authenticated using (
  visitor_id = (select auth.uid()) or profile_id = (select auth.uid())
);
drop policy if exists profile_visits_insert_self on public.profile_visits;
create policy profile_visits_insert_self on public.profile_visits
for insert to authenticated with check (visitor_id = (select auth.uid()));

-- Room chat history is visible only to members, the room owner, and full admins.
drop policy if exists room_messages_read_room_members on public.room_messages;
create policy room_messages_read_room_members on public.room_messages
for select to authenticated using (
  exists (
    select 1 from public.room_members rm
    where rm.room_id = room_messages.room_id and rm.user_id = (select auth.uid())
  )
  or exists (
    select 1 from public.rooms r
    where r.id = room_messages.room_id and r.owner_id = (select auth.uid())
  )
  or (select private.is_admin())
);

drop policy if exists room_moderators_read_room_members on public.room_moderators;
create policy room_moderators_read_room_members on public.room_moderators
for select to authenticated using (
  exists (
    select 1 from public.room_members rm
    where rm.room_id = room_moderators.room_id and rm.user_id = (select auth.uid())
  )
  or exists (
    select 1 from public.rooms r
    where r.id = room_moderators.room_id and r.owner_id = (select auth.uid())
  )
  or (select private.is_admin())
);

drop policy if exists room_bans_read_participants on public.room_bans;
create policy room_bans_read_participants on public.room_bans
for select to authenticated using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.rooms r
    where r.id = room_bans.room_id and r.owner_id = (select auth.uid())
  )
  or (select private.is_admin())
);

-- Personal block list and purchased inventory
drop policy if exists user_blocks_read_self on public.user_blocks;
create policy user_blocks_read_self on public.user_blocks
for select to authenticated using (blocker_id = (select auth.uid()));
drop policy if exists user_blocks_insert_self on public.user_blocks;
create policy user_blocks_insert_self on public.user_blocks
for insert to authenticated with check (blocker_id = (select auth.uid()));
drop policy if exists user_blocks_delete_self on public.user_blocks;
create policy user_blocks_delete_self on public.user_blocks
for delete to authenticated using (blocker_id = (select auth.uid()));

drop policy if exists user_items_read_self on public.user_items;
create policy user_items_read_self on public.user_items
for select to authenticated using (user_id = (select auth.uid()));

-- Financial ledgers: read-only to the involved user(s) and full admins.
drop policy if exists wallet_transactions_read_owner on public.wallet_transactions;
create policy wallet_transactions_read_owner on public.wallet_transactions
for select to authenticated using (
  user_id = (select auth.uid()) or (select private.is_admin())
);
drop policy if exists gift_transactions_read_participants on public.gift_transactions;
create policy gift_transactions_read_participants on public.gift_transactions
for select to authenticated using (
  sender_id = (select auth.uid())
  or receiver_id = (select auth.uid())
  or (select private.is_admin())
);

-- Realtime feeds used by rooms, chat, social feed, and the user's inventory.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'families','family_members','follows','gift_transactions','post_comments','post_likes',
    'profile_visits','room_bans','room_messages','room_moderators','user_blocks','user_items',
    'wallet_transactions'
  ]
  loop
    if not exists (
      select 1 from pg_catalog.pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = v_table
    ) then
      execute pg_catalog.format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end;
$$;
