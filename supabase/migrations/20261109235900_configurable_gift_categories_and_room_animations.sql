-- Configurable gift shelves and per-gift room presentation.
create table if not exists public.gift_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  display_mode text not null default 'static' check (display_mode in ('static','animated')),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.gifts
  add column if not exists category_id uuid references public.gift_categories(id) on delete set null,
  add column if not exists animation_style text not null default 'zoom',
  add column if not exists animation_speed numeric not null default 1,
  add column if not exists display_duration_ms integer not null default 2600;

alter table public.gifts drop constraint if exists gifts_animation_speed_check;
alter table public.gifts add constraint gifts_animation_speed_check check (animation_speed between 0.25 and 3);
alter table public.gifts drop constraint if exists gifts_display_duration_ms_check;
alter table public.gifts add constraint gifts_display_duration_ms_check check (display_duration_ms between 500 and 20000);
alter table public.gifts drop constraint if exists gifts_animation_style_check;
alter table public.gifts add constraint gifts_animation_style_check check (animation_style in ('zoom','slide','float','pulse'));

alter table public.gift_categories enable row level security;
drop policy if exists gift_categories_active_read on public.gift_categories;
create policy gift_categories_active_read on public.gift_categories
  for select to authenticated
  using (is_active or public.is_admin(auth.uid()));
drop policy if exists gift_categories_admin_manage on public.gift_categories;
create policy gift_categories_admin_manage on public.gift_categories
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

grant select on public.gift_categories to authenticated;
grant insert, update, delete on public.gift_categories to authenticated;
