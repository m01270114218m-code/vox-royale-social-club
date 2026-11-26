-- Agency owner controls, host membership management and aggregate leaderboard.
create unique index if not exists agencies_owner_id_unique on public.agencies(owner_id);

CREATE OR REPLACE FUNCTION public.request_host_agency()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_uid uuid:=auth.uid(); v_id uuid; v_status text;
begin
 if v_uid is null then raise exception 'سجّل الدخول أولاً'; end if;
 if exists(select 1 from public.user_roles where user_id=v_uid and role='host_agent') then raise exception 'الوكالة مفعّلة بالفعل'; end if;
 select id,status into v_id,v_status from public.agencies where owner_id=v_uid limit 1;
 if v_id is not null then
   if v_status='rejected' then update public.agencies set status='pending' where id=v_id; end if;
   return v_id;
 end if;
 insert into public.agencies(owner_id,created_by,name,slogan,image_path,status)
 values(v_uid,v_uid,'وكالتي','','','pending') returning id into v_id;
 return v_id;
end;
$function$

CREATE OR REPLACE FUNCTION public.app_action(action text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$


declare actor uuid:=auth.uid(); target uuid; item public.app_catalog; amount bigint; qty integer; admin boolean; r double precision; x integer:=0; win bigint:=0; i integer; days integer; until_at timestamptz; req public.recharge_requests; ag uuid;
begin
if actor is null then raise exception 'سجل الدخول'; end if;
if exists(select 1 from public.profiles where id=actor and banned) then raise exception 'الحساب محظور'; end if;
-- Expire owned items before processing the next action. An expired special ID
-- is returned to the store and the owner's room ID is restored to the account UID.
if exists(select 1 from public.user_items where user_id=actor and expires_at is not null and expires_at<=now()) then
 update public.app_catalog c
 set in_store=true,updated_at=now()
 where c.kind='sid'
   and exists(select 1 from public.user_items ui where ui.user_id=actor and ui.catalog_id=c.id and ui.expires_at<=now())
   and not exists(select 1 from public.user_items ui where ui.catalog_id=c.id and ui.user_id<>actor and (ui.expires_at is null or ui.expires_at>now()));
 update public.rooms r
 set room_uid=p.uid,updated_at=now()
 from public.profiles p
 where p.id=actor and r.owner_id=actor
   and exists(select 1 from public.user_items ui join public.app_catalog c on c.id=ui.catalog_id
              where ui.user_id=actor and c.kind='sid' and ui.expires_at<=now() and c.name=p.special_id);
 update public.profiles p
 set special_id=null,updated_at=now()
 where p.id=actor
   and exists(select 1 from public.user_items ui join public.app_catalog c on c.id=ui.catalog_id
              where ui.user_id=actor and c.kind='sid' and ui.expires_at<=now() and c.name=p.special_id);
 delete from public.user_items where user_id=actor and expires_at is not null and expires_at<=now();
end if;
admin:=public.is_app_admin();
if action='profile' then update public.profiles set name=coalesce(nullif(payload->>'name',''),name),display_name=coalesce(nullif(payload->>'name',''),display_name),bio=coalesce(payload->>'bio',bio),avatar_url=coalesce(payload->>'avatar',avatar_url),updated_at=now() where id=actor;
elsif action='activity' then update public.profiles set app_seconds=app_seconds+least(60,greatest(0,coalesce(extract(epoch from now()-last_app_at)::bigint,0))),last_app_at=now() where id=actor;
elsif action='room_save' then insert into public.rooms(owner_id,room_uid,name,title,notice,description,cover,cover_url,status,room_type) select actor,case when p.special_id ~ '^[0-9]+$' then p.special_id::bigint else p.uid end,coalesce(nullif(payload->>'name',''),'غرفة جديدة'),coalesce(nullif(payload->>'name',''),'غرفة جديدة'),left(coalesce(payload->>'notice',''),200),left(coalesce(payload->>'notice',''),200),nullif(payload->>'cover',''),nullif(payload->>'cover',''),'active','public' from public.profiles p where p.id=actor on conflict(owner_id) do update set room_uid=excluded.room_uid,name=excluded.name,title=excluded.title,notice=excluded.notice,description=excluded.description,cover=case when payload ? 'cover' then excluded.cover else public.rooms.cover end,cover_url=case when payload ? 'cover' then excluded.cover_url else public.rooms.cover_url end,updated_at=now();
elsif action='daily' then update public.profiles set coins=coins+15000,daily_day=case when daily_day>=7 then 1 else daily_day+1 end,daily_at=now() where id=actor and (daily_at is null or now()>=daily_at+interval '24 hours'); if not found then raise exception 'استلمت مكافأة اليوم، عد بعد 24 ساعة'; end if; insert into public.coin_ledger(sender_id,recipient_id,amount,kind) values(actor,actor,15000,'daily'); insert into public.app_notifications(user_id,title,body,kind,coins) values(actor,'مكافأة الدخول اليومي','تمت إضافة المكافأة اليومية','reward',15000);
elsif action='recharge_request' then amount=(payload->>'coins')::bigint; if amount is null or amount<=0 then raise exception 'عدد العملات غير صحيح'; end if; insert into public.recharge_requests(user_id,coins,price,note) values(actor,amount,left(coalesce(payload->>'price',''),40),left(coalesce(payload->>'note',''),300));
elsif action='gift' then
 select * into item from public.app_catalog where id=(payload->>'id')::uuid and enabled and kind='gift'; if item.id is null then raise exception 'الهدية غير متاحة'; end if;
 select id into target from public.profiles where uid::text=payload->>'uid' or public_id::text=payload->>'uid' or special_id=payload->>'uid'; if target is null or target=actor then raise exception 'اختر مستخدمًا حقيقيًا آخر'; end if;
 qty=coalesce((payload->>'qty')::integer,1); if qty<1 or qty>520 then raise exception 'كمية غير صحيحة'; end if; amount=item.price*qty;
 update public.profiles set coins=coins-amount where id=actor and coins>=amount; if not found then raise exception 'رصيد غير كاف'; end if;
 update public.profiles set gift_value=gift_value+amount,diamonds=diamonds+amount where id=target and not banned;
 insert into public.coin_ledger(sender_id,recipient_id,amount,kind) values(actor,target,amount,'gift');
elsif action='buy' or action='equip' then
 select * into item from public.app_catalog where id=(payload->>'id')::uuid and enabled for update;
 if item.id is null then raise exception 'العنصر غير متاح'; end if;
 if action='buy' then
   if item.kind='sid' then
     if not item.in_store then raise exception 'هذا الرقم المميز مملوك بالفعل'; end if;
     if exists(select 1 from public.user_items ui join public.app_catalog c on c.id=ui.catalog_id
               where ui.user_id=actor and c.kind='sid' and ui.catalog_id<>item.id
                 and (ui.expires_at is null or ui.expires_at>now())) then
       raise exception 'لديك رقم مميز نشط بالفعل';
     end if;
     if exists(select 1 from public.user_items ui
               where ui.catalog_id=item.id and ui.user_id<>actor
                 and (ui.expires_at is null or ui.expires_at>now())) then
       raise exception 'هذا الرقم المميز مملوك بالفعل';
     end if;
   end if;
   if exists(select 1 from public.user_items ui where ui.user_id=actor and ui.catalog_id=item.id
             and (ui.expires_at is null or ui.expires_at>now())) then
     raise exception 'العنصر مملوك بالفعل';
   end if;
   update public.profiles set coins=coins-item.price where id=actor and coins>=item.price;
   if not found then raise exception 'رصيد غير كاف'; end if;
   insert into public.user_items(user_id,catalog_id,expires_at)
   values(actor,item.id,case when item.duration_days>0 then now()+make_interval(days=>item.duration_days) end)
   on conflict(user_id,catalog_id) do update
   set expires_at=excluded.expires_at,equipped=false;
   if item.kind='sid' then
     update public.app_catalog set in_store=false,updated_at=now() where id=item.id;
   end if;
 end if;
 if not exists(select 1 from public.user_items ui where ui.user_id=actor and ui.catalog_id=item.id
               and (ui.expires_at is null or ui.expires_at>now())) then
   raise exception 'العنصر غير مملوك';
 end if;
 update public.user_items set equipped=false
 where user_id=actor and catalog_id in(select id from public.app_catalog where kind=item.kind);
 update public.user_items set equipped=true where user_id=actor and catalog_id=item.id;
 if item.kind='vip' then
   update public.profiles set vip=item.rank,
     vip_until=(select expires_at from public.user_items where user_id=actor and catalog_id=item.id)
   where id=actor;
 elsif item.kind='sid' then
   update public.profiles set special_id=item.name,updated_at=now() where id=actor;
   if item.name ~ '^[0-9]+$' then
     update public.rooms set room_uid=item.name::bigint,updated_at=now() where owner_id=actor;
   end if;
 end if;
elsif action='transfer' then if not public.has_role(actor,'recharge_agent') then raise exception 'وكيل الشحن غير مفعل'; end if; target=(select id from public.profiles where uid::text=payload->>'uid' or public_id::text=payload->>'uid' or special_id=payload->>'uid'); amount=(payload->>'amount')::bigint; update public.profiles set coins=coins-amount where id=actor and coins>=amount; if not found then raise exception 'رصيد غير كاف'; end if; update public.profiles set coins=coins+amount where id=target; insert into public.coin_ledger(sender_id,recipient_id,amount,kind) values(actor,target,amount,'transfer');
elsif admin and action='ban' then target=(select id from public.profiles where uid::text=payload->>'uid' or public_id::text=payload->>'uid' or special_id=payload->>'uid'); update public.profiles set banned=coalesce((payload->>'enabled')::boolean,false),account_status=case when coalesce((payload->>'enabled')::boolean,false) then 'banned' else 'active' end where id=target;
elsif admin and action='credit' then target=(select id from public.profiles where uid::text=payload->>'uid' or public_id::text=payload->>'uid' or special_id=payload->>'uid'); amount=(payload->>'amount')::bigint; update public.profiles set coins=coins+amount where id=target; insert into public.coin_ledger(sender_id,recipient_id,amount,kind) values(actor,target,amount,'credit');
elsif admin and action='role' then target=(select id from public.profiles where uid::text=payload->>'uid' or public_id::text=payload->>'uid' or special_id=payload->>'uid'); if (payload->>'enabled')::boolean then insert into public.user_roles(user_id,role) values(target,payload->>'role') on conflict do nothing; else delete from public.user_roles where user_id=target and role=payload->>'role'; end if;
elsif admin and action='grant' then target=(select id from public.profiles where uid::text=payload->>'uid' or public_id::text=payload->>'uid' or special_id=payload->>'uid' limit 1); if target is null then raise exception 'المستخدم غير موجود: راجع ID'; end if; select * into item from public.app_catalog where id=(payload->>'id')::uuid and enabled for update; if item.id is null then raise exception 'العنصر غير موجود أو غير مفعل'; end if; days=coalesce((payload->>'days')::integer,item.duration_days,0); if days<0 then raise exception 'مدة العنصر غير صحيحة'; end if; if item.kind='sid' and exists(select 1 from public.user_items ui where ui.catalog_id=item.id and ui.user_id<>target and (ui.expires_at is null or ui.expires_at>now())) then raise exception 'هذا الرقم المميز مملوك بالفعل'; end if; if item.kind='sid' and exists(select 1 from public.user_items ui join public.app_catalog c on c.id=ui.catalog_id where ui.user_id=target and c.kind='sid' and ui.catalog_id<>item.id and (ui.expires_at is null or ui.expires_at>now())) then raise exception 'المستخدم لديه رقم مميز نشط بالفعل'; end if; insert into public.user_items(user_id,catalog_id,expires_at,equipped) values(target,item.id,case when days>0 then now()+make_interval(days=>days) else null end,true) on conflict(user_id,catalog_id) do update set expires_at=excluded.expires_at,equipped=true; if item.kind='sid' then update public.app_catalog set in_store=false,updated_at=now() where id=item.id; update public.profiles set special_id=item.name,updated_at=now() where id=target; if item.name ~ '^[0-9]+$' then update public.rooms set room_uid=item.name::bigint,updated_at=now() where owner_id=target; end if; end if;
elsif admin and action='levels' then
      target=(select id from public.profiles where uid::text=payload->>'uid' or public_id::text=payload->>'uid' or special_id=payload->>'uid');
      if target is null then raise exception 'المستخدم غير موجود'; end if;
      if coalesce((payload->>'level')::integer,1) not between 1 and 100 then raise exception 'المستوى يجب أن يكون من 1 إلى 100'; end if;
      if coalesce((payload->>'vip')::integer,0) not between 0 and 12 then raise exception 'قيمة VIP غير صحيحة'; end if;
      if coalesce((payload->>'days')::integer,0)<0 then raise exception 'مدة VIP غير صحيحة'; end if;
      update public.profiles
      set level=coalesce((payload->>'level')::integer,level),
          vip=coalesce((payload->>'vip')::integer,0),
          vip_until=case
            when coalesce((payload->>'vip')::integer,0)=0 then null
            when coalesce((payload->>'days')::integer,0)>0 then now()+make_interval(days=>(payload->>'days')::integer)
            else null
          end
      where id=target;

      target=(select id from public.profiles where uid::text=payload->>'uid' or public_id::text=payload->>'uid' or special_id=payload->>'uid');
      if target is null then raise exception 'المستخدم غير موجود'; end if;
      if coalesce((payload->>'level')::integer,1) not between 1 and 100 then raise exception 'المستوى يجب أن يكون من 1 إلى 100'; end if;
      if coalesce((payload->>'vip')::integer,0) not between 0 and 12 then raise exception 'قيمة VIP غير صحيحة'; end if;
      if coalesce((payload->>'days')::integer,0)<0 then raise exception 'مدة VIP غير صحيحة'; end if;
      update public.profiles
      set level=coalesce((payload->>'level')::integer,level),
          vip=coalesce((payload->>'vip')::integer,0),
          vip_until=case
            when coalesce((payload->>'vip')::integer,0)=0 then null
            when coalesce((payload->>'days')::integer,0)>0 then now()+make_interval(days=>(payload->>'days')::integer)
            else null
          end
      where id=target;
    
elsif admin and action='recharge_decide' then
 update public.recharge_requests set status=payload->>'status',admin_note=left(coalesce(payload->>'message',''),300),decided_by=actor,decided_at=now()
 where id=(payload->>'id')::uuid and status='pending' returning * into req;
 if req.id is null then raise exception 'طلب الشحن غير موجود أو تمت معالجته'; end if;
 if req.status='approved' then
  update public.profiles set coins=coins+req.coins where id=req.user_id;
  insert into public.coin_ledger(sender_id,recipient_id,amount,kind) values(actor,req.user_id,req.coins,'recharge');
 elsif req.status<>'rejected' then raise exception 'حالة الطلب غير صحيحة'; end if;
 insert into public.app_notifications(user_id,title,body,kind,coins) values(req.user_id,case when req.status='approved' then 'تم قبول طلب الشحن' else 'تم رفض طلب الشحن' end,coalesce(payload->>'message',''),'notification',case when req.status='approved' then req.coins else 0 end);
elsif admin and action='style' then
 target=(select id from public.profiles where uid::text=payload->>'uid' or public_id::text=payload->>'uid' or special_id=payload->>'uid' limit 1);
 if target is null then raise exception 'المستخدم غير موجود'; end if;
 update public.profiles set name_color=nullif(payload->>'name_color',''),id_color=nullif(payload->>'id_color','') where id=target;
elsif admin and action='create_agency' then
 target=(select id from public.profiles where uid::text=payload->>'uid' or public_id::text=payload->>'uid' or special_id=payload->>'uid' limit 1);
 if target is null then raise exception 'المستخدم غير موجود'; end if;
 insert into public.agencies(owner_id,name,status,created_by) values(target,left(coalesce(nullif(payload->>'name',''),'وكالة جديدة'),80),'active',actor);
elsif admin and action='agency_decide' then
 if payload->>'status' not in ('approved','rejected') then raise exception 'قرار الوكالة غير صحيح'; end if;
 update public.agencies set status=payload->>'status' where id=(payload->>'id')::uuid;
 if not found then raise exception 'الوكالة غير موجودة'; end if;
elsif admin and action='notify' then
 target=null;
 if nullif(payload->>'uid','') is not null then
  target=(select id from public.profiles where uid::text=payload->>'uid' or public_id::text=payload->>'uid' or special_id=payload->>'uid' limit 1);
  if target is null then raise exception 'المستخدم غير موجود'; end if;
 end if;
 amount=greatest(0,coalesce((payload->>'coins')::bigint,0));
 if amount>0 and target is null then raise exception 'لا يمكن إرسال عملات عند اختيار الجميع'; end if;
 if amount>0 then
  update public.profiles set coins=coins+amount where id=target;
  insert into public.coin_ledger(sender_id,recipient_id,amount,kind) values(actor,target,amount,'credit');
 end if;
 insert into public.app_notifications(user_id,title,body,kind,coins) values(target,left(coalesce(payload->>'title',''),80),left(coalesce(payload->>'body',''),600),coalesce(payload->>'kind','notification'),amount);

elsif action='request_agency' or action='request_host_agency' then
  if exists(select 1 from public.user_roles where user_id=actor and role::text='host_agent') then
    raise exception 'الوكالة مفعّلة بالفعل';
  end if;
  select id into ag from public.agencies where owner_id=actor and status='pending' limit 1;
  if ag is null then
    insert into public.agencies(owner_id,created_by,name,slogan,image_path,status)
    values(actor,actor,'وكالتي','','','pending')
    on conflict(owner_id) do update
      set status=case when public.agencies.status='rejected' then 'pending' else public.agencies.status end
    returning id into ag;
  end if;
  target=actor;

elsif action='agency_edit' then
  select id into ag from public.agencies where owner_id=actor and status in ('approved','active') limit 1;
  if ag is null or not public.has_role(actor,'host_agent') then raise exception 'الوكالة غير مفعّلة أو لا تملك صلاحية التعديل'; end if;
  if length(trim(coalesce(payload->>'name','')))<2 or length(trim(payload->>'name'))>80 then raise exception 'اسم الوكالة يجب أن يكون من 2 إلى 80 حرفًا'; end if;
  if coalesce(payload->>'image_path','')<>'' and split_part(payload->>'image_path','/',1)<>'agency' then raise exception 'مسار صورة الوكالة غير صحيح'; end if;
  if coalesce(payload->>'image_path','')<>'' and split_part(payload->>'image_path','/',2)<>actor::text then raise exception 'صورة الوكالة يجب أن تكون مرفوعة من حسابك'; end if;
  update public.agencies set name=trim(payload->>'name'), slogan=left(coalesce(payload->>'slogan',''),160),
    image_path=coalesce(nullif(payload->>'image_path',''),image_path)
  where id=ag;
elsif action='host_add' then
  select id into ag from public.agencies where owner_id=actor and status in ('approved','active') limit 1;
  if ag is null or not public.has_role(actor,'host_agent') then raise exception 'الوكالة غير مفعّلة أو لا تملك صلاحية إضافة مضيف'; end if;
  select id into target from public.profiles where uid::text=payload->>'uid' or public_id=payload->>'uid' or special_id=payload->>'uid' limit 1;
  if target is null or target=actor then raise exception 'المضيف غير موجود'; end if;
  if exists(select 1 from public.agency_hosts where user_id=target and agency_id<>ag) then raise exception 'هذا المضيف تابع لوكالة أخرى بالفعل'; end if;
  insert into public.agency_hosts(agency_id,user_id) values(ag,target) on conflict(agency_id,user_id) do nothing;
  insert into public.agency_members(agency_id,user_id,role) values(ag,target,'host') on conflict(agency_id,user_id) do update set role='host';
  insert into public.user_roles(user_id,role) values(target,'host') on conflict do nothing;
elsif action='host_remove' then
  select id into ag from public.agencies where owner_id=actor and status in ('approved','active') limit 1;
  if ag is null or not public.has_role(actor,'host_agent') then raise exception 'الوكالة غير مفعّلة أو لا تملك صلاحية إزالة مضيف'; end if;
  select id into target from public.profiles where uid::text=payload->>'uid' or public_id=payload->>'uid' or special_id=payload->>'uid' limit 1;
  if target is null then raise exception 'المضيف غير موجود'; end if;
  delete from public.agency_hosts where agency_id=ag and user_id=target;
  delete from public.agency_members where agency_id=ag and user_id=target;
  if not exists(select 1 from public.agency_hosts where user_id=target) then
    delete from public.user_roles where user_id=target and role='host';
  end if;

else raise exception using message = 'عملية غير معروفة: '||action; end if;
insert into public.admin_audit(actor,action,target) select actor,action,coalesce(target::text,'') where admin;
return jsonb_build_object('ok',true);
end;

$function$

CREATE OR REPLACE FUNCTION public.agency_leaderboard()
 RETURNS TABLE(agency_id uuid, host_count bigint, total_diamonds bigint, agency_level integer, agency_rank bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with totals as (
    select a.id as agency_id,
           count(ah.user_id)::bigint as host_count,
           coalesce(sum(p.diamonds),0)::bigint as total_diamonds
    from public.agencies a
    left join public.agency_hosts ah on ah.agency_id=a.id
    left join public.profiles p on p.id=ah.user_id
    where a.status in ('approved','active')
    group by a.id
  ), ranked as (
    select t.*,
           greatest(1,(t.total_diamonds/100000)::integer+1) as agency_level,
           dense_rank() over(order by t.total_diamonds desc) as agency_rank
    from totals t
  )
  select agency_id,host_count,total_diamonds,agency_level,agency_rank from ranked;
$function$


revoke all on function public.request_host_agency() from public,anon;
grant execute on function public.request_host_agency() to authenticated;
revoke all on function public.app_action(text,jsonb) from public,anon;
grant execute on function public.app_action(text,jsonb) to authenticated;
revoke all on function public.agency_leaderboard() from public,anon;
grant execute on function public.agency_leaderboard() to authenticated;
