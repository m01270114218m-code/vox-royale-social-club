create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_display_name text;
  v_username text;
  v_avatar_url text;
begin
  v_display_name := coalesce(
    nullif(btrim(new.raw_user_meta_data->>'display_name'),''),
    nullif(btrim(new.raw_user_meta_data->>'full_name'),''),
    nullif(btrim(new.raw_user_meta_data->>'name'),''),
    nullif(btrim(new.raw_user_meta_data->>'preferred_username'),''),
    'مستخدم ' || right(replace(new.id::text,'-',''),6)
  );
  v_username := 'user_' || replace(new.id::text,'-','');
  v_avatar_url := coalesce(
    nullif(new.raw_user_meta_data->>'avatar_url',''),
    nullif(new.raw_user_meta_data->>'picture','')
  );

  insert into public.profiles
    (id, username, display_name, name, avatar_url, avatar, role, account_status, setup_step, setup_complete)
  values
    (new.id, v_username, v_display_name, v_display_name, v_avatar_url, v_avatar_url,
     'user', 'active', 'profile', false)
  on conflict (id) do nothing;

  insert into public.wallets (user_id, coins, diamonds)
  values (new.id, 0, 0)
  on conflict (user_id) do nothing;

  return new;
end;
$function$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
