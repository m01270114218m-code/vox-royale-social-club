-- Restore Data API table privileges while retaining the existing RLS policies.
grant usage on schema public to authenticated;
grant select on table public.gift_categories to authenticated;
grant select on table public.device_bans to authenticated;

-- When a guest account is upgraded to a permanent account on the same device,
-- transfer the device binding from the anonymous account. Never transfer from
-- another permanent account; that remains protected by the one-account policy.
create or replace function public.register_device(_device text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_reason text;
  v_owner uuid;
  v_owner_is_anonymous boolean := false;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if _device is null or length(btrim(_device)) < 16 or length(_device) > 200 then
    raise exception 'invalid_device_id';
  end if;

  select b.reason into v_reason
  from public.user_bans b
  where b.user_id = v_uid and b.revoked_at is null
    and (b.expires_at is null or b.expires_at > now())
  limit 1;
  if v_reason is not null then raise exception 'account_banned: %', v_reason; end if;

  select b.reason into v_reason
  from public.device_bans b
  where b.device_hash = _device and b.revoked_at is null
    and (b.expires_at is null or b.expires_at > now())
  limit 1;
  if v_reason is not null then raise exception 'device_banned: %', v_reason; end if;

  select da.user_id into v_owner
  from public.device_accounts da
  where da.device_hash = _device
  order by da.created_at desc
  limit 1;

  if v_owner is not null and v_owner <> v_uid then
    select coalesce(u.is_anonymous, false) into v_owner_is_anonymous
    from auth.users u where u.id = v_owner;
    if not coalesce(v_owner_is_anonymous, false) then
      raise exception 'device_already_linked';
    end if;
    delete from public.device_accounts where user_id = v_owner and device_hash = _device;
  end if;

  insert into public.device_accounts(user_id, device_hash)
  values (v_uid, _device)
  on conflict (user_id) do update
    set device_hash = excluded.device_hash, created_at = now();

  return v_uid;
end;
$$;

revoke all on function public.register_device(text) from public, anon;
grant execute on function public.register_device(text) to authenticated;
