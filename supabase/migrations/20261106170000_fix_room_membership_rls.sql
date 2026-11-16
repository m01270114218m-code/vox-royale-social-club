-- Allow authenticated users to join and leave rooms without permitting
-- membership spoofing or joining rooms where they are banned.
drop policy if exists room_members_insert_self on public.room_members;
create policy room_members_insert_self
on public.room_members
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.rooms r
    where r.id = room_members.room_id
  )
  and not exists (
    select 1
    from public.room_bans rb
    where rb.room_id = room_members.room_id
      and rb.user_id = (select auth.uid())
  )
);

drop policy if exists room_members_update_self on public.room_members;
create policy room_members_update_self
on public.room_members
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists room_members_delete_self on public.room_members;
create policy room_members_delete_self
on public.room_members
for delete
to authenticated
using (user_id = (select auth.uid()));
