drop policy if exists "Admins can view account registration requests" on public.account_registration_requests;
create policy "Admins can view account registration requests"
on public.account_registration_requests for select to authenticated
using (
  coalesce((select auth.jwt()->>'is_anonymous'), 'false') = 'false'
  and public.has_role((select auth.uid()), 'admin')
);
drop policy if exists "Admins can review account registration requests" on public.account_registration_requests;
create policy "Admins can review account registration requests"
on public.account_registration_requests for update to authenticated
using (
  coalesce((select auth.jwt()->>'is_anonymous'), 'false') = 'false'
  and public.has_role((select auth.uid()), 'admin')
)
with check (
  coalesce((select auth.jwt()->>'is_anonymous'), 'false') = 'false'
  and public.has_role((select auth.uid()), 'admin')
  and status in ('approved','rejected','fulfilled')
  and (reviewed_by is null or reviewed_by = (select auth.uid()))
);
