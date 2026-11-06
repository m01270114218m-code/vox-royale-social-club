-- Make private admin policies use the same canonical role table as Auth and admin RPCs.
-- Moderators intentionally do not receive full admin table/storage write access.
create or replace function private.is_admin(_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    _uid = auth.uid()
    and exists (
      select 1
      from public.user_roles ur
      where ur.user_id = _uid
        and ur.role in ('super_admin'::public.app_role, 'admin'::public.app_role)
    );
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin(auth.uid());
$$;
