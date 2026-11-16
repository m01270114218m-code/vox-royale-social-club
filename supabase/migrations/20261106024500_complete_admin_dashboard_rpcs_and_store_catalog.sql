-- Complete missing admin RPCs and the store catalog used by the dashboard.
create table if not exists public.store_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('frame','entry','name_effect','theme')),
  name text not null,
  description text,
  price bigint not null default 0 check (price >= 0),
  asset_key text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.store_items enable row level security;
drop policy if exists "Authenticated users read store items" on public.store_items;
create policy "Authenticated users read store items" on public.store_items for select to authenticated using (true);
drop policy if exists "Admins manage store items" on public.store_items;
create policy "Admins manage store items" on public.store_items for all to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));

create or replace function public.admin_save_store_item(
  _id uuid, _kind text, _name text, _description text, _price bigint, _asset_key text, _sort_order integer
) returns uuid language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_id uuid;
begin
  if not private.is_admin() then raise exception 'admin_required'; end if;
  if coalesce(trim(_name),'') = '' or coalesce(trim(_asset_key),'') = '' then raise exception 'name_and_asset_required'; end if;
  if _price < 0 then raise exception 'invalid_price'; end if;
  if _kind not in ('frame','entry','name_effect','theme') then raise exception 'invalid_kind'; end if;
  if _id is null then
    insert into public.store_items(kind,name,description,price,asset_key,sort_order)
    values(_kind,trim(_name),nullif(trim(_description),''),_price,trim(_asset_key),coalesce(_sort_order,0))
    returning id into v_id;
  else
    update public.store_items set kind=_kind,name=trim(_name),description=nullif(trim(_description),''),price=_price,
      asset_key=trim(_asset_key),sort_order=coalesce(_sort_order,0),updated_at=now()
    where id=_id returning id into v_id;
    if v_id is null then raise exception 'store_item_not_found'; end if;
  end if;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,details)
  values(auth.uid(),case when _id is null then 'store_item_created' else 'store_item_updated' end,'store_item',v_id::text,
    jsonb_build_object('name',trim(_name),'kind',_kind));
  return v_id;
end $$;

create or replace function public.admin_delete_store_item(_id uuid) returns boolean
language plpgsql security definer set search_path=public,private,pg_temp as $$
begin
  if not private.is_admin() then raise exception 'admin_required'; end if;
  delete from public.store_items where id=_id;
  if not found then return false; end if;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,details)
  values(auth.uid(),'store_item_deleted','store_item',_id::text,'{}'::jsonb);
  return true;
end $$;

create or replace function public.admin_list_wallet_tx(_limit integer default 200)
returns table(user_id uuid,display_name text,amount bigint,kind text,note text,created_at timestamptz)
language sql security definer set search_path=public,private,pg_temp as $$
  select wt.user_id,p.display_name,wt.amount,wt.kind::text,wt.title,wt.created_at
  from public.wallet_transactions wt left join public.profiles p on p.id=wt.user_id
  where private.is_admin()
  order by wt.created_at desc limit greatest(1,least(coalesce(_limit,200),500));
$$;

create or replace function public.admin_list_gift_tx(_limit integer default 200)
returns table(sender_name text,receiver_name text,gift_name text,cost bigint,created_at timestamptz)
language sql security definer set search_path=public,private,pg_temp as $$
  select sender.display_name,receiver.display_name,wt.title,abs(wt.amount),wt.created_at
  from public.wallet_transactions wt
  left join public.profiles sender on sender.id=wt.user_id
  left join public.profiles receiver on receiver.id=wt.related_user_id
  where private.is_admin() and wt.kind='gift_sent'::public.transaction_kind
  order by wt.created_at desc limit greatest(1,least(coalesce(_limit,200),500));
$$;

create or replace function public.admin_list_audit(_limit integer default 200)
returns table(id bigint,admin_name text,action text,target_type text,target_id text,details text,created_at timestamptz)
language sql security definer set search_path=public,private,pg_temp as $$
  select a.id,p.display_name,a.action,coalesce(a.entity_type,''),coalesce(a.entity_id,''),a.details::text,a.created_at
  from public.admin_audit_log a left join public.profiles p on p.id=a.actor_id
  where private.is_admin()
  order by a.created_at desc limit greatest(1,least(coalesce(_limit,200),500));
$$;

revoke all on function public.admin_save_store_item(uuid,text,text,text,bigint,text,integer) from public,anon;
revoke all on function public.admin_delete_store_item(uuid) from public,anon;
revoke all on function public.admin_list_wallet_tx(integer) from public,anon;
revoke all on function public.admin_list_gift_tx(integer) from public,anon;
revoke all on function public.admin_list_audit(integer) from public,anon;
grant execute on function public.admin_save_store_item(uuid,text,text,text,bigint,text,integer) to authenticated;
grant execute on function public.admin_delete_store_item(uuid) to authenticated;
grant execute on function public.admin_list_wallet_tx(integer) to authenticated;
grant execute on function public.admin_list_gift_tx(integer) to authenticated;
grant execute on function public.admin_list_audit(integer) to authenticated;
