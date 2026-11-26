-- Mirrors the production migration 20261126004425.
-- Only RLS-protected public tables are added to Realtime.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','app_catalog','app_assets','user_items','user_roles','app_settings',
    'rooms','room_controls','agencies','agency_hosts','agency_members',
    'app_notifications','coin_ledger','recharge_requests','user_vips','vip_packages',
    'gift_transactions','room_members','room_seats','chat_messages','room_gift_events'
  ] loop
    if exists (
      select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=t and c.relkind='r' and c.relrowsecurity
    ) and not exists (
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename=t
    ) then
      execute format('alter publication supabase_realtime add table public.%I',t);
    end if;
  end loop;
end $$;
