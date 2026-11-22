-- Allow authenticated room members to send chat messages as themselves.
-- The RPC still checks membership; this RLS policy makes the underlying INSERT legal.
drop policy if exists room_messages_insert_room_members on public.room_messages;
create policy room_messages_insert_room_members
on public.room_messages
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.room_members rm
    where rm.room_id = room_messages.room_id
      and rm.user_id = (select auth.uid())
  )
);
