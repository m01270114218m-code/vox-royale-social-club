create table if not exists public.user_bans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reason text not null default '',
  banned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz
);

create table if not exists public.device_bans (
  id uuid primary key default gen_random_uuid(),
  device_hash text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  reason text not null default '',
  banned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz
);

create index if not exists device_bans_user_id_idx on public.device_bans(user_id);
create index if not exists user_bans_active_idx on public.user_bans(user_id, expires_at) where revoked_at is null;
create index if not exists device_bans_active_idx on public.device_bans(device_hash, expires_at) where revoked_at is null;

alter table public.user_bans enable row level security;
alter table public.device_bans enable row level security;

drop policy if exists user_bans_admin_read on public.user_bans;
create policy user_bans_admin_read on public.user_bans
for select to authenticated using (public.is_admin((select auth.uid())));

drop policy if exists device_bans_admin_read on public.device_bans;
create policy device_bans_admin_read on public.device_bans
for select to authenticated using (public.is_admin((select auth.uid())));

create or replace function public.admin_set_user_ban(
  _user uuid, _banned boolean, _reason text default '', _hours integer default null
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_admin((select auth.uid())) then raise exception 'not allowed'; end if;
  if _user is null then raise exception 'invalid_user'; end if;
  if _hours is not null and (_hours < 0 or _hours > 87600) then raise exception 'invalid_ban_duration'; end if;
  if _banned then
    insert into public.user_bans(user_id, reason, banned_by, created_at, expires_at, revoked_at)
    values (_user, coalesce(nullif(btrim(_reason), ''), 'مخالفة قواعد التطبيق'), auth.uid(), now(),
      case when coalesce(_hours, 0) = 0 then null else now() + make_interval(hours => _hours) end, null)
    on conflict (user_id) do update set reason = excluded.reason, banned_by = excluded.banned_by,
      created_at = now(), expires_at = excluded.expires_at, revoked_at = null;
  else
    update public.user_bans set revoked_at = now() where user_id = _user and revoked_at is null;
  end if;
end;
$$;

create or replace function public.admin_set_device_ban(
  _user uuid, _banned boolean, _reason text default '', _hours integer default null
) returns void
language plpgsql security definer set search_path = ''
as $$
declare v_device text;
begin
  if auth.uid() is null or not public.is_admin((select auth.uid())) then raise exception 'not allowed'; end if;
  if _user is null then raise exception 'invalid_user'; end if;
  if _hours is not null and (_hours < 0 or _hours > 87600) then raise exception 'invalid_ban_duration'; end if;
  select da.device_hash into v_device from public.device_accounts da where da.user_id = _user;
  if v_device is null then raise exception 'device_not_registered'; end if;
  if _banned then
    insert into public.device_bans(device_hash, user_id, reason, banned_by, created_at, expires_at, revoked_at)
    values (v_device, _user, coalesce(nullif(btrim(_reason), ''), 'حظر الجهاز'), auth.uid(), now(),
      case when coalesce(_hours, 0) = 0 then null else now() + make_interval(hours => _hours) end, null)
    on conflict (device_hash) do update set user_id = excluded.user_id, reason = excluded.reason,
      banned_by = excluded.banned_by, created_at = now(), expires_at = excluded.expires_at, revoked_at = null;
  else
    update public.device_bans set revoked_at = now() where device_hash = v_device and revoked_at is null;
  end if;
end;
$$;

create or replace function public.register_device(_device text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_reason text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if _device is null or length(btrim(_device)) < 16 or length(_device) > 200 then raise exception 'invalid_device_id'; end if;
  select b.reason into v_reason from public.user_bans b
  where b.user_id = v_uid and b.revoked_at is null and (b.expires_at is null or b.expires_at > now()) limit 1;
  if v_reason is not null then raise exception 'account_banned: %', v_reason; end if;
  select b.reason into v_reason from public.device_bans b
  where b.device_hash = _device and b.revoked_at is null and (b.expires_at is null or b.expires_at > now()) limit 1;
  if v_reason is not null then raise exception 'device_banned: %', v_reason; end if;
  insert into public.device_accounts(user_id, device_hash) values (v_uid, _device)
  on conflict (user_id) do update set device_hash = excluded.device_hash, created_at = now();
  return v_uid;
end;
$$;

revoke all on function public.admin_set_user_ban(uuid, boolean, text, integer) from public, anon;
revoke all on function public.admin_set_device_ban(uuid, boolean, text, integer) from public, anon;
revoke all on function public.register_device(text) from public, anon;
grant execute on function public.admin_set_user_ban(uuid, boolean, text, integer) to authenticated;
grant execute on function public.admin_set_device_ban(uuid, boolean, text, integer) to authenticated;
grant execute on function public.register_device(text) to authenticated;
