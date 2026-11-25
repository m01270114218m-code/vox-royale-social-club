create or replace function public.purchase_vip(p_level integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  actor uuid := auth.uid();
  amount bigint;
  balance bigint;
  expiry timestamptz;
begin
  if actor is null then raise exception 'سجل الدخول أولاً'; end if;
  if p_level is null or p_level < 1 or p_level > 12 then
    raise exception 'مستوى VIP غير صحيح';
  end if;
  if exists(select 1 from public.profiles where id=actor and banned) then
    raise exception 'الحساب محظور';
  end if;

  amount := p_level::bigint * 30000;

  update public.profiles
     set coins = coins - amount,
         vip = p_level,
         vip_until = greatest(coalesce(vip_until, now()), now()) + interval '30 days',
         updated_at = now()
   where id = actor and coins >= amount
   returning coins, vip_until into balance, expiry;

  if not found then
    if not exists(select 1 from public.profiles where id=actor) then
      raise exception 'الملف الشخصي غير موجود';
    end if;
    raise exception 'رصيد غير كاف لشراء VIP';
  end if;

  insert into public.coin_ledger(sender_id,recipient_id,amount,kind)
  values(actor,actor,amount,'vip_purchase');

  return jsonb_build_object('ok',true,'vip',p_level,'price',amount,'coins',balance,'vip_until',expiry);
end;
$function$;

revoke all on function public.purchase_vip(integer) from public;
grant execute on function public.purchase_vip(integer) to authenticated;
