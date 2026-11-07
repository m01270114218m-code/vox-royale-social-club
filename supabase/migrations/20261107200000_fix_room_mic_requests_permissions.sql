grant select, insert, update, delete on table public.room_mic_requests to authenticated;
drop policy if exists "mic requests read requester or staff" on public.room_mic_requests;
create policy "mic requests read requester or staff" on public.room_mic_requests for select to authenticated using ((select auth.uid())=user_id or public.is_room_staff(room_id,(select auth.uid())));
drop policy if exists "mic requests insert own" on public.room_mic_requests;
create policy "mic requests insert own" on public.room_mic_requests for insert to authenticated with check ((select auth.uid())=user_id and exists(select 1 from public.room_members m where m.room_id=room_mic_requests.room_id and m.user_id=(select auth.uid())));
drop policy if exists "mic requests update requester or staff" on public.room_mic_requests;
create policy "mic requests update requester or staff" on public.room_mic_requests for update to authenticated using ((select auth.uid())=user_id or public.is_room_staff(room_id,(select auth.uid()))) with check ((select auth.uid())=user_id or public.is_room_staff(room_id,(select auth.uid())));
drop policy if exists "mic requests delete requester or staff" on public.room_mic_requests;
create policy "mic requests delete requester or staff" on public.room_mic_requests for delete to authenticated using ((select auth.uid())=user_id or public.is_room_staff(room_id,(select auth.uid())));