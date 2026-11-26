ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vip_until timestamptz, ADD COLUMN IF NOT EXISTS daily_day integer NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS daily_at timestamptz;
ALTER TABLE public.app_assets ADD COLUMN IF NOT EXISTS section text NOT NULL DEFAULT 'general';
ALTER TABLE public.app_catalog ADD COLUMN IF NOT EXISTS duration_days integer NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS in_store boolean NOT NULL DEFAULT true, ADD COLUMN IF NOT EXISTS publish_until timestamptz;
ALTER TABLE public.app_catalog ADD CONSTRAINT app_catalog_duration_check CHECK (duration_days >= 0 AND duration_days <= 3650);
ALTER TABLE public.app_catalog DROP CONSTRAINT app_catalog_kind_check;
ALTER TABLE public.app_catalog ADD CONSTRAINT app_catalog_kind_check CHECK (kind = ANY (ARRAY['gift','entry','frame','sid','bubble','seat','badge','banner','vip','level','room_frame','event','welcome','music']));
ALTER TABLE public.app_notifications ADD COLUMN IF NOT EXISTS catalog_id uuid REFERENCES public.app_catalog(id) ON DELETE SET NULL, ADD COLUMN IF NOT EXISTS coins bigint NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS notifications_catalog_idx ON public.app_notifications(catalog_id);

CREATE TABLE public.recharge_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  coins bigint NOT NULL CHECK (coins > 0),
  price text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_note text NOT NULL DEFAULT '',
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.recharge_requests TO authenticated;
GRANT ALL ON public.recharge_requests TO service_role;
ALTER TABLE public.recharge_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY recharge_read ON public.recharge_requests FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE INDEX recharge_user_idx ON public.recharge_requests(user_id);
CREATE INDEX recharge_status_idx ON public.recharge_requests(status, created_at DESC);

CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  room_uid bigint NOT NULL UNIQUE,
  name text NOT NULL,
  notice text NOT NULL DEFAULT '',
  cover text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rooms TO authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY rooms_public_read ON public.rooms FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.create_app_profile() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN INSERT INTO public.profiles(id,name) VALUES(NEW.id,COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name',''),'عضو جديد')) ON CONFLICT (id) DO NOTHING; RETURN NEW; END; $function$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.create_app_profile();
DO $$ BEGIN
  IF (SELECT last_value FROM pg_sequences WHERE schemaname='public' AND sequencename='profiles_uid_seq') IS NULL
     AND (SELECT start_value FROM pg_sequences WHERE schemaname='public' AND sequencename='profiles_uid_seq') < 100000 THEN
    ALTER TABLE public.profiles ALTER COLUMN uid RESTART WITH 100001;
  END IF;
END $$;
INSERT INTO public.profiles(id,name) SELECT u.id,COALESCE(NULLIF(u.raw_user_meta_data->>'full_name',''),'عضو جديد') FROM auth.users u ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.app_action(action text, payload jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE actor uuid:=auth.uid(); target uuid; item public.app_catalog; amount bigint; qty integer; isadmin boolean; r double precision; x integer:=0; win bigint:=0; i integer;
  d_day integer; d_at timestamptz; cur_vip integer; rvip integer; rname text; rcover text;
BEGIN
IF actor IS NULL THEN RAISE EXCEPTION 'سجل الدخول'; END IF;
IF EXISTS(SELECT 1 FROM public.profiles WHERE id=actor AND banned) THEN RAISE EXCEPTION 'الحساب محظور'; END IF;
isadmin:=public.has_role(actor,'admin');
IF NOT isadmin AND EXISTS(SELECT 1 FROM public.app_settings WHERE key='maintenance' AND value->>'enabled'='true') THEN RAISE EXCEPTION 'التطبيق تحت الصيانة'; END IF;
-- expire timed VIP and timed items
UPDATE public.profiles SET vip=0,vip_until=NULL WHERE id=actor AND vip_until IS NOT NULL AND vip_until<now();
IF EXISTS(SELECT 1 FROM public.user_items WHERE user_id=actor AND expires_at IS NOT NULL AND expires_at<now()) THEN
  UPDATE public.profiles SET special_id=NULL WHERE id=actor AND special_id IN(SELECT c.name FROM public.user_items ui JOIN public.app_catalog c ON c.id=ui.catalog_id WHERE ui.user_id=actor AND ui.expires_at<now() AND c.kind='sid');
  DELETE FROM public.user_items WHERE user_id=actor AND expires_at IS NOT NULL AND expires_at<now();
END IF;
IF action='request_agency' AND EXISTS(SELECT 1 FROM public.app_settings WHERE key='features' AND value->>'agency_requests'='false') THEN RAISE EXCEPTION 'طلبات الوكالات متوقفة'; END IF;
IF action='buy' AND EXISTS(SELECT 1 FROM public.app_settings WHERE key='features' AND value->>'store'='false') THEN RAISE EXCEPTION 'المتجر مغلق'; END IF;
IF action='activity' THEN
IF payload->>'kind'='mic' THEN UPDATE public.profiles SET mic_seconds=mic_seconds+CASE WHEN last_mic_at IS NULL THEN 0 ELSE LEAST(60,GREATEST(0,EXTRACT(EPOCH FROM now()-last_mic_at)::bigint)) END,last_mic_at=now() WHERE id=actor;
ELSE UPDATE public.profiles SET app_seconds=app_seconds+CASE WHEN last_app_at IS NULL THEN 0 ELSE LEAST(60,GREATEST(0,EXTRACT(EPOCH FROM now()-last_app_at)::bigint)) END,last_app_at=now() WHERE id=actor; END IF;
RETURN jsonb_build_object('ok',true);
ELSIF action='daily' THEN
SELECT daily_day,daily_at,vip INTO d_day,d_at,cur_vip FROM public.profiles WHERE id=actor FOR UPDATE;
IF d_at IS NOT NULL AND now()<d_at+interval '24 hours' THEN RAISE EXCEPTION 'استلمت مكافأة اليوم، عد بعد 24 ساعة'; END IF;
IF d_at IS NULL OR now()>d_at+interval '48 hours' OR d_day>=7 THEN d_day:=1; ELSE d_day:=d_day+1; END IF;
amount:=CASE d_day WHEN 1 THEN 15000 WHEN 2 THEN 20000 WHEN 5 THEN 15000 WHEN 7 THEN 20000 ELSE 0 END;
rvip:=CASE d_day WHEN 3 THEN 2 WHEN 4 THEN 3 WHEN 5 THEN 3 WHEN 6 THEN 5 WHEN 7 THEN 5 ELSE 0 END;
UPDATE public.profiles SET daily_day=d_day,daily_at=now(),coins=coins+amount WHERE id=actor;
IF rvip>0 AND rvip>cur_vip THEN UPDATE public.profiles SET vip=rvip,vip_until=now()+interval '1 day' WHERE id=actor;
ELSIF rvip>0 AND rvip=cur_vip THEN UPDATE public.profiles SET vip_until=GREATEST(vip_until,now()+interval '1 day') WHERE id=actor AND vip_until IS NOT NULL; END IF;
IF amount>0 THEN INSERT INTO public.coin_ledger(sender_id,recipient_id,amount,kind) VALUES(actor,actor,amount,'daily'); END IF;
INSERT INTO public.app_notifications(user_id,title,body,kind,coins) VALUES(actor,'مكافأة الدخول اليومي',concat_ws(' + ',CASE WHEN rvip>0 THEN 'VIP '||rvip||' لمدة يوم' END,CASE WHEN amount>0 THEN amount||' عملة' END),'reward',amount);
RETURN jsonb_build_object('ok',true,'day',d_day,'coins',amount,'vip',rvip);
ELSIF action='recharge_request' THEN
amount:=(payload->>'coins')::bigint; IF amount IS NULL OR amount<=0 OR amount>100000000 THEN RAISE EXCEPTION 'عدد العملات غير صحيح'; END IF;
IF (SELECT count(*) FROM public.recharge_requests WHERE user_id=actor AND status='pending')>=3 THEN RAISE EXCEPTION 'لديك طلبات شحن قيد المراجعة'; END IF;
INSERT INTO public.recharge_requests(user_id,coins,price,note) VALUES(actor,amount,left(COALESCE(payload->>'price',''),40),left(COALESCE(payload->>'note',''),300));
RETURN jsonb_build_object('ok',true);
ELSIF action='room_save' THEN
rname:=btrim(COALESCE(payload->>'name','')); IF char_length(rname)<2 OR char_length(rname)>24 THEN RAISE EXCEPTION 'اسم الغرفة من 2 إلى 24 حرفًا'; END IF;
rcover:=NULLIF(payload->>'cover','');
IF rcover IS NOT NULL AND (rcover !~ '^data:image/[a-z+]+;base64,' OR length(rcover)>400000) THEN RAISE EXCEPTION 'صورة الغرفة غير صالحة'; END IF;
INSERT INTO public.rooms(owner_id,room_uid,name,notice,cover) SELECT actor,p.uid,rname,left(COALESCE(payload->>'notice',''),200),rcover FROM public.profiles p WHERE p.id=actor
ON CONFLICT(owner_id) DO UPDATE SET name=EXCLUDED.name,notice=EXCLUDED.notice,cover=CASE WHEN payload ? 'cover' THEN EXCLUDED.cover ELSE public.rooms.cover END;
RETURN jsonb_build_object('ok',true);
ELSIF action='gift' THEN
IF EXISTS(SELECT 1 FROM public.app_settings WHERE key='features' AND value->>'gifts'='false') THEN RAISE EXCEPTION 'الهدايا متوقفة'; END IF;
SELECT * INTO item FROM public.app_catalog WHERE id=(payload->>'id')::uuid AND enabled AND kind='gift'; IF item.id IS NULL THEN RAISE EXCEPTION 'الهدية غير متاحة'; END IF;
SELECT id INTO target FROM public.profiles WHERE uid::text=payload->>'uid' OR special_id=payload->>'uid'; IF target IS NULL OR target=actor THEN RAISE EXCEPTION 'اختر مستخدمًا حقيقيًا آخر'; END IF;
qty:=(payload->>'qty')::integer; IF qty IS NULL OR qty<1 OR qty>520 THEN RAISE EXCEPTION 'كمية غير صحيحة'; END IF;
amount:=item.price*qty; IF amount<=0 THEN RAISE EXCEPTION 'سعر غير صحيح'; END IF;
PERFORM 1 FROM public.profiles WHERE id IN(actor,target) ORDER BY id FOR UPDATE;
UPDATE public.profiles SET coins=coins-amount WHERE id=actor AND coins>=amount; IF NOT FOUND THEN RAISE EXCEPTION 'رصيد غير كاف'; END IF;
UPDATE public.profiles SET gift_value=gift_value+amount,diamonds=diamonds+amount WHERE id=target AND NOT banned; IF NOT FOUND THEN RAISE EXCEPTION 'المستخدم محظور'; END IF;
INSERT INTO public.coin_ledger(sender_id,recipient_id,amount,kind) VALUES(actor,target,amount,'gift');
IF item.metadata->>'type'='lucky' THEN
  FOR i IN 1..LEAST(qty,99) LOOP
    r:=random();
    x:=GREATEST(x,CASE WHEN r<0.6 THEN 0 WHEN r<0.85 THEN 1 WHEN r<0.95 THEN 2 WHEN r<0.985 THEN 5 WHEN r<0.996 THEN 10 WHEN r<0.9995 THEN 100 ELSE 500 END);
    win:=win+item.price*(CASE WHEN r<0.6 THEN 0 WHEN r<0.85 THEN 1 WHEN r<0.95 THEN 2 WHEN r<0.985 THEN 5 WHEN r<0.996 THEN 10 WHEN r<0.9995 THEN 100 ELSE 500 END);
  END LOOP;
  IF win>0 THEN UPDATE public.profiles SET coins=coins+win WHERE id=actor; INSERT INTO public.coin_ledger(sender_id,recipient_id,amount,kind) VALUES(target,actor,win,'lucky'); END IF;
END IF;
RETURN jsonb_build_object('ok',true,'x',x,'win',win);
END IF;
RETURN public.app_action_internal(action,payload); END; $function$;

CREATE OR REPLACE FUNCTION public.app_action_internal(action text, payload jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE actor uuid:=auth.uid(); target uuid; ag uuid; item public.app_catalog; amount bigint; isadmin boolean; days integer; req public.recharge_requests; msg text; until_at timestamptz;
BEGIN
IF actor IS NULL THEN RAISE EXCEPTION 'سجّل الدخول أولاً'; END IF;
IF EXISTS(SELECT 1 FROM public.profiles WHERE id=actor AND banned) THEN RAISE EXCEPTION 'الحساب محظور'; END IF;
isadmin:=public.has_role(actor,'admin');
IF payload ? 'uid' THEN SELECT id INTO target FROM public.profiles WHERE uid::text=payload->>'uid' OR special_id=payload->>'uid'; IF target IS NULL THEN RAISE EXCEPTION 'ID المستخدم غير موجود'; END IF; END IF;
IF action='profile' THEN UPDATE public.profiles SET name=COALESCE(NULLIF(payload->>'name',''),name),bio=COALESCE(payload->>'bio',bio),avatar=COALESCE(payload->>'avatar',avatar) WHERE id=actor;
ELSIF action='request_agency' THEN INSERT INTO public.agencies(owner_id,created_by) VALUES(actor,actor) ON CONFLICT(owner_id) DO UPDATE SET status='pending' WHERE agencies.status='rejected';
ELSIF action='agency_edit' THEN IF NOT public.has_role(actor,'host_agent') THEN RAISE EXCEPTION 'الوكالة غير مفعلة'; END IF; UPDATE public.agencies SET name=payload->>'name',slogan=COALESCE(payload->>'slogan',''),image_path=COALESCE(payload->>'image_path','') WHERE owner_id=actor AND status='approved';
ELSIF action='create_agency' THEN IF NOT (isadmin OR public.has_role(actor,'bd')) THEN RAISE EXCEPTION 'غير مسموح'; END IF; IF target IS NULL THEN RAISE EXCEPTION 'أدخل ID'; END IF; INSERT INTO public.agencies(owner_id,created_by,name,status) VALUES(target,actor,COALESCE(payload->>'name',''),'approved') ON CONFLICT(owner_id) DO UPDATE SET status='approved',created_by=actor; INSERT INTO public.user_roles(user_id,role) VALUES(target,'host_agent') ON CONFLICT DO NOTHING;
ELSIF action='host_add' OR action='host_remove' THEN SELECT id INTO ag FROM public.agencies WHERE owner_id=actor AND status='approved'; IF ag IS NULL OR NOT public.has_role(actor,'host_agent') THEN RAISE EXCEPTION 'غير مسموح'; END IF; IF target IS NULL THEN RAISE EXCEPTION 'أدخل ID'; END IF; IF action='host_add' THEN INSERT INTO public.agency_hosts(agency_id,user_id) VALUES(ag,target); INSERT INTO public.user_roles(user_id,role) VALUES(target,'host') ON CONFLICT DO NOTHING; ELSE DELETE FROM public.agency_hosts WHERE agency_id=ag AND user_id=target; DELETE FROM public.user_roles WHERE user_id=target AND role='host'; END IF;
ELSIF action='transfer' THEN IF NOT public.has_role(actor,'recharge_agent') THEN RAISE EXCEPTION 'وكيل الشحن غير مفعل'; END IF; IF target IS NULL OR target=actor THEN RAISE EXCEPTION 'اختر مستخدماً آخر'; END IF; amount:=(payload->>'amount')::bigint; IF amount IS NULL OR amount<=0 OR amount>100000000 THEN RAISE EXCEPTION 'مبلغ غير صحيح'; END IF; PERFORM 1 FROM public.profiles WHERE id IN(actor,target) ORDER BY id FOR UPDATE; UPDATE public.profiles SET coins=coins-amount WHERE id=actor AND coins>=amount; IF NOT FOUND THEN RAISE EXCEPTION 'رصيد غير كاف'; END IF; UPDATE public.profiles SET coins=coins+amount WHERE id=target AND NOT banned; IF NOT FOUND THEN RAISE EXCEPTION 'المستخدم محظور'; END IF; INSERT INTO public.coin_ledger(sender_id,recipient_id,amount,kind) VALUES(actor,target,amount,'transfer');
ELSIF action='buy' OR action='equip' THEN
  SELECT * INTO item FROM public.app_catalog WHERE id=(payload->>'id')::uuid AND enabled;
  IF item.id IS NULL OR item.kind NOT IN('frame','entry','bubble','sid','seat','badge','vip') THEN RAISE EXCEPTION 'العنصر غير متاح'; END IF;
  IF action='buy' THEN
    IF NOT item.in_store OR (item.publish_until IS NOT NULL AND item.publish_until<now()) THEN RAISE EXCEPTION 'العنصر غير متاح'; END IF;
    IF EXISTS(SELECT 1 FROM public.user_items WHERE user_id=actor AND catalog_id=item.id) THEN RAISE EXCEPTION 'العنصر مملوك'; END IF;
    UPDATE public.profiles SET coins=coins-item.price WHERE id=actor AND coins>=item.price; IF NOT FOUND THEN RAISE EXCEPTION 'رصيد غير كاف'; END IF;
    INSERT INTO public.user_items(user_id,catalog_id,expires_at) VALUES(actor,item.id,CASE WHEN item.duration_days>0 THEN now()+make_interval(days=>item.duration_days) END);
  END IF;
  SELECT expires_at INTO until_at FROM public.user_items WHERE user_id=actor AND catalog_id=item.id; IF NOT FOUND THEN RAISE EXCEPTION 'العنصر غير مملوك'; END IF;
  UPDATE public.user_items SET equipped=false WHERE user_id=actor AND catalog_id IN(SELECT id FROM public.app_catalog WHERE kind=item.kind);
  UPDATE public.user_items SET equipped=true WHERE user_id=actor AND catalog_id=item.id;
  IF item.kind='sid' THEN UPDATE public.profiles SET special_id=item.name WHERE id=actor; ELSIF item.kind='vip' THEN UPDATE public.profiles SET vip=item.rank,vip_until=until_at WHERE id=actor; END IF;
ELSE
IF NOT isadmin THEN RAISE EXCEPTION 'التعديل للمسؤول فقط'; END IF;
IF action='ban' THEN UPDATE public.profiles SET banned=COALESCE((payload->>'enabled')::boolean,false) WHERE id=target AND id<>actor;
ELSIF action='levels' THEN days:=COALESCE((payload->>'days')::integer,0); IF days<0 OR days>3650 THEN RAISE EXCEPTION 'مدة غير صحيحة'; END IF; UPDATE public.profiles SET level=(payload->>'level')::integer,vip=(payload->>'vip')::integer,vip_until=CASE WHEN days>0 AND (payload->>'vip')::integer>0 THEN now()+make_interval(days=>days) END WHERE id=target;
ELSIF action='role' THEN IF payload->>'role'='admin' AND target=actor AND NOT (payload->>'enabled')::boolean THEN RAISE EXCEPTION 'لا يمكنك إلغاء صلاحيتك'; END IF; IF (payload->>'enabled')::boolean THEN INSERT INTO public.user_roles(user_id,role) VALUES(target,payload->>'role') ON CONFLICT DO NOTHING; ELSE DELETE FROM public.user_roles WHERE user_id=target AND role=payload->>'role'; END IF;
ELSIF action='credit' THEN amount:=(payload->>'amount')::bigint; IF amount IS NULL OR amount<=0 THEN RAISE EXCEPTION 'مبلغ غير صحيح'; END IF; UPDATE public.profiles SET coins=coins+amount WHERE id=target; INSERT INTO public.coin_ledger(sender_id,recipient_id,amount,kind) VALUES(actor,target,amount,'credit');
ELSIF action='grant' THEN
  SELECT * INTO item FROM public.app_catalog WHERE id=(payload->>'id')::uuid; IF item.id IS NULL THEN RAISE EXCEPTION 'اختر عنصراً'; END IF;
  IF item.kind NOT IN('frame','entry','bubble','sid','seat','badge','vip') THEN RAISE EXCEPTION 'هذا النوع لا يُرسل للمستخدمين'; END IF;
  IF target IS NULL THEN RAISE EXCEPTION 'أدخل ID'; END IF;
  days:=COALESCE((payload->>'days')::integer,item.duration_days); IF days<0 OR days>3650 THEN RAISE EXCEPTION 'مدة غير صحيحة'; END IF;
  until_at:=CASE WHEN days>0 THEN now()+make_interval(days=>days) END;
  IF item.kind<>'badge' THEN UPDATE public.user_items SET equipped=false WHERE user_id=target AND catalog_id IN(SELECT id FROM public.app_catalog WHERE kind=item.kind); END IF;
  INSERT INTO public.user_items(user_id,catalog_id,expires_at) VALUES(target,item.id,until_at) ON CONFLICT(user_id,catalog_id) DO UPDATE SET equipped=true,expires_at=EXCLUDED.expires_at;
  IF item.kind='sid' THEN UPDATE public.profiles SET special_id=item.name WHERE id=target; ELSIF item.kind='vip' THEN UPDATE public.profiles SET vip=item.rank,vip_until=until_at WHERE id=target; END IF;
  INSERT INTO public.app_notifications(user_id,title,body,kind,catalog_id) VALUES(target,'وصلتك هدية من الإدارة',item.name||CASE WHEN days>0 THEN ' · لمدة '||days||' يوم' ELSE ' · دائم' END,'reward',item.id);
ELSIF action='agency_decide' THEN UPDATE public.agencies SET status=payload->>'status' WHERE id=(payload->>'id')::uuid RETURNING owner_id INTO target; IF target IS NULL THEN RAISE EXCEPTION 'الطلب غير موجود'; END IF; IF payload->>'status'='approved' THEN INSERT INTO public.user_roles(user_id,role) VALUES(target,'host_agent') ON CONFLICT DO NOTHING; ELSE DELETE FROM public.user_roles WHERE user_id=target AND role='host_agent'; END IF;
ELSIF action='recharge_decide' THEN
  IF payload->>'status' NOT IN('approved','rejected') THEN RAISE EXCEPTION 'قرار غير صحيح'; END IF;
  SELECT * INTO req FROM public.recharge_requests WHERE id=(payload->>'id')::uuid AND status='pending' FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'الطلب غير موجود أو تمت معالجته'; END IF;
  msg:=left(btrim(COALESCE(payload->>'message','')),300); target:=req.user_id;
  UPDATE public.recharge_requests SET status=payload->>'status',admin_note=msg,decided_by=actor,decided_at=now() WHERE id=req.id;
  IF payload->>'status'='approved' THEN
    UPDATE public.profiles SET coins=coins+req.coins WHERE id=target;
    INSERT INTO public.coin_ledger(sender_id,recipient_id,amount,kind) VALUES(actor,target,req.coins,'recharge');
    INSERT INTO public.app_notifications(user_id,title,body,kind,coins) VALUES(target,'تم قبول طلب الشحن',COALESCE(NULLIF(msg,''),'تمت إضافة العملات إلى رصيدك'),'official',req.coins);
  ELSE
    INSERT INTO public.app_notifications(user_id,title,body,kind) VALUES(target,'تم رفض طلب الشحن',COALESCE(NULLIF(msg,''),'لم تتم الموافقة على طلب الشحن'),'official');
  END IF;
ELSIF action='style' THEN IF target IS NULL THEN RAISE EXCEPTION 'أدخل ID'; END IF; IF COALESCE(payload->>'name_color','') !~ '^(#[0-9a-fA-F]{6})?$' OR COALESCE(payload->>'id_color','') !~ '^(#[0-9a-fA-F]{6})?$' THEN RAISE EXCEPTION 'لون غير صحيح'; END IF; UPDATE public.profiles SET name_color=NULLIF(payload->>'name_color',''),id_color=NULLIF(payload->>'id_color','') WHERE id=target;
ELSIF action='notify' THEN
  IF COALESCE(payload->>'kind','notification') NOT IN('notification','official','reward') THEN RAISE EXCEPTION 'نوع غير صحيح'; END IF;
  IF btrim(COALESCE(payload->>'title',''))='' OR btrim(COALESCE(payload->>'body',''))='' THEN RAISE EXCEPTION 'اكتب العنوان والرسالة'; END IF;
  amount:=COALESCE((payload->>'coins')::bigint,0); IF amount<0 OR amount>100000000 THEN RAISE EXCEPTION 'مبلغ غير صحيح'; END IF;
  IF amount>0 THEN IF target IS NULL THEN RAISE EXCEPTION 'المكافأة بالعملات تحتاج ID مستخدم'; END IF; UPDATE public.profiles SET coins=coins+amount WHERE id=target; INSERT INTO public.coin_ledger(sender_id,recipient_id,amount,kind) VALUES(actor,target,amount,'credit'); END IF;
  INSERT INTO public.app_notifications(user_id,title,body,kind,coins) VALUES(target,left(payload->>'title',80),left(payload->>'body',600),COALESCE(payload->>'kind','notification'),amount);
ELSE RAISE EXCEPTION 'عملية غير معروفة'; END IF;
INSERT INTO public.admin_audit(actor,action,target) VALUES(actor,action,COALESCE(target::text,''));
END IF;
RETURN jsonb_build_object('ok',true); END; $function$;