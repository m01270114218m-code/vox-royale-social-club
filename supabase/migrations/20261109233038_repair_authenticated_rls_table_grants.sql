-- Restore Data API table privileges for authenticated clients while preserving
-- row-level security as the authorization boundary. Tables without a matching
-- RLS policy remain inaccessible even though the SQL privilege is present.
do $$
declare
  t record;
begin
  for t in
    select c.oid::regclass as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relrowsecurity
  loop
    execute format('grant select, insert, update, delete on table %s to authenticated', t.table_name);
  end loop;
end
$$;

grant usage, select on all sequences in schema public to authenticated;
