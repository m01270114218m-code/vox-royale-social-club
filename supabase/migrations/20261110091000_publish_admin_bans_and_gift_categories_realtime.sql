do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='user_bans') then
    alter publication supabase_realtime add table public.user_bans;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='device_bans') then
    alter publication supabase_realtime add table public.device_bans;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='device_accounts') then
    alter publication supabase_realtime add table public.device_accounts;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='gift_categories') then
    alter publication supabase_realtime add table public.gift_categories;
  end if;
end $$;
