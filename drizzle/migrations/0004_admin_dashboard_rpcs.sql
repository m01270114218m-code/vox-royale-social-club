create or replace function public.is_admin(_uid uuid) returns boolean language sql stable security definer set search_path=public as $$
  select public.has_role(_uid,'admin') or public.has_role(_uid,'super_admin') $$;

create or replace function public.claim_first_admin() returns boolean language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if exists(select 1 from user_roles where role in ('admin','super_admin')) then return false; end if;
  insert into user_roles(user_id, role) values (auth.uid(),'super_admin') on conflict do nothing;
  return true;
end $$;

create or replace function public.admin_stats() returns json language plpgsql stable security definer set search_path=public as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'not allowed'; end if;
  return json_build_object(
    'users',(select count(*) from profiles),
    'rooms',(select count(*) from rooms),
    'posts',(select count(*) from posts),
    'families',(select count(*) from families),
    'open_reports',(select count(*) from reports where status='open'),
    'gifts',(select count(*) from gift_transactions),
    'coins',(select coalesce(sum(coins),0) from wallets));
end $$;

create or replace function public.admin_resolve_report(_report uuid, _status text, _reply text) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'not allowed'; end if;
  if _status not in ('open','reviewing','resolved','rejected') then raise exception 'bad status'; end if;
  update reports set status=_status, admin_reply=nullif(_reply,'') where id=_report;
end $$;

create or replace function public.admin_delete_room(_room uuid) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'not allowed'; end if;
  delete from rooms where id=_room;
end $$;

create or replace function public.admin_delete_post(_post uuid) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'not allowed'; end if;
  delete from posts where id=_post;
end $$;

create or replace function public.admin_grant_coins(_user uuid, _amount int) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'not allowed'; end if;
  if _amount = 0 or abs(_amount) > 1000000 then raise exception 'bad amount'; end if;
  insert into wallets(user_id, coins) values (_user, greatest(_amount,0))
    on conflict (user_id) do update set coins = greatest(wallets.coins + _amount, 0), updated_at=now();
end $$;

create or replace function public.admin_set_vip(_user uuid, _vip int) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'not allowed'; end if;
  update profiles set vip_level = greatest(0, least(_vip, 10)) where id=_user;
end $$;

create or replace function public.admin_set_role(_user uuid, _role app_role, _grant boolean) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.has_role(auth.uid(),'super_admin') then raise exception 'only super admin'; end if;
  if _grant then insert into user_roles(user_id, role) values (_user,_role) on conflict do nothing;
  else delete from user_roles where user_id=_user and role=_role; end if;
end $$;

create or replace function public.admin_list_users(_q text) returns table(id uuid, display_name text, display_no bigint, level int, vip_level int, coins bigint, roles text[], created_at timestamptz)
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'not allowed'; end if;
  return query select p.id, p.display_name::text, p.display_no::bigint, p.level::int, p.vip_level::int, coalesce(w.coins,0)::bigint,
    coalesce((select array_agg(r.role::text) from user_roles r where r.user_id=p.id), '{}'), p.created_at
  from profiles p left join wallets w on w.user_id=p.id
  where _q is null or _q='' or p.display_name ilike '%'||_q||'%' or p.display_no::text = _q
  order by p.created_at desc limit 100;
end $$;

revoke execute on function public.claim_first_admin, public.admin_stats, public.admin_resolve_report, public.admin_delete_room, public.admin_delete_post, public.admin_grant_coins, public.admin_set_vip, public.admin_set_role, public.admin_list_users from anon, public;
grant execute on function public.is_admin, public.claim_first_admin, public.admin_stats, public.admin_resolve_report, public.admin_delete_room, public.admin_delete_post, public.admin_grant_coins, public.admin_set_vip, public.admin_set_role, public.admin_list_users to authenticated;