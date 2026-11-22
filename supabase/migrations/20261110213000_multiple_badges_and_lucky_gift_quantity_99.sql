-- Allow multiple equipped profile badges and support up to 99 lucky gifts per send.
create or replace function public.equip_badge(_badge uuid, _equip boolean)
returns void language plpgsql security definer set search_path='public','pg_temp'
as $function$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from public.user_badges where id=_badge and user_id=auth.uid()) then raise exception 'badge_not_owned'; end if;
  update public.user_badges set is_equipped=_equip where id=_badge and user_id=auth.uid();
end;
$function$;
revoke all on function public.equip_badge(uuid,boolean) from public,anon;
grant execute on function public.equip_badge(uuid,boolean) to authenticated;

create or replace function public.send_lucky_gift(_gift uuid,_receiver uuid,_room uuid,_qty integer)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
 v_uid uuid := (select auth.uid()); v_price bigint; v_cost bigint; v_balance bigint;
 v_chance numeric; v_min_reward bigint; v_max_reward bigint; v_won boolean; v_reward bigint:=0;
 v_asset_key text; v_name text;
begin
 if v_uid is null then raise exception 'not authenticated'; end if;
 if _qty is null or _qty<1 or _qty>99 then raise exception 'invalid quantity'; end if;
 if not exists(select 1 from public.room_members rm where rm.room_id=_room and rm.user_id=v_uid) then raise exception 'join room first'; end if;
 if not exists(select 1 from public.room_members rm where rm.room_id=_room and rm.user_id=_receiver) then raise exception 'receiver not in room'; end if;
 select lg.price,lg.win_chance,lg.min_reward,lg.max_reward,lg.asset_key,lg.name into v_price,v_chance,v_min_reward,v_max_reward,v_asset_key,v_name from public.lucky_gifts lg where lg.id=_gift and lg.active=true;
 if v_price is null then raise exception 'lucky gift unavailable'; end if;
 v_cost:=v_price*_qty;
 select w.coins into v_balance from public.wallets w where w.user_id=v_uid for update;
 if coalesce(v_balance,0)<v_cost then raise exception 'insufficient coins'; end if;
 update public.wallets w set coins=w.coins-v_cost,updated_at=now() where w.user_id=v_uid;
 v_won:=random()*100<v_chance;
 if v_won and v_max_reward>0 then v_reward:=floor(v_min_reward+random()*(v_max_reward-v_min_reward+1)); end if;
 if v_reward>0 then
  insert into public.wallets(user_id,coins,diamonds) values(_receiver,v_reward,0)
  on conflict(user_id) do update set coins=public.wallets.coins+excluded.coins,updated_at=now();
  insert into public.wallet_transactions(user_id,currency,amount,reason,kind,note) values(_receiver,'coins',v_reward,'lucky_reward','lucky_gift','مردود هدية حظ: '||v_name);
 end if;
 insert into public.wallet_transactions(user_id,currency,amount,reason,kind,note) values(v_uid,'coins',-v_cost,'lucky_gift','lucky_gift','إرسال هدية حظ: '||v_name);
 return jsonb_build_object('won',v_won,'reward',v_reward,'asset_key',v_asset_key,'name',v_name);
end;
$function$;
revoke all on function public.send_lucky_gift(uuid,uuid,uuid,integer) from public,anon;
grant execute on function public.send_lucky_gift(uuid,uuid,uuid,integer) to authenticated;