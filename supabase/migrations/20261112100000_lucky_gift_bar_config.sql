create table if not exists public.lucky_gift_bar_config (
  id boolean primary key default true check (id),
  enabled boolean not null default true,
  position text not null default 'top' check (position in ('top','center','bottom')),
  duration_ms integer not null default 5200 check (duration_ms between 1500 and 15000),
  width_px integer not null default 390 check (width_px between 220 and 700),
  gift_size_px integer not null default 56 check (gift_size_px between 32 and 140),
  show_name boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.lucky_gift_bar_config (id) values (true) on conflict (id) do nothing;

alter table public.lucky_gift_bar_config enable row level security;
drop policy if exists lucky_gift_bar_read on public.lucky_gift_bar_config;
create policy lucky_gift_bar_read on public.lucky_gift_bar_config for select to authenticated using (true);
drop policy if exists lucky_gift_bar_admin_write on public.lucky_gift_bar_config;
create policy lucky_gift_bar_admin_write on public.lucky_gift_bar_config for all to authenticated
using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
grant select, insert, update on public.lucky_gift_bar_config to authenticated;

do $$
begin
  begin
    alter publication supabase_realtime add table public.lucky_gift_bar_config;
  exception when duplicate_object then
    null;
  end;
end $$;