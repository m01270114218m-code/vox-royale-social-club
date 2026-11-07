create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_name text;
begin
  v_name := coalesce(
    nullif(btrim(new.raw_user_meta_data->>'display_name'),''),
    nullif(btrim(new.raw_user_meta_data->>'full_name'),''),
    nullif(split_part(coalesce(new.email,''),'@',1),''),
    'User'
  );
  insert into public.profiles(id,display_name)
  values(new.id,left(v_name,30))
  on conflict(id) do nothing;
  insert into public.wallets(user_id)
  values(new.id)
  on conflict(user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public,anon,authenticated;
