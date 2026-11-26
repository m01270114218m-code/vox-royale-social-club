alter table public.account_registration_requests
  add column if not exists requester_id uuid references auth.users(id) on delete cascade;

create index if not exists account_registration_requests_requester_idx
  on public.account_registration_requests(requester_id, created_at desc);

create unique index if not exists account_registration_requests_pending_requester_uidx
  on public.account_registration_requests(requester_id)
  where requester_id is not null and status = 'pending';

create or replace function public.request_account_approval(
  p_display_name text,
  p_email text
) returns public.account_registration_requests
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row public.account_registration_requests;
begin
  if v_user is null then raise exception 'UNAUTHENTICATED'; end if;
  if nullif(trim(p_display_name), '') is null then raise exception 'DISPLAY_NAME_REQUIRED'; end if;
  if nullif(trim(p_email), '') is null then raise exception 'EMAIL_REQUIRED'; end if;

  select * into v_row
  from public.account_registration_requests
  where requester_id = v_user and status = 'pending'
  order by created_at desc limit 1;

  if found then return v_row; end if;

  insert into public.account_registration_requests(
    requester_id, display_name, email, device_hash, status
  )
  values (
    v_user, left(trim(p_display_name), 80), lower(trim(p_email)),
    'user:' || v_user::text, 'pending'
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.request_account_approval(text,text) from public, anon;
grant execute on function public.request_account_approval(text,text) to authenticated;

drop policy if exists "Users can view own account registration requests" on public.account_registration_requests;
create policy "Users can view own account registration requests"
on public.account_registration_requests for select to authenticated
using (requester_id = (select auth.uid()));

revoke insert on public.account_registration_requests from authenticated;
grant select, update on public.account_registration_requests to authenticated;