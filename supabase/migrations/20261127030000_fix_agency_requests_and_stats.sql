create or replace function public.request_host_agency()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_id uuid;
begin
  if v_uid is null then raise exception 'سجّل الدخول أولاً'; end if;
  if exists(select 1 from public.user_roles where user_id=v_uid and role='host_agent') then
    raise exception 'الوكالة مفعّلة بالفعل';
  end if;
  select id into v_id from public.agencies where owner_id=v_uid and status='pending' limit 1;
  if v_id is not null then return v_id; end if;
  insert into public.agencies(owner_id,created_by,name,slogan,image_path,status)
  values(v_uid,v_uid,'وكالتي','','','pending')
  on conflict(owner_id) do update set status='pending'
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.request_host_agency() from public, anon;
grant execute on function public.request_host_agency() to authenticated;

create index if not exists agencies_owner_id_idx on public.agencies(owner_id);
