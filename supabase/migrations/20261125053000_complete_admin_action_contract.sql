-- Complete the admin action contract used by ControlPanel.
-- Safe to run after the baseline app_action migration.
do $$
declare
 v text;
 old_grant text;
 new_grant text;
 extra text;
begin
 v:=pg_get_functiondef('public.app_action(text,jsonb)'::regprocedure);

 old_grant := $g$elsif admin and action='grant' then target=(select id from public.profiles where uid::text=payload->>'uid' or public_id::text=payload->>'uid'); insert into public.user_items(user_id,catalog_id,expires_at) values(target,(payload->>'id')::uuid,case when coalesce((payload->>'days')::integer,0)>0 then now()+make_interval(days=>(payload->>'days')::integer) end) on conflict(user_id,catalog_id) do update set expires_at=excluded.expires_at,equipped=true;$g$;
 new_grant := $g$elsif admin and action='grant' then target=(select id from public.profiles where uid::text=payload->>'uid' or public_id::text=payload->>'uid' or special_id=payload->>'uid' limit 1); if target is null then raise exception 'المستخدم غير موجود: راجع ID'; end if; select * into item from public.app_catalog where id=(payload->>'id')::uuid and enabled; if item.id is null then raise exception 'العنصر غير موجود أو غير مفعل'; end if; days=coalesce((payload->>'days')::integer,item.duration_days,0); if days<0 then raise exception 'مدة العنصر غير صحيحة'; end if; insert into public.user_items(user_id,catalog_id,expires_at,equipped) values(target,item.id,case when days>0 then now()+make_interval(days=>days) else null end,true) on conflict(user_id,catalog_id) do update set expires_at=excluded.expires_at,equipped=true;$g$;
 if position(new_grant in v)=0 and position(old_grant in v)>0 then v:=replace(v,old_grant,new_grant); end if;

 extra := $e$
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
$e$;
 if position('elsif admin and action=''recharge_decide'' then' in v)=0 then
  v:=replace(v,'else raise exception ''عملية غير معروفة''; end if;',extra||E'\nelse raise exception using message = ''عملية غير معروفة: ''||action; end if;');
 end if;
 v:=replace(v,'where uid::text=payload->>''uid'' or public_id::text=payload->>''uid''','where uid::text=payload->>''uid'' or public_id::text=payload->>''uid'' or special_id=payload->>''uid''');
 execute v;
end $$;
