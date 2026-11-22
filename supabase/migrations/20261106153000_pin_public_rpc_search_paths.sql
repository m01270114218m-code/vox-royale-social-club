-- Pin the execution search_path for application RPCs that relied on the session default.
-- PUBLIC and private schemas are not CREATE-granted to anon/authenticated roles.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.proconfig is null or not exists (
        select 1 from unnest(p.proconfig) setting where setting like 'search_path=%'
      ))
  loop
    execute pg_catalog.format(
      'alter function %s set search_path to pg_catalog, public, private, auth, extensions, pg_temp',
      fn.signature
    );
  end loop;
end;
$$;
