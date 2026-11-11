create or replace function public.recalculate_support_level(_user uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_support bigint;
  v_level integer;
begin
  if auth.uid() is null
     or (auth.uid() <> _user and not public.is_admin(auth.uid())) then
    raise exception 'not_allowed';
  end if;

  select coalesce(sum(total_price), 0)
    into v_support
  from public.gift_transactions
  where receiver_id = _user;

  v_level := greatest(1, least(999, floor(sqrt(v_support / 1000.0)) + 1));

  update public.profiles
  set support_xp = v_support,
      total_gifts_received = (
        select coalesce(sum(quantity), 0)
        from public.gift_transactions
        where receiver_id = _user
      ),
      total_gifts_value = v_support,
      level = v_level
  where id = _user;
end;
$$;
