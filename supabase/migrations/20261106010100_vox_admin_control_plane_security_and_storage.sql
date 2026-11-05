create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path=public,private
as $$ select exists (select 1 from public.admin_roles where user_id=(select auth.uid()) and role in ('super_admin','admin','moderator')); $$;

create or replace function private.is_super_admin()
returns boolean language sql stable security definer set search_path=public,private
as $$ select exists (select 1 from public.admin_roles where user_id=(select auth.uid()) and role='super_admin'); $$;

create or replace function private.claim_first_admin()
returns boolean language plpgsql security definer set search_path=''
as $$
begin
  if (select auth.uid()) is null then return false; end if;
  if coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false) then return false; end if;
  perform pg_advisory_xact_lock(824771);
  if exists(select 1 from public.admin_roles) then return false; end if;
  insert into public.admin_roles(user_id,role) values ((select auth.uid()),'super_admin');
  return true;
end;
$$;

drop policy if exists "Admins manage admin roles" on public.admin_roles;
create policy "Super admins manage admin roles" on public.admin_roles for all to authenticated
  using ((select private.is_super_admin())) with check ((select private.is_super_admin()));

create index if not exists room_messages_user_id_idx on public.room_messages(user_id);
create index if not exists user_bans_created_by_idx on public.user_bans(created_by);
create index if not exists user_follows_followed_id_idx on public.user_follows(followed_id);
create index if not exists user_notifications_user_id_idx on public.user_notifications(user_id);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('admin-assets','admin-assets',false,52428800,
  array['image/png','image/jpeg','image/webp','image/gif','image/svg+xml','model/gltf-binary','model/gltf+json','application/octet-stream'])
on conflict(id) do nothing;

drop policy if exists "Admin assets read" on storage.objects;
create policy "Admin assets read" on storage.objects for select to authenticated
using (bucket_id='admin-assets' and (select private.is_admin()));
drop policy if exists "Admin assets upload" on storage.objects;
create policy "Admin assets upload" on storage.objects for insert to authenticated
with check (bucket_id='admin-assets' and (select private.is_admin()));
drop policy if exists "Admin assets update" on storage.objects;
create policy "Admin assets update" on storage.objects for update to authenticated
using (bucket_id='admin-assets' and (select private.is_admin()))
with check (bucket_id='admin-assets' and (select private.is_admin()));
drop policy if exists "Admin assets delete" on storage.objects;
create policy "Admin assets delete" on storage.objects for delete to authenticated
using (bucket_id='admin-assets' and (select private.is_admin()));
