update public.profiles p
set name = coalesce(
      nullif(btrim(p.name),''),
      nullif(btrim(p.display_name),''),
      nullif(btrim(u.raw_user_meta_data->>'full_name'),''),
      nullif(btrim(u.raw_user_meta_data->>'name'),''),
      'مستخدم ' || p.uid::text
    ),
    display_name = coalesce(
      nullif(btrim(p.display_name),''),
      nullif(btrim(p.name),''),
      nullif(btrim(u.raw_user_meta_data->>'full_name'),''),
      nullif(btrim(u.raw_user_meta_data->>'name'),''),
      'مستخدم ' || p.uid::text
    ),
    username = coalesce(nullif(btrim(p.username),''), 'user_' || p.uid::text),
    updated_at = now()
from auth.users u
where u.id = p.id
  and (
    nullif(btrim(p.name),'') is null
    or nullif(btrim(p.display_name),'') is null
    or nullif(btrim(p.username),'') is null
  );
