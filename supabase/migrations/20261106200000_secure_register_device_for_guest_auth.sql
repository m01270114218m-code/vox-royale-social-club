create or replace function public.register_device(_device text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if _device is null or length(btrim(_device)) < 16 or length(_device) > 200 then
    raise exception 'invalid_device_id';
  end if;
  insert into public.device_accounts(user_id,device_hash)
  values (v_uid,_device)
  on conflict (user_id) do update
    set device_hash=excluded.device_hash,created_at=now();
  return v_uid;
end;
$$;
revoke all on function public.register_device(text) from public,anon;
grant execute on function public.register_device(text) to authenticated;
