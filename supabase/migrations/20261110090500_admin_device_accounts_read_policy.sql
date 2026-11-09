drop policy if exists device_accounts_admin_read on public.device_accounts;
create policy device_accounts_admin_read on public.device_accounts
for select to authenticated using (public.is_admin((select auth.uid())));
