alter table public.store_items add column if not exists duration_hours integer not null default 0;
alter table public.user_items add column if not exists expires_at timestamptz;
alter table public.lucky_gift_bar_config add column if not exists asset_key text;
alter table public.lucky_gift_bar_config add column if not exists global_min_reward bigint not null default 10000;

create index if not exists user_items_active_expiry_idx on public.user_items(user_id,expires_at);

create or replace function public.admin_save_store_item(_id uuid,_asset_key text,_description text,_kind text,_name text,_price bigint,_sort_order integer,_hours integer default 0)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_id uuid:=_id;
begin
 if not public.is_admin((select auth.uid())) then raise exception 'not allowed'; end if;
 if _hours is null or _hours<0 or _hours>87600 then raise exception 'invalid_store_duration'; end if;
 if v_id is null then insert into public.store_items(asset_key,description,kind,name,price,sort_order,duration_hours) values(_asset_key,_description,_kind,_name,_price,_sort_order,_hours) returning id into v_id;
 else update public.store_items set asset_key=_asset_key,description=_description,kind=_kind,name=_name,price=_price,sort_order=_sort_order,duration_hours=_hours where id=v_id;
 end if;
 return v_id;
end $function$;

create or replace function public.buy_item(_item_id uuid)
returns bigint language plpgsql security definer set search_path='public','auth','pg_temp'
as $function$
declare v_price bigint; v_name text; v_duration integer; v_balance bigint;
begin
 select price,name,duration_hours into v_price,v_name,v_duration from public.store_items where id=_item_id and coalesce(is_direct_grant,false)=false and (expires_at is null or expires_at>now());
 if v_price is null then raise exception 'item unavailable'; end if;
 select coins into v_balance from public.wallets where user_id=auth.uid() for update;
 if coalesce(v_balance,0)<v_price then raise exception 'insufficient coins'; end if;
 update public.wallets set coins=coins-v_price,updated_at=now() where user_id=auth.uid();
 insert into public.user_items(user_id,item_id,expires_at) values(auth.uid(),_item_id,case when coalesce(v_duration,0)=0 then null else now()+make_interval(hours=>v_duration) end);
 insert into public.wallet_transactions(user_id,currency,amount,reason,kind,note,ref_id) values(auth.uid(),'coins',-v_price,'item_purchase','purchase','شراء '||v_name,_item_id);
 return v_balance-v_price;
end $function$;

create or replace function public.equip_item(_item_id uuid,_equip boolean)
returns void language plpgsql security definer set search_path='public','auth','pg_temp'
as $function$
declare k text; v_asset_key text;
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 select s.kind,s.asset_key into k,v_asset_key from public.store_items s join public.user_items ui on ui.item_id=s.id and ui.user_id=auth.uid()
 where s.id=_item_id and (ui.expires_at is null or ui.expires_at>now()) and (s.expires_at is null or s.expires_at>now());
 if not found then raise exception 'item_expired_or_not_owned'; end if;
 if k='entry' then update public.profiles set equipped_entry=case when _equip then v_asset_key else null end where id=auth.uid();
 elsif k='frame' then update public.profiles set equipped_frame=case when _equip then v_asset_key else null end where id=auth.uid();
 elsif k='bubble' then update public.profiles set chat_bubble_asset_key=case when _equip then v_asset_key else null end where id=auth.uid();
 elsif k='sound_wave' then update public.profiles set sound_wave_asset_key=case when _equip then v_asset_key else null end where id=auth.uid();
 elsif k='profile_card' then update public.profiles set profile_card_asset_key=case when _equip then v_asset_key else null end where id=auth.uid();
 else raise exception 'item_cannot_be_equipped'; end if;
end $function$;

create or replace function public.admin_upsert_lucky_gift_bar_config(_enabled boolean default true,_position text default 'top',_width_px integer default 390,_gift_size_px integer default 48,_show_name boolean default true,_asset_key text default null,_global_min_reward bigint default 10000)
returns void language plpgsql security definer set search_path='public','auth','pg_temp'
as $function$
begin
 if auth.uid() is null or not public.is_admin(auth.uid()) then raise exception 'admin_required'; end if;
 if _position not in ('top','bottom','center') then raise exception 'invalid_position'; end if;
 if _width_px<240 or _width_px>700 or _gift_size_px<24 or _gift_size_px>120 then raise exception 'invalid_dimensions'; end if;
 if _global_min_reward<0 or _global_min_reward>1000000000 then raise exception 'invalid_global_reward'; end if;
 insert into public.lucky_gift_bar_config(id,enabled,position,duration_ms,width_px,gift_size_px,show_name,asset_key,global_min_reward)
 values(true,coalesce(_enabled,true),_position,3000,_width_px,_gift_size_px,coalesce(_show_name,true),nullif(btrim(_asset_key),''),_global_min_reward)
 on conflict(id) do update set enabled=excluded.enabled,position=excluded.position,duration_ms=3000,width_px=excluded.width_px,gift_size_px=excluded.gift_size_px,show_name=excluded.show_name,asset_key=excluded.asset_key,global_min_reward=excluded.global_min_reward,updated_at=now(),updated_by=auth.uid();
end $function$;