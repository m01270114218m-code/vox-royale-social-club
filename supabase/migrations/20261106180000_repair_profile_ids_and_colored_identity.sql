create sequence if not exists public.profiles_display_no_seq start with 100000;
update public.profiles set display_no=nextval('public.profiles_display_no_seq')
where display_no is null or display_no <= 0;
select setval('public.profiles_display_no_seq',greatest(coalesce((select max(display_no) from public.profiles),99999),99999),true);
alter table public.profiles alter column display_no set default nextval('public.profiles_display_no_seq');
create unique index if not exists profiles_display_no_unique_idx on public.profiles(display_no);
alter table public.profiles add column if not exists id_color text not null default '#D4AF37';
do $$
begin
  if not exists(select 1 from pg_constraint where conname='profiles_id_color_hex_check' and conrelid='public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_id_color_hex_check check(id_color ~ '^#[0-9A-Fa-f]{6}$');
  end if;
end $$;

create or replace function public.admin_update_user_identity(
  _user uuid,_display_no bigint default null,_level integer default null,_id_color text default null
) returns void
language plpgsql security definer set search_path = ''
as $$
declare v_old_no bigint; v_old_level integer; v_old_color text;
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then raise exception 'admin_required'; end if;
  if _display_no is not null and (_display_no < 100000 or _display_no > 999999999999) then raise exception 'invalid_display_id'; end if;
  if _level is not null and (_level < 1 or _level > 999) then raise exception 'invalid_level'; end if;
  if _id_color is not null and _id_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'invalid_id_color'; end if;
  select display_no,level,id_color into v_old_no,v_old_level,v_old_color from public.profiles where id=_user for update;
  if not found then raise exception 'user_not_found'; end if;
  update public.profiles set display_no=coalesce(_display_no,display_no),level=coalesce(_level,level),id_color=coalesce(_id_color,id_color) where id=_user;
  perform public.write_audit('user_identity_updated',jsonb_build_object(
    'old_display_no',v_old_no,'new_display_no',coalesce(_display_no,v_old_no),
    'old_level',v_old_level,'new_level',coalesce(_level,v_old_level),
    'old_id_color',v_old_color,'new_id_color',coalesce(_id_color,v_old_color)
  )::text,_user,'user');
end;
$$;
revoke all on function public.admin_update_user_identity(uuid,bigint,integer,text) from public,anon;
grant execute on function public.admin_update_user_identity(uuid,bigint,integer,text) to authenticated;
