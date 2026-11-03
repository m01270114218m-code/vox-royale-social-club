create or replace function public.buy_vip(_level int) returns bigint language plpgsql security definer set search_path=public as $$
declare _price bigint; _cur int; _bal bigint;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if _level < 1 or _level > 6 then raise exception 'bad level'; end if;
  _price := (array[1000,3000,8000,20000,50000,120000])[_level];
  select vip_level into _cur from profiles where id=auth.uid();
  if _cur >= _level then raise exception 'already vip'; end if;
  select coins into _bal from wallets where user_id=auth.uid() for update;
  if coalesce(_bal,0) < _price then raise exception 'insufficient coins'; end if;
  update wallets set coins=coins-_price, updated_at=now() where user_id=auth.uid();
  insert into wallet_transactions(user_id,currency,amount,reason) values (auth.uid(),'coins',-_price,'vip_purchase');
  update profiles set vip_level=_level where id=auth.uid();
  return _bal-_price;
end $$;

create or replace function public.admin_list_reports(_status text) returns table(id uuid, reporter_id uuid, reporter_name text, target_type text, target_id uuid, category text, details text, status text, admin_reply text, created_at timestamptz)
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'not allowed'; end if;
  return query select r.id, r.reporter_id, p.display_name::text, r.target_type::text, r.target_id, r.category::text, r.details::text, r.status::text, r.admin_reply::text, r.created_at
  from reports r left join profiles p on p.id=r.reporter_id
  where _status is null or _status='' or r.status=_status order by r.created_at desc limit 200;
end $$;

revoke execute on function public.buy_vip, public.admin_list_reports from anon, public;
grant execute on function public.buy_vip, public.admin_list_reports to authenticated;