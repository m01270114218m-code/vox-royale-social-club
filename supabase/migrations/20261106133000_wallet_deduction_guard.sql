-- Prevent negative wallet creation when an administrator deducts from a user without a wallet row.
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
  if _amount < 0 and not exists (select 1 from public.wallets where user_id = _user) then
    raise exception 'insufficient_balance';
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

revoke all on function public.admin_grant_coins(uuid, bigint) from public, anon;
grant execute on function public.admin_grant_coins(uuid, bigint) to authenticated;
