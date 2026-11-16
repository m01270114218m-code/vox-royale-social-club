-- Validate current account/device bans without re-registering or relinking the device.
create or replace function public.check_device_access(_device text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_reason text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if _device is null or length(btrim(_device)) < 16 or length(_device) > 200 then
    raise exception 'invalid_device_id';
  end if;

  select b.reason into v_reason from public.user_bans b
  where b.user_id = v_uid and b.revoked_at is null
    and (b.expires_at is null or b.expires_at > now()) limit 1;
  if v_reason is not null then raise exception 'account_banned: %', v_reason; end if;

  select b.reason into v_reason from public.device_bans b
  where b.device_hash = _device and b.revoked_at is null
    and (b.expires_at is null or b.expires_at > now()) limit 1;
  if v_reason is not null then raise exception 'device_banned: %', v_reason; end if;

  return true;
end;
$function$;

revoke all on function public.check_device_access(text) from public, anon;
grant execute on function public.check_device_access(text) to authenticated;
