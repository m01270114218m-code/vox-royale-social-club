create table if not exists public.admin_dashboard_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  granted_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.admin_dashboard_access enable row level security;

drop policy if exists admin_dashboard_access_super_read on public.admin_dashboard_access;
create policy admin_dashboard_access_super_read on public.admin_dashboard_access
for select to authenticated
using (private.has_role((select auth.uid()), 'super_admin'));

create or replace function public.can_access_admin_dashboard()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and (
    private.has_role(auth.uid(), 'super_admin')
    or (
      (private.has_role(auth.uid(), 'admin') or private.has_role(auth.uid(), 'moderator'))
      and exists (
        select 1 from public.admin_dashboard_access a
        where a.user_id = auth.uid() and a.enabled = true
      )
    )
  );
$$;

create or replace function public.admin_set_dashboard_access(_user uuid, _enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.has_role(auth.uid(), 'super_admin') then
    raise exception 'super_admin_required';
  end if;
  if _user is null then raise exception 'invalid_user'; end if;
  if _enabled and not (
    private.has_role(_user, 'admin') or private.has_role(_user, 'moderator')
  ) then
    raise exception 'admin_role_required';
  end if;
  insert into public.admin_dashboard_access(user_id, enabled, granted_by, updated_at)
  values (_user, _enabled, auth.uid(), now())
  on conflict (user_id) do update
  set enabled = excluded.enabled, granted_by = excluded.granted_by, updated_at = now();
  perform public.write_audit(
    'admin_dashboard_access',
    case when _enabled then 'enabled dashboard access' else 'disabled dashboard access' end,
    _user,
    'user'
  );
end;
$$;

revoke all on function public.can_access_admin_dashboard() from public, anon;
grant execute on function public.can_access_admin_dashboard() to authenticated;
revoke all on function public.admin_set_dashboard_access(uuid, boolean) from public, anon;
grant execute on function public.admin_set_dashboard_access(uuid, boolean) to authenticated;
