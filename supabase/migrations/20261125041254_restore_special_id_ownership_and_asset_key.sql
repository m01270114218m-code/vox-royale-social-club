begin;

alter table public.app_assets
  alter column asset_key set default ('upload/' || gen_random_uuid()::text);

do $fix$
declare
  v text;
  old text;
  replacement text;
begin
  v := pg_get_functiondef('public.app_action(text,jsonb)'::regprocedure);

  old := $old$if exists(select 1 from public.profiles where id=actor and banned) then raise exception 'الحساب محظور'; end if;
admin:=public.is_app_admin();$old$;
  replacement := $new$if exists(select 1 from public.profiles where id=actor and banned) then raise exception 'الحساب محظور'; end if;
if exists(select 1 from public.user_items where user_id=actor and expires_at is not null and expires_at<=now()) then
 update public.app_catalog c set in_store=true,updated_at=now()
 where c.kind='sid'
   and exists(select 1 from public.user_items ui where ui.user_id=actor and ui.catalog_id=c.id and ui.expires_at<=now())
   and not exists(select 1 from public.user_items ui where ui.catalog_id=c.id and ui.user_id<>actor and (ui.expires_at is null or ui.expires_at>now()));
 update public.rooms r set room_uid=p.uid,updated_at=now()
 from public.profiles p where p.id=actor and r.owner_id=actor
   and exists(select 1 from public.user_items ui join public.app_catalog c on c.id=ui.catalog_id
              where ui.user_id=actor and c.kind='sid' and ui.expires_at<=now() and c.name=p.special_id);
 update public.profiles p set special_id=null,updated_at=now()
 where p.id=actor
   and exists(select 1 from public.user_items ui join public.app_catalog c on c.id=ui.catalog_id
              where ui.user_id=actor and c.kind='sid' and ui.expires_at<=now() and c.name=p.special_id);
 delete from public.user_items where user_id=actor and expires_at is not null and expires_at<=now();
end if;
admin:=public.is_app_admin();$new$;
  if position(old in v)=0 then raise exception 'Could not locate app_action expiry insertion point'; end if;
  v := replace(v,old,replacement);

  old := $old$select actor,p.uid,coalesce(nullif(payload->>'name',''),'غرفة جديدة'),coalesce(nullif(payload->>'name',''),'غرفة جديدة'),left(coalesce(payload->>'notice',''),200),left(coalesce(payload->>'notice',''),200),nullif(payload->>'cover',''),nullif(payload->>'cover',''),'active','public' from public.profiles p where p.id=actor on conflict(owner_id) do update set name=excluded.name,title=excluded.title,notice=excluded.notice,description=excluded.description,cover=case when payload ? 'cover' then excluded.cover else public.rooms.cover end,cover_url=case when payload ? 'cover' then excluded.cover_url else public.rooms.cover_url end,updated_at=now();$old$;
  replacement := $new$select actor,case when p.special_id ~ '^[0-9]+$' then p.special_id::bigint else p.uid end,coalesce(nullif(payload->>'name',''),'غرفة جديدة'),coalesce(nullif(payload->>'name',''),'غرفة جديدة'),left(coalesce(payload->>'notice',''),200),left(coalesce(payload->>'notice',''),200),nullif(payload->>'cover',''),nullif(payload->>'cover',''),'active','public' from public.profiles p where p.id=actor on conflict(owner_id) do update set room_uid=excluded.room_uid,name=excluded.name,title=excluded.title,notice=excluded.notice,description=excluded.description,cover=case when payload ? 'cover' then excluded.cover else public.rooms.cover end,cover_url=case when payload ? 'cover' then excluded.cover_url else public.rooms.cover_url end,updated_at=now();$new$;
  if position(old in v)=0 then raise exception 'Could not locate room_save block'; end if;
  v := replace(v,old,replacement);

  old := $old$elsif action='buy' or action='equip' then
 select * into item from public.app_catalog where id=(payload->>'id')::uuid and enabled; if item.id is null then raise exception 'العنصر غير متاح'; end if;
 if action='buy' then update public.profiles set coins=coins-item.price where id=actor and coins>=item.price; if not found then raise exception 'رصيد غير كاف'; end if; insert into public.user_items(user_id,catalog_id,expires_at) values(actor,item.id,case when item.duration_days>0 then now()+make_interval(days=>item.duration_days) end) on conflict(user_id,catalog_id) do update set expires_at=excluded.expires_at; end if;
 update public.user_items set equipped=false where user_id=actor and catalog_id in(select id from public.app_catalog where kind=item.kind);
 update public.user_items set equipped=true where user_id=actor and catalog_id=item.id;
 if item.kind='vip' then update public.profiles set vip=item.rank,vip_until=(select expires_at from public.user_items where user_id=actor and catalog_id=item.id) where id=actor; elsif item.kind='sid' then update public.profiles set special_id=item.name where id=actor; end if;
