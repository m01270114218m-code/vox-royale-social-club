-- Seed the real, bundled project assets and catalog into Supabase.
-- Binary files are uploaded to the private app-assets bucket by the project asset import.
-- This migration is idempotent and intentionally does not seed demo users or demo rooms.

begin;

-- Authenticated app users need SELECT on Storage objects so createSignedUrls() works.
drop policy if exists storage_assets_authenticated_read on storage.objects;
create policy storage_assets_authenticated_read
on storage.objects for select to authenticated
using (bucket_id = 'app-assets');

-- Register all binary files already uploaded from src/assets in the repository.
with files as (
  select
    name as storage_path,
    regexp_replace(name, '^project-assets/', '') as source_path,
    split_part(name, '/', array_length(string_to_array(name, '/'), 1)) as file_name
  from storage.objects
  where bucket_id = 'app-assets'
    and name like 'project-assets/src/assets/%'
    and name <> 'project-assets/src/assets/icons/idcard.webp'
),
mapped as (
  select
    storage_path,
    source_path,
    split_part(file_name, '.', 1) as stem,
    case
      when source_path like 'src/assets/frames/%' then 'frame/' || split_part(file_name, '.', 1)
      when source_path like 'src/assets/entries/%' then 'entry/' || split_part(file_name, '.', 1)
      when source_path like 'src/assets/gifts/%' then 'gift/' || split_part(file_name, '.', 1)
      when source_path = 'src/assets/store/bubble-gold.webp' then 'bubble/gold'
      when source_path = 'src/assets/store/bubble-ice.webp' then 'bubble/ice'
      when source_path = 'src/assets/store/throne.webp' then 'seat/throne'
      when source_path = 'src/assets/store/trophy.webp' then 'seat/trophy'
      when source_path = 'src/assets/store/car.webp' then 'entry/car'
      when source_path = 'src/assets/store/pegasus.webp' then 'entry/pegasus'
      else 'project/' || regexp_replace(source_path, '^src/assets/', '')
    end as asset_key,
    case
      when source_path like 'src/assets/frames/%' then 'frame'
      when source_path like 'src/assets/entries/%'
        or source_path in ('src/assets/store/car.webp', 'src/assets/store/pegasus.webp') then 'entrance'
      when source_path like 'src/assets/gifts/%' then 'gift'
      when source_path like 'src/assets/avatars/%' then 'avatar'
      when source_path like 'src/assets/covers/%'
        or source_path in ('src/assets/ice-bg.jpg', 'src/assets/room-bg.jpg') then 'room_background'
      when source_path like 'src/assets/roles/%' or source_path like 'src/assets/icons/%' then 'icon'
      when source_path like 'src/assets/store/%' or source_path like 'src/assets/ui/%' then 'page_element'
      else 'other'
    end as category,
    case
      when source_path like 'src/assets/frames/%' then 'frame'
      when source_path like 'src/assets/entries/%' then 'entry'
      when source_path like 'src/assets/gifts/%' then 'gift'
      when source_path like 'src/assets/roles/%' then 'badge'
      when source_path like 'src/assets/store/bubble-%' then 'bubble'
      when source_path in ('src/assets/store/throne.webp', 'src/assets/store/trophy.webp') then 'seat'
      when source_path in ('src/assets/store/car.webp', 'src/assets/store/pegasus.webp') then 'entry'
      else 'general'
    end as section,
    case lower(split_part(file_name, '.', array_length(string_to_array(file_name, '.'), 1)))
      when 'webp' then 'image/webp'
      when 'png' then 'image/png'
      when 'jpg' then 'image/jpeg'
      when 'jpeg' then 'image/jpeg'
      when 'gif' then 'image/gif'
      when 'svg' then 'image/svg+xml'
      when 'mp4' then 'video/mp4'
      when 'webm' then 'video/webm'
      when 'mp3' then 'audio/mpeg'
      when 'wav' then 'audio/wav'
      else 'application/octet-stream'
    end as mime
  from files
)
insert into public.app_assets (
  asset_key, title, category, storage_path, mime_type, is_active,
  sort_order, metadata, section, name, path, mime
)
select
  asset_key,
  replace(stem, '_', ' '),
  category,
  storage_path,
  mime,
  true,
  row_number() over (order by source_path)::integer,
  jsonb_build_object(
    'source', 'github',
    'repo', 'm01270114218m-code/vox-royale-social-club',
    'ref', 'dffb83fad2f1c16a9a2c8df85cfa0d59067d55fb',
    'source_path', source_path
  ),
  section,
  replace(stem, '_', ' '),
  storage_path,
  mime
from mapped
on conflict (asset_key) do update set
  title = excluded.title,
  category = excluded.category,
  storage_path = excluded.storage_path,
  mime_type = excluded.mime_type,
  is_active = true,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  section = excluded.section,
  name = excluded.name,
  path = excluded.path,
  mime = excluded.mime;

