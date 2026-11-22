-- Align the live admin console with the production Supabase schema and enable live updates.
-- No app data is inserted, replaced, or deleted by this migration.

create or replace function public.claim_first_admin()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'authentication_required';
  end if;

  -- Serialize simultaneous first-admin claims so only one account can win.
  perform pg_catalog.pg_advisory_xact_lock(847392014);

  if exists (
    select 1
    from public.user_roles
    where role in ('super_admin'::public.app_role, 'admin'::public.app_role)
  ) then
    return false;
  end if;

  insert into public.user_roles(user_id, role)
  values (v_uid, 'super_admin'::public.app_role)
  on conflict do nothing;

  perform public.write_audit('first_admin_claimed', 'Initial super administrator', v_uid, 'user');
  return exists (
    select 1 from public.user_roles
    where user_id = v_uid and role = 'super_admin'::public.app_role
  );
end;
$$;

revoke all on function public.claim_first_admin() from public, anon;
grant execute on function public.claim_first_admin() to authenticated;

drop policy if exists notifications_admin_select on public.notifications;
create policy notifications_admin_select
on public.notifications
for select
to authenticated
using (public.is_admin((select auth.uid())));

-- Supabase Realtime only streams tables explicitly added to this publication.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'profiles','wallets','wallet_transactions','rooms','room_members','room_seats',
    'gifts','gift_transactions','vip_tiers','banners','notifications','admin_assets',
    'reports','user_roles','admin_settings','audit_log','store_items','posts'
  ]
  loop
    if not exists (
      select 1
      from pg_catalog.pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = v_table
    ) then
      execute pg_catalog.format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end;
$$;
