create or replace function public.handle_new_shadow_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_display_name text;
begin
  v_display_name := coalesce(
    nullif(btrim(new.raw_user_meta_data->>'display_name'),''),
    nullif(btrim(new.raw_user_meta_data->>'full_name'),''),
    nullif(btrim(new.raw_user_meta_data->>'name'),''),
    'مستخدم ' || right(replace(new.id::text,'-',''),6)
  );

  insert into public.profiles
    (id, username, display_name, name, created_at, updated_at)
  values
    (new.id, 'user_' || replace(new.id::text,'-',''), v_display_name, v_display_name, now(), now())
  on conflict (id) do nothing;

  insert into public.wallets (user_id, coins, diamonds, updated_at)
  values (new.id, 0, 0, now())
  on conflict (user_id) do nothing;

  return new;
end;
$function$;

revoke all on function public.handle_new_shadow_user() from public, anon, authenticated;
