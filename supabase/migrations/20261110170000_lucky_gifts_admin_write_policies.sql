-- Allow the app's admin gift editor to manage lucky_gifts while preserving
-- active-only reads for normal signed-in users.
grant select, insert, update, delete on table public.lucky_gifts to authenticated;

drop policy if exists "lucky gifts admin insert" on public.lucky_gifts;
drop policy if exists "lucky gifts admin update" on public.lucky_gifts;
drop policy if exists "lucky gifts admin delete" on public.lucky_gifts;

create policy "lucky gifts admin insert"
  on public.lucky_gifts
  for insert to authenticated
  with check (public.is_admin((select auth.uid())));

create policy "lucky gifts admin update"
  on public.lucky_gifts
  for update to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));

create policy "lucky gifts admin delete"
  on public.lucky_gifts
  for delete to authenticated
  using (public.is_admin((select auth.uid())));
