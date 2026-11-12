-- Prevent one authenticated account from creating more than one room.
-- Advisory transaction locking closes the race where two create requests arrive together.
create or replace function public.create_room(_name text, _description text, _category text, _country text, _is_private boolean, _seat_count integer)
returns uuid
language plpgsql
set search_path to 'pg_catalog','public','private','auth','extensions','pg_temp'
as $function$
declare
  rid uuid;
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_uid::text));

  if exists (select 1 from public.rooms where owner_id = v_uid) then
    raise exception 'user_already_has_room';
  end if;

  insert into public.rooms(name,description,category,country,is_private,seat_count,owner_id)
  values(_name,_description,_category,_country,_is_private,greatest(1,_seat_count),v_uid)
  returning id into rid;

  for i in 0..greatest(1,_seat_count)-1 loop
    insert into public.room_seats(room_id,seat_index) values(rid,i);
  end loop;

  return rid;
end
$function$;

revoke execute on function public.create_room(text,text,text,text,boolean,integer) from anon;
grant execute on function public.create_room(text,text,text,text,boolean,integer) to authenticated;
