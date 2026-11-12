-- Fix Asset Center badge delivery: a badge asset is itself grantable.
-- This removes the hard dependency on a matching store_items row.
create or replace function public.admin_grant_badge_asset(
  _user uuid,
  _asset_id uuid,
  _equip boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_asset_key text;
  v_name text;
  v_category text;
  v_active boolean;
  v_color text;
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then
    raise exception 'admin_required';
  end if;

  select asset_key, name, category, is_active,
         coalesce(nullif(metadata->>'color',''), '#D4AF37')
    into v_asset_key, v_name, v_category, v_active, v_color
  from public.admin_assets
  where id = _asset_id;

  if not found then raise exception 'asset_not_found'; end if;
  if v_category <> 'badge' then raise exception 'asset_not_badge'; end if;
  if not v_active then raise exception 'asset_inactive'; end if;
  if not exists (select 1 from public.profiles where id = _user) then
    raise exception 'user_not_found';
  end if;

  if _equip then
    update public.user_badges set is_equipped = false where user_id = _user;
  end if;

  insert into public.user_badges(
    user_id, badge_key, badge_name, badge_asset_key, badge_color, is_equipped
  )
  values(
    _user, v_asset_key, v_name, v_asset_key, v_color, coalesce(_equip, false)
  )
  on conflict(user_id, badge_key) do update set
    badge_name = excluded.badge_name,
    badge_asset_key = excluded.badge_asset_key,
    badge_color = excluded.badge_color,
    is_equipped = case when _equip then true else public.user_badges.is_equipped end;

  perform public.write_audit('admin_grant_badge_asset', v_asset_key, _user, 'user');
end
$$;

revoke all on function public.admin_grant_badge_asset(uuid,uuid,boolean) from public, anon;
grant execute on function public.admin_grant_badge_asset(uuid,uuid,boolean) to authenticated;