-- The five special-ID catalog items share the same project ID-card artwork.
insert into public.app_assets (
  asset_key, title, category, storage_path, mime_type, is_active,
  sort_order, metadata, section, name, path, mime
)
select
  'sid/' || x.sid,
  'معرّف المستخدم',
  'icon',
  'project-assets/src/assets/icons/idcard.webp',
  'image/webp',
  true,
  x.position,
  jsonb_build_object(
    'source', 'github',
    'repo', 'm01270114218m-code/vox-royale-social-club',
    'ref', 'dffb83fad2f1c16a9a2c8df85cfa0d59067d55fb',
    'source_path', 'src/assets/icons/idcard.webp'
  ),
  'sid',
  'معرّف المستخدم',
  'project-assets/src/assets/icons/idcard.webp',
  'image/webp'
from (values ('8888',10),('777',20),('1000',30),('520',40),('66666',50)) as x(sid,position)
on conflict (asset_key) do update set
  title = excluded.title,
  category = excluded.category,
  storage_path = excluded.storage_path,
  mime_type = excluded.mime_type,
  is_active = true,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  section = excluded.section,
  name = excluded.name,
  path = excluded.path,
  mime = excluded.mime;

-- The catalogue mirrors the actual values in src/components/app/data.ts.
with items(kind, name, asset_key, price, duration_days, position, description) as (
  values
  ('frame','أجنحة الملك','frame/wings',30000,7,10,'إطار صورة أجنحة الملك'),
  ('frame','تاج الجليد','frame/ice',12000,7,20,'إطار صورة تاج الجليد'),
  ('frame','حديقة الورد','frame/roses',15000,7,30,'إطار صورة حديقة الورد'),
  ('frame','التنين البنفسجي','frame/dragon',45000,7,40,'إطار صورة التنين البنفسجي'),
  ('frame','عرش الياقوت','frame/obsidian',38000,7,50,'إطار صورة عرش الياقوت'),
  ('frame','حلقة النار','frame/fire',26000,7,60,'إطار صورة حلقة النار'),
  ('frame','جناح الملاك','frame/angel',22000,7,70,'إطار صورة جناح الملاك'),
  ('frame','تاج الزفير','frame/sapphire',40000,7,80,'إطار صورة تاج الزفير'),
  ('entry','الأسد الذهبي','entry/lion',60000,7,10,'دخولية الأسد الذهبي'),
  ('entry','تنين اللهب','entry/dragon',80000,7,20,'دخولية تنين اللهب'),
  ('entry','الطائرة الخاصة','entry/jet',70000,7,30,'دخولية الطائرة الخاصة'),
  ('entry','العربة الملكية','entry/carriage',55000,7,40,'دخولية العربة الملكية'),
  ('entry','فيراري حمراء','entry/car',30000,7,50,'دخولية السيارة الحمراء'),
  ('entry','الحصان المجنح','entry/pegasus',45000,7,60,'دخولية الحصان المجنح'),
  ('bubble','فقاعة ذهبية','bubble/gold',8000,7,10,'فقاعة محادثة ذهبية'),
  ('bubble','فقاعة الجليد','bubble/ice',6000,7,20,'فقاعة محادثة جليدية'),
  ('seat','عرش الجليد','seat/throne',25000,7,10,'مقعد عرش الجليد'),
  ('seat','كأس الأبطال','seat/trophy',20000,7,20,'مقعد كأس الأبطال'),
  ('gift','وردة','gift/rose',1,0,10,'هدية وردة'),
  ('gift','شوكولا','gift/chocolate',10,0,20,'هدية شوكولا'),
  ('gift','ألماسة','gift/diamond',99,0,30,'هدية ألماسة'),
  ('gift','تاج','gift/crown',520,0,40,'هدية تاج'),
  ('gift','صقر','gift/falcon',999,0,50,'هدية صقر'),
  ('gift','خاتم','gift/ring',1314,0,60,'هدية خاتم'),
  ('gift','قصر جليد','gift/castle',5000,0,70,'هدية قصر جليد'),
  ('gift','صاروخ','gift/rocket',9999,0,80,'هدية صاروخ'),
  ('sid','8888','sid/8888',88000,30,10,'رقم مميز 8888'),
  ('sid','777','sid/777',77000,30,20,'رقم مميز 777'),
  ('sid','1000','sid/1000',100000,30,30,'رقم مميز 1000'),
  ('sid','520','sid/520',52000,30,40,'رقم مميز 520'),
  ('sid','66666','sid/66666',66000,30,50,'رقم مميز 66666')
)
insert into public.app_catalog (
  kind, name, asset_id, price, rank, description, link,
  enabled, home, position, duration_days, in_store, metadata
)
select
  i.kind, i.name, a.id, i.price, 0, i.description, '',
  true, false, i.position, i.duration_days, true,
  jsonb_build_object('source','project-data.ts','asset_key',i.asset_key)
from items i
join public.app_assets a on a.asset_key = i.asset_key
where not exists (
  select 1 from public.app_catalog c
  where c.kind = i.kind and c.name = i.name
);

insert into public.app_settings(setting_key, key, value, is_public)
values ('features','features','{"gifts":true,"store":true,"agency_requests":true}'::jsonb,true)
on conflict (setting_key) do update set
  key = excluded.key,
  value = excluded.value,
  is_public = excluded.is_public,
  updated_at = now();

commit;
