-- Allow everyone to render a private direct-grant frame only while its recipient has it equipped.
-- The frame remains private in the catalog and cannot be browsed or downloaded before equip.
drop policy if exists "Authenticated users read active or granted admin assets" on storage.objects;
create policy "Authenticated users read active or granted or equipped admin assets"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'admin-assets'
  and exists (
    select 1
    from public.admin_assets a
    where a.is_active = true
      and coalesce(a.metadata->>'storage_path', a.url) = storage.objects.name
      and (
        not a.is_private_direct
        or exists (
          select 1
          from public.user_asset_grants g
          where g.asset_key = a.asset_key
            and g.receiver_id = (select auth.uid())
        )
        or exists (
          select 1
          from public.profiles p
          where p.equipped_frame = a.asset_key
        )
      )
  )
);
