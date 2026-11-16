
drop policy if exists admin_user_permissions_self_read on public.admin_user_permissions;
create policy admin_user_permissions_self_read on public.admin_user_permissions
for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.my_admin_permissions()
returns text[]
language sql stable
set search_path = ''
as $$
  select coalesce(array_agg(permission_key order by permission_key), array[]::text[])
  from public.admin_user_permissions
  where user_id = auth.uid() and enabled = true;
$$;

create or replace function private.require_admin_permission(_permission text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if private.has_role(auth.uid(), 'super_admin') then return; end if;
  if not public.is_admin(auth.uid()) then raise exception 'admin_required'; end if;
  if not exists (
    select 1 from public.admin_user_permissions p
    where p.user_id = auth.uid() and p.permission_key = _permission and p.enabled = true
  ) then raise exception 'admin_permission_required:%', _permission; end if;
end;
$$;

revoke all on function public.admin_require_permission(text) from public, anon, authenticated;
revoke all on function private.require_admin_permission(text) from public, anon, authenticated;

do $$
declare f record; v_definition text;
begin
  for f in
    select p.oid
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname in (
        'admin_update_user_identity','admin_set_profile_style','admin_set_user_ban',
        'admin_set_device_ban','admin_grant_coins','admin_set_vip','admin_grant_store_item',
        'admin_grant_badge_asset','send_asset_to_user'
      )
  loop
    v_definition := replace(pg_get_functiondef(f.oid),
      'public.admin_require_permission', 'private.require_admin_permission');
    execute v_definition;
  end loop;
end;
$$;
