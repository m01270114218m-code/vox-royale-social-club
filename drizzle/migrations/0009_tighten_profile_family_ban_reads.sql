drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable" on public.profiles for select to authenticated using (auth.uid() is not null);
drop policy if exists "family members readable" on public.family_members;
create policy "family members readable" on public.family_members for select to authenticated using (auth.uid() is not null);
drop policy if exists "bans readable by self or staff" on public.room_bans;
create policy "bans readable by self or staff" on public.room_bans for select to authenticated using (user_id = auth.uid() or public.is_room_staff(room_id, auth.uid()) or public.is_admin(auth.uid()));
revoke select on public.profiles, public.family_members, public.room_bans from anon;