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
  if v_uid is null then raise exception 'غير مصرح'; end if;
  select owner_id into v_owner from public.rooms where id = p_room_id;
  if v_owner is null then raise exception 'الغرفة غير موجودة'; end if;
  if v_owner <> v_uid and not public.has_role('admin') then
    raise exception 'ليس لديك صلاحية مسح دردشة الغرفة';
  end if;
  delete from public.chat_messages where room_id = p_room_id and message_type = 'text';
  return true;
end;
$$;
revoke all on function public.clear_room_chat(uuid) from public;
grant execute on function public.clear_room_chat(uuid) to authenticated;
