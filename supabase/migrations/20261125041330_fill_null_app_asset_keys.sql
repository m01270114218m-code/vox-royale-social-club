begin;

create or replace function public.fill_app_asset_key()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if new.asset_key is null or btrim(new.asset_key) = '' then
    new.asset_key := 'upload/' || gen_random_uuid()::text;
  end if;
  return new;
end;
$function$;

drop trigger if exists app_assets_fill_asset_key on public.app_assets;
create trigger app_assets_fill_asset_key
before insert or update of asset_key on public.app_assets
for each row execute function public.fill_app_asset_key();

commit;