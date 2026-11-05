-- Allow finance-role staff to read financial records without modifying balances.
-- This migration is additive and preserves all existing data.
drop policy if exists "Finance can read all wallet balances" on public.wallet_balances;
create policy "Finance can read all wallet balances"
on public.wallet_balances
for select
to authenticated
using (
  exists (
    select 1 from public.admin_roles ar
    where ar.user_id = (select auth.uid())
      and ar.role = 'finance'
  )
);

drop policy if exists "Finance can read wallet transactions" on public.wallet_transactions;
create policy "Finance can read wallet transactions"
on public.wallet_transactions
for select
to authenticated
using (
  exists (
    select 1 from public.admin_roles ar
    where ar.user_id = (select auth.uid())
      and ar.role = 'finance'
  )
);

drop policy if exists "Finance can read audit log" on public.admin_audit_log;
create policy "Finance can read audit log"
on public.admin_audit_log
for select
to authenticated
using (
  exists (
    select 1 from public.admin_roles ar
    where ar.user_id = (select auth.uid())
      and ar.role = 'finance'
  )
);
