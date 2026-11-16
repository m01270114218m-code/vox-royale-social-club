create or replace function public.admin_set_device_ban(
  _user uuid, _banned boolean, _reason text default '', _hours integer default null
) returns void
language plpgsql security definer set search_path = ''
as $$
declare v_device text;
begin
  if auth.uid() is null or not public.is_admin((select auth.uid())) then raise exception 'not allowed'; end if;
  if _user is null then raise exception 'invalid_user'; end if;
  if _hours is not null and (_hours < 0 or _hours > 87600) then raise exception 'invalid_ban_duration'; end if;
  if not _banned then
    update public.device_bans set revoked_at = now()
    where user_id = _user and revoked_at is null;
    return;
  end if;
  select da.device_hash into v_device from public.device_accounts da where da.user_id = _user;
  if v_device is null then raise exception 'device_not_registered'; end if;
  insert into public.device_bans(device_hash, user_id, reason, banned_by, created_at, expires_at, revoked_at)
  values (v_device, _user, coalesce(nullif(btrim(_reason), ''), 'حظر الجهاز'), auth.uid(), now(),
    case when coalesce(_hours, 0) = 0 then null else now() + make_interval(hours => _hours) end, null)
  on conflict (device_hash) do update set user_id = excluded.user_id, reason = excluded.reason,
    banned_by = excluded.banned_by, created_at = now(), expires_at = excluded.expires_at, revoked_at = null;
end;
$$;
revoke all on function public.admin_set_device_ban(uuid, boolean, text, integer) from public, anon;
grant execute on function public.admin_set_device_ban(uuid, boolean, text, integer) to authenticated;
