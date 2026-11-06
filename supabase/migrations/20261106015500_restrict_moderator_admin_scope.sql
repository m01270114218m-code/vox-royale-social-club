-- Enforce moderator scope in RLS; admins/super-admins retain full administration.
create or replace function private.is_admin()
returns boolean
language sql stable security definer
set search_path = 'public','private'
as $$
  select exists (
    select 1 from public.admin_roles
    where user_id = (select auth.uid())
      and role in ('super_admin','admin')
  );
$$;

create or replace function private.is_moderator()
returns boolean
language sql stable security definer
set search_path = 'public','private'
as $$
  select exists (
    select 1 from public.admin_roles
    where user_id = (select auth.uid())
      and role = 'moderator'
  );
$$;
grant execute on function private.is_moderator() to authenticated;

drop policy if exists "Moderators review reports" on public.admin_reports;
create policy "Moderators review reports"
on public.admin_reports for select to authenticated
using ((select private.is_moderator()));

drop policy if exists "Moderators update reports" on public.admin_reports;
create policy "Moderators update reports"
on public.admin_reports for update to authenticated
using ((select private.is_moderator()))
with check ((select private.is_moderator()));

drop policy if exists "Moderators read report audit" on public.admin_audit_log;
create policy "Moderators read report audit"
on public.admin_audit_log for select to authenticated
using ((select private.is_moderator()) and entity_type = 'admin_reports');

drop policy if exists "Moderators write report audit" on public.admin_audit_log;
create policy "Moderators write report audit"
on public.admin_audit_log for insert to authenticated
with check (
  (select private.is_moderator())
  and actor_id = (select auth.uid())
  and entity_type = 'admin_reports'
);

create or replace function public.admin_write_audit(
  p_action text,
  p_entity_type text default null,
  p_entity_id text default null,
  p_details jsonb default '{}'::jsonb
) returns void
language plpgsql
set search_path = 'public'
as $$
begin
  if not (select private.is_admin())
     and not ((select private.is_moderator()) and p_entity_type = 'admin_reports') then
    raise exception 'not authorized';
  end if;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,details)
  values ((select auth.uid()),p_action,p_entity_type,p_entity_id,coalesce(p_details,'{}'::jsonb));
end;
$$;
