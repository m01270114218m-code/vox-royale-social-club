create or replace function public.get_active_direct_asset(_user uuid,_asset_type text,_asset_key text)
returns boolean
language sql stable security definer set search_path=''
as $function$
  select exists(
    select 1 from public.user_asset_grants g
    where g.receiver_id=_user and g.asset_type=_asset_type and g.asset_key=_asset_key
      and (g.expires_at is null or g.expires_at>now())
  );
$function$;

revoke execute on function public.get_active_direct_asset(uuid,text,text) from anon,public;
grant execute on function public.get_active_direct_asset(uuid,text,text) to authenticated;