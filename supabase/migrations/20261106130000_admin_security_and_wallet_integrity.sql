-- Harden admin RPCs and make wallet adjustments atomic.
-- Existing app records are preserved; this migration changes authorization and write logic only.

create or replace function public.admin_set_role(_user uuid, _role public.app_role, _grant boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_remaining bigint;
begin
  if auth.uid() is null or not private.has_role(auth.uid(), 'super_admin') then
    raise exception 'super_admin_required';
  end if;

  if _role not in ('admin'::public.app_role, 'moderator'::public.app_role) then
    raise exception 'unsupported_managed_role';
  end if;

  if _grant then
    insert into public.user_roles(user_id, role)
    values (_user, _role)
    on conflict do nothing;
  else
    delete from public.user_roles
    where user_id = _user and role = _role;
  end if;

  perform public.write_audit(
    'admin_set_role',
    case when _grant then 'grant ' else 'revoke ' end || _role::text,
    _user,
    'user'
  );
end;
$$;

create or replace function public.admin_grant_coins(_user uuid, _amount bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance bigint;
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then
    raise exception 'admin_required';
  end if;
  if _amount = 0 then
    raise exception 'amount_must_not_be_zero';
  end if;

  insert into public.wallets(user_id, coins)
  values (_user, _amount)
  on conflict (user_id) do update
    set coins = public.wallets.coins + excluded.coins,
        updated_at = now()
    where public.wallets.coins + excluded.coins >= 0
  returning coins into v_balance;

  if v_balance is null then
    raise exception 'insufficient_balance_or_user_not_found';
  end if;

  insert into public.wallet_transactions(user_id, amount, currency, reason)
  values (_user, _amount, 'coins', 'admin_adjustment');

  perform public.write_audit('admin_adjust_coins', _amount::text, _user, 'user');
  return v_balance;
end;
$$;

-- SECURITY DEFINER admin RPCs must never be callable by anonymous clients.
-- Every admin RPC has its own authorization check in its function body.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.proname like 'admin\_%' escape '\' or p.proname in ('admin_stats', 'get_analytics', 'claim_first_admin'))
  loop
    execute pg_catalog.format('revoke all on function %s from public, anon', fn.signature);
    execute pg_catalog.format('grant execute on function %s to authenticated', fn.signature);
  end loop;
end;
$$;

-- Auth trigger only: it is not an RPC endpoint for browser clients.
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Keep the new wallet and role routines callable only by signed-in sessions.
revoke all on function public.admin_set_role(uuid, public.app_role, boolean) from public, anon;
grant execute on function public.admin_set_role(uuid, public.app_role, boolean) to authenticated;
revoke all on function public.admin_grant_coins(uuid, bigint) from public, anon;
grant execute on function public.admin_grant_coins(uuid, bigint) to authenticated;
