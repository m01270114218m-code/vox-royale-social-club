drop policy if exists "public branding settings read" on public.admin_settings;
create policy "public branding settings read"
on public.admin_settings for select to anon,authenticated
using (key in ('app_branding','home_banner'));

drop policy if exists "Public branding asset records read" on public.admin_assets;
create policy "Public branding asset records read"
on public.admin_assets for select to anon
using (is_active = true and metadata->>'kind' in ('logo','intro-banner'));

drop policy if exists "Public branding files read" on storage.objects;
create policy "Public branding files read"
on storage.objects for select to anon
using (
  bucket_id='admin-assets'
  and exists (
    select 1 from public.admin_assets a
    where a.is_active=true
      and a.metadata->>'kind' in ('logo','intro-banner')
      and coalesce(a.metadata->>'storage_path',a.url)=storage.objects.name
  )
);
