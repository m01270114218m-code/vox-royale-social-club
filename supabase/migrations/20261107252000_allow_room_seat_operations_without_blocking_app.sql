-- Allow normal authenticated room operations without bypassing database security.
-- Room members may insert their own seat row or an empty seat row.
-- Staff may manage seat rows. The database remains protected by RLS.
drop policy if exists "room_seats_member_insert" on public.room_seats;
create policy "room_seats_member_insert"
on public.room_seats
for insert
to authenticated
with check (
  exists (
    select 1 from public.room_members rm
    where rm.room_id = room_seats.room_id
      and rm.user_id = (select auth.uid())
  )
  and (
    user_id is null
    or user_id = (select auth.uid())
    or public.is_room_staff(room_seats.room_id, (select auth.uid()))
  )
);

drop policy if exists "room_seats_member_update" on public.room_seats;
create policy "room_seats_member_update"
on public.room_seats
for update
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_room_staff(room_seats.room_id, (select auth.uid()))
)
with check (
  user_id is null
  or user_id = (select auth.uid())
  or public.is_room_staff(room_seats.room_id, (select auth.uid()))
);
