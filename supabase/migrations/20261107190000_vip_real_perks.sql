-- Real VIP perks: persistent identity colors, chat bubble color, and moderation protection.
alter table public.profiles
  add column if not exists chat_bubble_color text not null default '#2b2448';

create or replace function public.vip_perk_color(_level integer)
returns text
language sql immutable
as $$
  select case greatest(0,least(6,coalesce(_level,0)))
    when 1 then '#7C3AED'
    when 2 then '#38BDF8'
    when 3 then '#F59E0B'
    when 4 then '#EC4899'
    when 5 then '#EF4444'
    when 6 then '#FBBF24'
    else '#D4AF37'
  end
$$;

create or replace function public.vip_bubble_color(_level integer)
returns text
language sql immutable
as $$
  select case greatest(0,least(6,coalesce(_level,0)))
    when 1 then '#24163F'
    when 2 then '#102A43'
    when 3 then '#3B2708'
    when 4 then '#3A102B'
    when 5 then '#3A1111'
    when 6 then '#3A2A05'
    else '#2b2448'
  end
$$;

create or replace function public.vip_has_moderation_protection(_level integer)
returns boolean
language sql immutable
as $$
  select coalesce(_level,0) >= 5
$$;

create or replace function public.apply_vip_perks()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if coalesce(new.vip_level,0) > 0 then
    new.name_color := public.vip_perk_color(new.vip_level);
    new.chat_bubble_color := public.vip_bubble_color(new.vip_level);
    if coalesce(new.id_color,'') = '' or new.id_color = '#D4AF37' then
      new.id_color := public.vip_perk_color(new.vip_level);
    end if;
  else
    new.chat_bubble_color := '#2b2448';
  end if;
  return new;
end
$$;

drop trigger if exists profiles_apply_vip_perks on public.profiles;
create trigger profiles_apply_vip_perks
before insert or update of vip_level on public.profiles
for each row execute function public.apply_vip_perks();

update public.profiles
set name_color = public.vip_perk_color(vip_level),
    chat_bubble_color = public.vip_bubble_color(vip_level),
    id_color = case when coalesce(id_color,'') = '' or id_color = '#D4AF37'
                    then public.vip_perk_color(vip_level) else id_color end
where coalesce(vip_level,0) > 0;

create or replace function public.buy_vip(_level int)
returns bigint
language plpgsql
security definer
set search_path=public
as $$
declare
  v_price bigint;
  v_cur int;
  v_bal bigint;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if _level < 1 or _level > 6 then raise exception 'bad level'; end if;
  v_price := (array[1000,3000,8000,20000,50000,120000])[_level];
  select vip_level into v_cur from profiles where id=auth.uid() for update;
  if coalesce(v_cur,0) >= _level then raise exception 'already vip'; end if;
  select coins into v_bal from wallets where user_id=auth.uid() for update;
  if coalesce(v_bal,0) < v_price then raise exception 'insufficient coins'; end if;
  update wallets set coins=coins-v_price,updated_at=now() where user_id=auth.uid();
  insert into wallet_transactions(user_id,currency,amount,reason)
    values (auth.uid(),'coins',-v_price,'vip_purchase');
  update profiles set vip_level=_level where id=auth.uid();
  return v_bal-v_price;
end
$$;

revoke all on function public.buy_vip(integer) from anon, public;
grant execute on function public.buy_vip(integer) to authenticated;

-- Staff seat moderation: VIP 5/6 cannot be muted or kicked by room staff.
create or replace function public.staff_seat_action(_room uuid,_seat integer,_action text)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_actor uuid := auth.uid();
  v_target uuid;
  v_target_vip integer;
begin
  if v_actor is null or not public.is_room_staff(_room,v_actor) then
    raise exception 'not allowed';
  end if;

  select user_id into v_target
  from public.room_seats
  where room_id=_room and seat_index=_seat
  for update;

  if v_target is null then
    raise exception 'seat empty';
  end if;

  if v_target <> v_actor then
    select coalesce(vip_level,0) into v_target_vip from public.profiles where id=v_target;
    if _action in ('mute','kick') and public.vip_has_moderation_protection(v_target_vip) then
      raise exception 'vip_protected';
    end if;
  end if;

  if _action='mute' then
    update public.room_seats set is_muted=true,updated_at=now()
      where room_id=_room and seat_index=_seat;
  elsif _action='unmute' then
    update public.room_seats set is_muted=false,updated_at=now()
      where room_id=_room and seat_index=_seat;
  elsif _action='kick' then
    update public.room_seats set user_id=null,is_muted=false,updated_at=now()
      where room_id=_room and seat_index=_seat;
  elsif _action='lock' then
    update public.room_seats set is_locked=true,updated_at=now()
      where room_id=_room and seat_index=_seat;
  elsif _action='unlock' then
    update public.room_seats set is_locked=false,updated_at=now()
      where room_id=_room and seat_index=_seat;
  else
    raise exception 'invalid_action';
  end if;
end
$$;

revoke all on function public.staff_seat_action(uuid,integer,text) from public,anon;
grant execute on function public.staff_seat_action(uuid,integer,text) to authenticated;

-- Ban endpoint also protects VIP 5/6 from room bans.
create or replace function public.ban_user(_room uuid,_user uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_actor uuid := auth.uid();
  v_vip integer;
begin
  if v_actor is null or not public.is_room_staff(_room,v_actor) then raise exception 'not allowed'; end if;
  if _user = v_actor then raise exception 'cannot_ban_self'; end if;
  select coalesce(vip_level,0) into v_vip from public.profiles where id=_user;
  if public.vip_has_moderation_protection(v_vip) then raise exception 'vip_protected'; end if;
  insert into public.room_bans(room_id,user_id,banned_by)
    values(_room,_user,v_actor)
    on conflict (room_id,user_id) do update set banned_by=excluded.banned_by,banned_at=now();
  delete from public.room_seats where room_id=_room and user_id=_user;
  delete from public.room_members where room_id=_room and user_id=_user;
end
$$;

revoke all on function public.ban_user(uuid,uuid) from public,anon;
grant execute on function public.ban_user(uuid,uuid) to authenticated;
