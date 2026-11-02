create or replace function public.update_room(_room uuid, _name text, _description text, _category text, _is_private boolean, _cover_url text) returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from rooms where id=_room and owner_id=auth.uid()) and not public.is_admin(auth.uid()) then raise exception 'not allowed'; end if;
  if length(trim(_name)) < 2 or length(_name) > 40 then raise exception 'bad name'; end if;
  update rooms set name=trim(_name), description=left(_description,200), category=coalesce(nullif(_category,''),category), is_private=_is_private, cover_url=_cover_url where id=_room;
end $$;
revoke execute on function public.update_room from anon, public;
grant execute on function public.update_room to authenticated;