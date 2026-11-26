create table if not exists public.account_device_registry (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_hash text not null,
  ip_hash text,
  created_at timestamptz not null default now()
);
create unique index if not exists account_device_registry_device_user_uidx
  on public.account_device_registry(device_hash, user_id);
create index if not exists account_device_registry_device_hash_idx
  on public.account_device_registry(device_hash);
create index if not exists account_device_registry_ip_hash_idx
  on public.account_device_registry(ip_hash);

create table if not exists public.account_registration_requests (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  email text not null,
  device_hash text not null,
  ip_hash text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','fulfilled')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists account_registration_requests_status_created_idx
  on public.account_registration_requests(status, created_at desc);
create index if not exists account_registration_requests_email_device_idx
  on public.account_registration_requests(lower(email), device_hash);

alter table public.account_device_registry enable row level security;
alter table public.account_registration_requests enable row level security;
revoke all on public.account_device_registry from anon, authenticated;
revoke all on public.account_registration_requests from anon, authenticated;
grant select, update on public.account_registration_requests to authenticated;

drop policy if exists "Admins can view account registration requests" on public.account_registration_requests;
create policy "Admins can view account registration requests"
on public.account_registration_requests for select to authenticated
using (public.has_role((select auth.uid()), 'admin'));

drop policy if exists "Admins can review account registration requests" on public.account_registration_requests;
create policy "Admins can review account registration requests"
on public.account_registration_requests for update to authenticated
using (public.has_role((select auth.uid()), 'admin'))
with check (
  public.has_role((select auth.uid()), 'admin')
  and status in ('approved','rejected','fulfilled')
  and (reviewed_by is null or reviewed_by = (select auth.uid()))
);

comment on table public.account_device_registry is 'Server-only hashed device and network registrations for account review.';
comment on table public.account_registration_requests is 'Admin-reviewed requests for additional account registrations; passwords are never stored here.';