$old$;
  replacement := $new$elsif action='buy' or action='equip' then
 select * into item from public.app_catalog where id=(payload->>'id')::uuid and enabled for update;
 if item.id is null then raise exception 'العنصر غير متاح'; end if;
 if action='buy' then
   if item.kind='sid' then
     if not item.in_store then raise exception 'هذا الرقم المميز مملوك بالفعل'; end if;
     if exists(select 1 from public.user_items ui join public.app_catalog c on c.id=ui.catalog_id
               where ui.user_id=actor and c.kind='sid' and ui.catalog_id<>item.id
                 and (ui.expires_at is null or ui.expires_at>now())) then raise exception 'لديك رقم مميز نشط بالفعل'; end if;
     if exists(select 1 from public.user_items ui where ui.catalog_id=item.id and ui.user_id<>actor
               and (ui.expires_at is null or ui.expires_at>now())) then raise exception 'هذا الرقم المميز مملوك بالفعل'; end if;
   end if;
   if exists(select 1 from public.user_items ui where ui.user_id=actor and ui.catalog_id=item.id
             and (ui.expires_at is null or ui.expires_at>now())) then raise exception 'العنصر مملوك بالفعل'; end if;
   update public.profiles set coins=coins-item.price where id=actor and coins>=item.price;
   if not found then raise exception 'رصيد غير كاف'; end if;
   insert into public.user_items(user_id,catalog_id,expires_at)
   values(actor,item.id,case when item.duration_days>0 then now()+make_interval(days=>item.duration_days) end)
   on conflict(user_id,catalog_id) do update set expires_at=excluded.expires_at,equipped=false;
   if item.kind='sid' then update public.app_catalog set in_store=false,updated_at=now() where id=item.id; end if;
 end if;
 if not exists(select 1 from public.user_items ui where ui.user_id=actor and ui.catalog_id=item.id
               and (ui.expires_at is null or ui.expires_at>now())) then raise exception 'العنصر غير مملوك'; end if;
 update public.user_items set equipped=false where user_id=actor and catalog_id in(select id from public.app_catalog where kind=item.kind);
 update public.user_items set equipped=true where user_id=actor and catalog_id=item.id;
 if item.kind='vip' then
   update public.profiles set vip=item.rank,vip_until=(select expires_at from public.user_items where user_id=actor and catalog_id=item.id) where id=actor;
 elsif item.kind='sid' then
   update public.profiles set special_id=item.name,updated_at=now() where id=actor;
   if item.name ~ '^[0-9]+$' then update public.rooms set room_uid=item.name::bigint,updated_at=now() where owner_id=actor; end if;
 end if;
$new$;
  if position(old in v)=0 then raise exception 'Could not locate buy/equip block'; end if;
  v := replace(v,old,replacement);

  old := $old$elsif admin and action='grant' then target=(select id from public.profiles where uid::text=payload->>'uid' or public_id::text=payload->>'uid' or special_id=payload->>'uid' limit 1); if target is null then raise exception 'المستخدم غير موجود: راجع ID'; end if; select * into item from public.app_catalog where id=(payload->>'id')::uuid and enabled; if item.id is null then raise exception 'العنصر غير موجود أو غير مفعل'; end if; days=coalesce((payload->>'days')::integer,item.duration_days,0); if days<0 then raise exception 'مدة العنصر غير صحيحة'; end if; insert into public.user_items(user_id,catalog_id,expires_at,equipped) values(target,item.id,case when days>0 then now()+make_interval(days=>days) else null end,true) on conflict(user_id,catalog_id) do update set expires_at=excluded.expires_at,equipped=true;$old$;
  replacement := $new$elsif admin and action='grant' then target=(select id from public.profiles where uid::text=payload->>'uid' or public_id::text=payload->>'uid' or special_id=payload->>'uid' limit 1); if target is null then raise exception 'المستخدم غير موجود: راجع ID'; end if; select * into item from public.app_catalog where id=(payload->>'id')::uuid and enabled for update; if item.id is null then raise exception 'العنصر غير موجود أو غير مفعل'; end if; days=coalesce((payload->>'days')::integer,item.duration_days,0); if days<0 then raise exception 'مدة العنصر غير صحيحة'; end if; if item.kind='sid' and exists(select 1 from public.user_items ui where ui.catalog_id=item.id and ui.user_id<>target and (ui.expires_at is null or ui.expires_at>now())) then raise exception 'هذا الرقم المميز مملوك بالفعل'; end if; if item.kind='sid' and exists(select 1 from public.user_items ui join public.app_catalog c on c.id=ui.catalog_id where ui.user_id=target and c.kind='sid' and ui.catalog_id<>item.id and (ui.expires_at is null or ui.expires_at>now())) then raise exception 'المستخدم لديه رقم مميز نشط بالفعل'; end if; insert into public.user_items(user_id,catalog_id,expires_at,equipped) values(target,item.id,case when days>0 then now()+make_interval(days=>days) else null end,true) on conflict(user_id,catalog_id) do update set expires_at=excluded.expires_at,equipped=true; if item.kind='sid' then update public.app_catalog set in_store=false,updated_at=now() where id=item.id; update public.profiles set special_id=item.name,updated_at=now() where id=target; if item.name ~ '^[0-9]+$' then update public.rooms set room_uid=item.name::bigint,updated_at=now() where owner_id=target; end if; end if;$new$;
  if position(old in v)=0 then raise exception 'Could not locate admin grant block'; end if;
  v := replace(v,old,replacement);

  execute v;
end
$fix$;

update public.app_catalog c
set in_store = not exists (select 1 from public.user_items ui where ui.catalog_id=c.id and (ui.expires_at is null or ui.expires_at>now())),
    updated_at=now()
where c.kind='sid';

update public.rooms r
set room_uid=p.special_id::bigint,updated_at=now()
from public.profiles p
where r.owner_id=p.id and p.special_id ~ '^[0-9]+$';

commit;