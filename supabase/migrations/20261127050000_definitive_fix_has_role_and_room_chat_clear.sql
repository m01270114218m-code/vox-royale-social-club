-- Definitive repair for role checks used by room chat deletion.
-- Avoid calling another has_role overload: deployments may only have the
-- two-argument helper, which caused PostgREST/PostgreSQL to report
-- public.has_role(unknown) does not exist.
create or replace function public.has_role(_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
     and exists (
       select 1
       from public.user_roles ur
       where ur.user_id = auth.uid()
         and ur.role::text = _role
     );
$$;

revoke all on function public.has_role(text) from public, anon;
grant execute on function public.has_role(text) to authenticated;

create or replace function public.clear_room_chat(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
begin
  if v_uid is null then
    raise exception 'غير مصرح';
  end if;

  select r.owner_id
    into v_owner
  from public.rooms r
  where r.id = p_room_id;

  if v_owner is null then
    raise exception 'الغرفة غير موجودة';
  end if;

  if v_owner <> v_uid
     and not exists (
       select 1
       from public.user_roles ur
       where ur.user_id = v_uid
         and ur.role::text = 'admin'
     ) then
    raise exception 'ليس لديك صلاحية مسح دردشة الغرفة';
  end if;

  delete from public.chat_messages
  where room_id = p_room_id
    and message_type = 'text';

  return true;
end;
$$;

revoke all on function public.clear_room_chat(uuid) from public, anon;
grant execute on function public.clear_room_chat(uuid) to authenticated;
