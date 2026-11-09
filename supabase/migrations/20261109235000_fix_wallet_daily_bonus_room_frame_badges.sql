create table if not exists public.daily_bonus_claims (
  user_id uuid not null references auth.users(id) on delete cascade,
  claimed_on date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, claimed_on)
);
alter table public.daily_bonus_claims enable row level security;
revoke all on table public.daily_bonus_claims from public, anon, authenticated;

create or replace function public.claim_daily_bonus()
returns bigint
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_claimed boolean;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  insert into public.daily_bonus_claims(user_id, claimed_on)
  values (v_user, (now() at time zone 'UTC')::date)
  on conflict (user_id, claimed_on) do nothing
  returning true into v_claimed;
  if not coalesce(v_claimed, false) then raise exception 'daily_bonus_already_claimed'; end if;
  insert into public.wallets(user_id, coins, diamonds)
  values (v_user, 100, 0)
  on conflict (user_id) do update
    set coins = public.wallets.coins + 100, updated_at = now();
  return 100;
end;
$function$;
revoke all on function public.claim_daily_bonus() from public, anon;
grant execute on function public.claim_daily_bonus() to authenticated;

create or replace function public.set_room_frame(_room uuid, _asset_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then raise exception 'not allowed'; end if;
  if not exists (select 1 from public.rooms where id = _room) then raise exception 'room_not_found'; end if;
  if _asset_key is not null and not exists (
    select 1 from public.admin_assets where asset_key = _asset_key and is_active = true
  ) then raise exception 'asset unavailable'; end if;
  update public.rooms set room_frame_asset_key = _asset_key where id = _room;
end;
$function$;
revoke all on function public.set_room_frame(uuid, text) from public, anon;
grant execute on function public.set_room_frame(uuid, text) to authenticated;

create or replace function public.admin_grant_badge(
  _user uuid, _badge_key text, _badge_name text, _asset_key text, _color text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then raise exception 'not_admin'; end if;
  if not exists (select 1 from public.profiles where id = _user) then raise exception 'user_not_found'; end if;
  if nullif(btrim(_badge_key), '') is null or nullif(btrim(_badge_name), '') is null then raise exception 'invalid_badge'; end if;
  update public.user_badges set is_equipped = false where user_id = _user;
  insert into public.user_badges(user_id, badge_key, badge_name, badge_asset_key, badge_color, is_equipped)
  values (_user, _badge_key, _badge_name, _asset_key, coalesce(_color, '#D4AF37'), true)
  on conflict (user_id, badge_key) do update
    set badge_name = excluded.badge_name,
        badge_asset_key = excluded.badge_asset_key,
        badge_color = excluded.badge_color,
        is_equipped = true;
end;
$function$;
revoke all on function public.admin_grant_badge(uuid, text, text, text, text) from public, anon;
grant execute on function public.admin_grant_badge(uuid, text, text, text, text) to authenticated;

create or replace function public.admin_grant_store_item(_user uuid, _item uuid, _equip boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_kind text;
  v_asset_key text;
  v_name text;
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then raise exception 'admin_required'; end if;
  select kind, asset_key, name into v_kind, v_asset_key, v_name
  from public.store_items where id = _item;
  if not found then raise exception 'store_item_not_found'; end if;
  if not exists (select 1 from public.profiles where id = _user) then raise exception 'user_not_found'; end if;
  insert into public.user_items(user_id, item_id, acquired_at)
  values (_user, _item, now())
  on conflict (user_id, item_id) do nothing;
  if v_kind = 'badge' then
    update public.user_badges set is_equipped = false where user_id = _user;
    insert into public.user_badges(user_id, badge_key, badge_name, badge_asset_key, badge_color, is_equipped)
    values (_user, v_asset_key, v_name, v_asset_key, '#D4AF37', true)
    on conflict (user_id, badge_key) do update
      set badge_name = excluded.badge_name,
          badge_asset_key = excluded.badge_asset_key,
          badge_color = excluded.badge_color,
          is_equipped = true;
  elsif _equip then
    if v_kind = 'frame' then
      update public.profiles set equipped_frame = v_asset_key where id = _user;
    elsif v_kind = 'entry' then
      update public.profiles set equipped_entry = v_asset_key where id = _user;
    else
      raise exception 'item_cannot_be_equipped';
    end if;
  end if;
  perform public.write_audit('admin_grant_store_item', v_kind || ':' || v_asset_key, _user, 'user');
end;
$function$;
revoke all on function public.admin_grant_store_item(uuid, uuid, boolean) from public, anon;
grant execute on function public.admin_grant_store_item(uuid, uuid, boolean) to authenticated;

with ranked as (
  select id, user_id, row_number() over (partition by user_id order by acquired_at desc, id desc) as rn
  from public.user_badges
)
update public.user_badges b
set is_equipped = true
from ranked r
where b.id = r.id and r.rn = 1
  and not exists (
    select 1 from public.user_badges already
    where already.user_id = b.user_id and already.is_equipped = true
  );
