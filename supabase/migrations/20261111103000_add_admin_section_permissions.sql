alter table public.admin_user_permissions
  drop constraint if exists admin_user_permissions_permission_key_check;
alter table public.admin_user_permissions
  add constraint admin_user_permissions_permission_key_check
  check (permission_key = any (array[
    'send_frame','send_entry','send_badge','send_profile_assets',
    'edit_user_id','ban_account','ban_device','manage_wallet','manage_vip',
    'section_reports','section_rooms','section_seats','section_posts',
    'section_users','section_wallet','section_gifts','section_vip',
    'section_store','section_assets','section_banners','section_notifications',
    'section_roles','section_settings','section_app_builder','section_analytics','section_audit'
  ]::text[]));

create or replace function public.admin_set_user_permission(_user uuid, _permission text, _enabled boolean)
returns void language plpgsql security definer set search_path = ''
as $function$
begin
  if auth.uid() is null or not private.has_role(auth.uid(), 'super_admin') then raise exception 'super_admin_required'; end if;
  if _user is null then raise exception 'invalid_user'; end if;
  if _permission not in (
    'send_frame','send_entry','send_badge','send_profile_assets','edit_user_id','ban_account','ban_device','manage_wallet','manage_vip',
    'section_reports','section_rooms','section_seats','section_posts','section_users','section_wallet','section_gifts','section_vip',
    'section_store','section_assets','section_banners','section_notifications','section_roles','section_settings','section_app_builder','section_analytics','section_audit'
  ) then raise exception 'invalid_admin_permission'; end if;
  if not (private.has_role(_user, 'admin') or private.has_role(_user, 'moderator')) then raise exception 'admin_role_required'; end if;
  insert into public.admin_user_permissions(user_id, permission_key, enabled, granted_by, updated_at)
  values (_user, _permission, _enabled, auth.uid(), now())
  on conflict (user_id, permission_key) do update set enabled=excluded.enabled, granted_by=excluded.granted_by, updated_at=now();
  perform public.write_audit('admin_user_permission', _permission || ':' || case when _enabled then 'enabled' else 'disabled' end, _user, 'user');
end;
$function$;
