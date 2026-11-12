-- Repair direct-message creation, lucky gift catalog reads, and audit UUID typing.
-- RPCs stay authenticated and validate the acting user; no broad table write grants.

create or replace function public.get_or_create_conversation(_other uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if _other is null or _other = v_uid then raise exception 'invalid_recipient'; end if;
  if not exists (select 1 from public.profiles where id = _other) then
    raise exception 'user_not_found';
  end if;
  if exists (
    select 1 from public.user_blocks
    where (blocker_id = v_uid and blocked_id = _other)
       or (blocker_id = _other and blocked_id = v_uid)
  ) then
    raise exception 'messaging_blocked';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(least(v_uid::text, _other::text) || ':' || greatest(v_uid::text, _other::text), 0)
  );

  select id into v_id
  from public.conversations
  where (user_a = v_uid and user_b = _other)
     or (user_a = _other and user_b = v_uid)
  order by last_at desc
  limit 1;

  if v_id is null then
    insert into public.conversations(user_a, user_b)
    values (v_uid, _other)
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

revoke all on function public.get_or_create_conversation(uuid) from public, anon;
grant execute on function public.get_or_create_conversation(uuid) to authenticated;

-- The existing RLS policy limits lucky gifts to active catalog rows.
grant select on table public.lucky_gifts to authenticated;

create or replace function public.admin_grant_store_item(_user uuid, _item uuid, _equip boolean default false)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_kind text;
  v_asset_key text;
  v_name text;
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then
    raise exception 'admin_required';
  end if;

  select kind, asset_key, name into v_kind, v_asset_key, v_name
  from public.store_items where id = _item;
  if not found then raise exception 'store_item_not_found'; end if;
  if not exists (select 1 from public.profiles where id = _user) then
    raise exception 'user_not_found';
  end if;

  insert into public.user_items(user_id, item_id, acquired_at)
  values (_user, _item, now())
  on conflict(user_id, item_id) do nothing;

  if v_kind = 'badge' then
    insert into public.user_badges(user_id, badge_key, badge_name, badge_asset_key, badge_color)
    values (_user, v_asset_key, v_name, v_asset_key, '#D4AF37')
    on conflict(user_id, badge_key)
    do update set badge_name = excluded.badge_name,
                  badge_asset_key = excluded.badge_asset_key;
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
$$;

revoke all on function public.admin_grant_store_item(uuid, uuid, boolean) from public, anon;
grant execute on function public.admin_grant_store_item(uuid, uuid, boolean) to authenticated;
