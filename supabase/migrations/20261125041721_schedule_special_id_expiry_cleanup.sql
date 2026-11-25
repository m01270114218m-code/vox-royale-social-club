begin;

create extension if not exists pg_cron;

create or replace function public.release_expired_special_ids()
returns integer
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  item record;
  released_count integer := 0;
begin
  for item in
    select ui.user_id,ui.catalog_id,c.name,p.uid
    from public.user_items ui
    join public.app_catalog c on c.id=ui.catalog_id
    join public.profiles p on p.id=ui.user_id
    where c.kind='sid'
      and ui.expires_at is not null
      and ui.expires_at<=now()
    for update of ui skip locked
  loop
    update public.app_catalog c
    set in_store=not exists (
      select 1 from public.user_items active
      where active.catalog_id=item.catalog_id
        and (active.expires_at is null or active.expires_at>now())
    ),updated_at=now()
    where c.id=item.catalog_id;

    update public.profiles
    set special_id=null,updated_at=now()
    where id=item.user_id and special_id=item.name;

    if found then
      update public.rooms
      set room_uid=item.uid,updated_at=now()
      where owner_id=item.user_id;
      released_count:=released_count+1;
    end if;
  end loop;

  delete from public.user_items
  where expires_at is not null and expires_at<=now();

  return released_count;
end;
$function$;

revoke all on function public.release_expired_special_ids() from public,anon,authenticated,service_role;

do $schedule$
declare existing_job record;
begin
  for existing_job in select jobid from cron.job where jobname='release-expired-special-ids'
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;
end;
$schedule$;

select cron.schedule('release-expired-special-ids','* * * * *','select public.release_expired_special_ids();');

commit;