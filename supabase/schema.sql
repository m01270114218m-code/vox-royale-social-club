-- Sada Chat: complete database setup for a fresh Supabase project.
-- Run this whole file once in Supabase -> SQL Editor.
-- Afterwards sign up in the app, then make yourself admin with the statement at the very bottom.

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.12
-- Dumped by pg_dump version 17.12

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = off;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET escape_string_warning = off;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: app_action(text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_action(action text, payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
RETURN public.app_action_internal(action,payload); END; $$;


--
-- Name: app_action_internal(text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_action_internal(action text, payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
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
RETURN jsonb_build_object('ok',true); END; $_$;


--
-- Name: create_app_profile(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_app_profile() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN INSERT INTO public.profiles(id,name) VALUES(NEW.id,COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name',''),'عضو جديد')) ON CONFLICT (id) DO NOTHING; RETURN NEW; END; $$;


--
-- Name: has_role(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=_user_id AND banned); $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor uuid NOT NULL,
    action text NOT NULL,
    target text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: agencies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agencies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    created_by uuid NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    image_path text DEFAULT ''::text NOT NULL,
    slogan text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT agencies_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: agency_hosts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agency_hosts (
    agency_id uuid NOT NULL,
    user_id uuid NOT NULL
);


--
-- Name: app_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_key text DEFAULT ('upload/'::text || gen_random_uuid()::text) NOT NULL UNIQUE,
    title text NOT NULL,
    category text NOT NULL,
    storage_path text NOT NULL,
    mime_type text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    section text DEFAULT 'general'::text NOT NULL,
    name text NOT NULL,
    path text NOT NULL,
    mime text
);


--
-- Name: app_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_catalog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    kind text NOT NULL,
    name text NOT NULL,
    asset_id uuid,
    price bigint DEFAULT 0 NOT NULL,
    rank integer DEFAULT 0 NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    link text DEFAULT ''::text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    home boolean DEFAULT false NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    duration_days integer DEFAULT 0 NOT NULL,
    in_store boolean DEFAULT true NOT NULL,
    publish_until timestamp with time zone,
    CONSTRAINT app_catalog_duration_check CHECK (((duration_days >= 0) AND (duration_days <= 3650))),
    CONSTRAINT app_catalog_kind_check CHECK ((kind = ANY (ARRAY['gift'::text, 'entry'::text, 'frame'::text, 'sid'::text, 'bubble'::text, 'seat'::text, 'badge'::text, 'banner'::text, 'vip'::text, 'level'::text, 'room_frame'::text, 'event'::text, 'welcome'::text, 'music'::text]))),
    CONSTRAINT app_catalog_price_check CHECK ((price >= 0))
);


--
-- Name: app_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    title text NOT NULL,
    body text NOT NULL,
    kind text DEFAULT 'notification'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    catalog_id uuid,
    coins bigint DEFAULT 0 NOT NULL
);


--
-- Name: app_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_settings (
    key text NOT NULL,
    value jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: coin_ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coin_ledger (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sender_id uuid NOT NULL,
    recipient_id uuid NOT NULL,
    amount bigint NOT NULL,
    kind text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT coin_ledger_amount_check CHECK ((amount > 0))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    uid bigint NOT NULL,
    name text DEFAULT 'عضو جديد'::text NOT NULL,
    avatar text,
    bio text DEFAULT ''::text NOT NULL,
    level integer DEFAULT 1 NOT NULL,
    vip integer DEFAULT 0 NOT NULL,
    coins bigint DEFAULT 0 NOT NULL,
    diamonds bigint DEFAULT 0 NOT NULL,
    banned boolean DEFAULT false NOT NULL,
    special_id text,
    app_seconds bigint DEFAULT 0 NOT NULL,
    mic_seconds bigint DEFAULT 0 NOT NULL,
    gift_value bigint DEFAULT 0 NOT NULL,
    last_app_at timestamp with time zone,
    last_mic_at timestamp with time zone,
    name_color text,
    id_color text,
    vip_until timestamp with time zone,
    daily_day integer DEFAULT 0 NOT NULL,
    daily_at timestamp with time zone,
    CONSTRAINT profile_vip_art_range CHECK ((vip <= 12)),
    CONSTRAINT profiles_coins_check CHECK ((coins >= 0)),
    CONSTRAINT profiles_diamonds_check CHECK ((diamonds >= 0)),
    CONSTRAINT profiles_level_check CHECK (((level >= 1) AND (level <= 100))),
    CONSTRAINT profiles_vip_check CHECK (((vip >= 0) AND (vip <= 20)))
);


--
-- Name: profiles_uid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.profiles ALTER COLUMN uid ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.profiles_uid_seq
    START WITH 2000000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: recharge_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recharge_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    coins bigint NOT NULL,
    price text DEFAULT ''::text NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    admin_note text DEFAULT ''::text NOT NULL,
    decided_by uuid,
    decided_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT recharge_requests_coins_check CHECK ((coins > 0)),
    CONSTRAINT recharge_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: room_controls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.room_controls (
    room_id text NOT NULL,
    banned boolean DEFAULT false NOT NULL,
    frame_id uuid
);


--
-- Name: rooms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rooms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    room_uid bigint NOT NULL,
    name text NOT NULL,
    notice text DEFAULT ''::text NOT NULL,
    cover text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    catalog_id uuid NOT NULL,
    equipped boolean DEFAULT true NOT NULL,
    expires_at timestamp with time zone
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role text NOT NULL,
    CONSTRAINT user_roles_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'moderator'::text, 'bd'::text, 'recharge_agent'::text, 'host_agent'::text, 'host'::text])))
);


--
-- Name: admin_audit admin_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit
    ADD CONSTRAINT admin_audit_pkey PRIMARY KEY (id);


--
-- Name: agencies agencies_owner_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agencies
    ADD CONSTRAINT agencies_owner_id_key UNIQUE (owner_id);


--
-- Name: agencies agencies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agencies
    ADD CONSTRAINT agencies_pkey PRIMARY KEY (id);


--
-- Name: agency_hosts agency_hosts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agency_hosts
    ADD CONSTRAINT agency_hosts_pkey PRIMARY KEY (agency_id, user_id);


--
-- Name: agency_hosts agency_hosts_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agency_hosts
    ADD CONSTRAINT agency_hosts_user_id_key UNIQUE (user_id);


--
-- Name: app_assets app_assets_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_assets
    ADD CONSTRAINT app_assets_path_key UNIQUE (path);


--
-- Name: app_assets app_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_assets
    ADD CONSTRAINT app_assets_pkey PRIMARY KEY (id);


--
-- Name: app_catalog app_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_catalog
    ADD CONSTRAINT app_catalog_pkey PRIMARY KEY (id);


--
-- Name: app_notifications app_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_notifications
    ADD CONSTRAINT app_notifications_pkey PRIMARY KEY (id);


--
-- Name: app_settings app_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (key);


--
-- Name: coin_ledger coin_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_ledger
    ADD CONSTRAINT coin_ledger_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_special_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_special_id_key UNIQUE (special_id);


--
-- Name: profiles profiles_uid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_uid_key UNIQUE (uid);


--
-- Name: recharge_requests recharge_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recharge_requests
    ADD CONSTRAINT recharge_requests_pkey PRIMARY KEY (id);


--
-- Name: room_controls room_controls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_controls
    ADD CONSTRAINT room_controls_pkey PRIMARY KEY (room_id);


--
-- Name: rooms rooms_owner_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_owner_id_key UNIQUE (owner_id);


--
-- Name: rooms rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_pkey PRIMARY KEY (id);


--
-- Name: rooms rooms_room_uid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_room_uid_key UNIQUE (room_uid);


--
-- Name: user_items user_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_items
    ADD CONSTRAINT user_items_pkey PRIMARY KEY (id);


--
-- Name: user_items user_items_user_id_catalog_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_items
    ADD CONSTRAINT user_items_user_id_catalog_id_key UNIQUE (user_id, catalog_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: catalog_asset_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX catalog_asset_idx ON public.app_catalog USING btree (asset_id);


--
-- Name: items_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX items_user_idx ON public.user_items USING btree (user_id);


--
-- Name: notifications_catalog_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_catalog_idx ON public.app_notifications USING btree (catalog_id);


--
-- Name: notifications_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_user_idx ON public.app_notifications USING btree (user_id);


--
-- Name: recharge_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recharge_status_idx ON public.recharge_requests USING btree (status, created_at DESC);


--
-- Name: recharge_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recharge_user_idx ON public.recharge_requests USING btree (user_id);


--
-- Name: room_controls_frame_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX room_controls_frame_idx ON public.room_controls USING btree (frame_id);


--
-- Name: user_items_catalog_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_items_catalog_idx ON public.user_items USING btree (catalog_id);


--
-- Name: agencies agencies_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agencies
    ADD CONSTRAINT agencies_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id);


--
-- Name: agency_hosts agency_hosts_agency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agency_hosts
    ADD CONSTRAINT agency_hosts_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES public.agencies(id);


--
-- Name: agency_hosts agency_hosts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agency_hosts
    ADD CONSTRAINT agency_hosts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: app_catalog app_catalog_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_catalog
    ADD CONSTRAINT app_catalog_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.app_assets(id);


--
-- Name: app_notifications app_notifications_catalog_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_notifications
    ADD CONSTRAINT app_notifications_catalog_id_fkey FOREIGN KEY (catalog_id) REFERENCES public.app_catalog(id) ON DELETE SET NULL;


--
-- Name: app_notifications app_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_notifications
    ADD CONSTRAINT app_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: recharge_requests recharge_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recharge_requests
    ADD CONSTRAINT recharge_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: room_controls room_controls_frame_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_controls
    ADD CONSTRAINT room_controls_frame_id_fkey FOREIGN KEY (frame_id) REFERENCES public.app_catalog(id);


--
-- Name: rooms rooms_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_items user_items_catalog_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_items
    ADD CONSTRAINT user_items_catalog_id_fkey FOREIGN KEY (catalog_id) REFERENCES public.app_catalog(id);


--
-- Name: user_items user_items_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_items
    ADD CONSTRAINT user_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: admin_audit; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_audit ENABLE ROW LEVEL SECURITY;

--
-- Name: agencies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;

--
-- Name: agencies agencies_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agencies_read ON public.agencies FOR SELECT TO authenticated USING (((owner_id = auth.uid()) OR (created_by = auth.uid()) OR public.has_role(auth.uid(), 'admin'::text)));


--
-- Name: agency_hosts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agency_hosts ENABLE ROW LEVEL SECURITY;

--
-- Name: app_assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_assets ENABLE ROW LEVEL SECURITY;

--
-- Name: app_catalog; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_catalog ENABLE ROW LEVEL SECURITY;

--
-- Name: app_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: app_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: app_assets assets_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY assets_admin ON public.app_assets TO authenticated USING (public.has_role(auth.uid(), 'admin'::text)) WITH CHECK (public.has_role(auth.uid(), 'admin'::text));


--
-- Name: app_assets assets_published; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY assets_published ON public.app_assets FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.app_catalog c
  WHERE ((c.asset_id = app_assets.id) AND c.enabled))));


--
-- Name: app_assets assets_splash_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY assets_splash_read ON public.app_assets FOR SELECT TO authenticated USING ((section = 'splash'::text));


--
-- Name: admin_audit audit_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_read ON public.admin_audit FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::text));


--
-- Name: app_catalog catalog_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY catalog_admin ON public.app_catalog TO authenticated USING (public.has_role(auth.uid(), 'admin'::text)) WITH CHECK (public.has_role(auth.uid(), 'admin'::text));


--
-- Name: app_catalog catalog_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY catalog_public ON public.app_catalog FOR SELECT TO authenticated, anon USING ((enabled OR public.has_role(auth.uid(), 'admin'::text)));


--
-- Name: coin_ledger; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coin_ledger ENABLE ROW LEVEL SECURITY;

--
-- Name: agency_hosts hosts_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hosts_read ON public.agency_hosts FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.agencies
  WHERE ((agencies.id = agency_hosts.agency_id) AND (agencies.owner_id = auth.uid())))) OR public.has_role(auth.uid(), 'admin'::text)));


--
-- Name: user_items items_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY items_read ON public.user_items FOR SELECT TO authenticated USING (true);


--
-- Name: coin_ledger ledger_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ledger_read ON public.coin_ledger FOR SELECT TO authenticated USING (((sender_id = auth.uid()) OR (recipient_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::text)));


--
-- Name: app_notifications notifications_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_read ON public.app_notifications FOR SELECT TO authenticated USING (((user_id IS NULL) OR (user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::text)));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_read ON public.profiles FOR SELECT TO authenticated USING (true);


--
-- Name: recharge_requests recharge_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY recharge_read ON public.recharge_requests FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::text)));


--
-- Name: recharge_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recharge_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles roles_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY roles_read ON public.user_roles FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::text)));


--
-- Name: room_controls; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.room_controls ENABLE ROW LEVEL SECURITY;

--
-- Name: rooms; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

--
-- Name: room_controls rooms_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rooms_admin ON public.room_controls TO authenticated USING (public.has_role(auth.uid(), 'admin'::text)) WITH CHECK (public.has_role(auth.uid(), 'admin'::text));


--
-- Name: rooms rooms_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rooms_public_read ON public.rooms FOR SELECT TO authenticated USING (true);


--
-- Name: room_controls rooms_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rooms_read ON public.room_controls FOR SELECT TO authenticated, anon USING (true);


--
-- Name: app_settings settings_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY settings_read ON public.app_settings FOR SELECT TO authenticated, anon USING (true);


--
-- Name: app_settings settings_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY settings_write ON public.app_settings TO authenticated USING (public.has_role(auth.uid(), 'admin'::text)) WITH CHECK (public.has_role(auth.uid(), 'admin'::text));


--
-- Name: user_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_items ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION app_action(action text, payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.app_action(action text, payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.app_action(action text, payload jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.app_action(action text, payload jsonb) TO service_role;


--
-- Name: FUNCTION app_action_internal(action text, payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.app_action_internal(action text, payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.app_action_internal(action text, payload jsonb) TO service_role;


--
-- Name: FUNCTION create_app_profile(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_app_profile() FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_app_profile() TO service_role;


--
-- Name: FUNCTION has_role(_user_id uuid, _role text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.has_role(_user_id uuid, _role text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role text) TO anon;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role text) TO authenticated;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role text) TO service_role;


--
-- Name: TABLE admin_audit; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.admin_audit TO anon;
GRANT ALL ON TABLE public.admin_audit TO authenticated;
GRANT ALL ON TABLE public.admin_audit TO service_role;


--
-- Name: TABLE agencies; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.agencies TO anon;
GRANT ALL ON TABLE public.agencies TO authenticated;
GRANT ALL ON TABLE public.agencies TO service_role;


--
-- Name: TABLE agency_hosts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.agency_hosts TO anon;
GRANT ALL ON TABLE public.agency_hosts TO authenticated;
GRANT ALL ON TABLE public.agency_hosts TO service_role;


--
-- Name: TABLE app_assets; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.app_assets TO anon;
GRANT ALL ON TABLE public.app_assets TO authenticated;
GRANT ALL ON TABLE public.app_assets TO service_role;


--
-- Name: TABLE app_catalog; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.app_catalog TO anon;
GRANT ALL ON TABLE public.app_catalog TO authenticated;
GRANT ALL ON TABLE public.app_catalog TO service_role;


--
-- Name: TABLE app_notifications; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.app_notifications TO anon;
GRANT ALL ON TABLE public.app_notifications TO authenticated;
GRANT ALL ON TABLE public.app_notifications TO service_role;


--
-- Name: TABLE app_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.app_settings TO anon;
GRANT ALL ON TABLE public.app_settings TO authenticated;
GRANT ALL ON TABLE public.app_settings TO service_role;


--
-- Name: TABLE coin_ledger; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.coin_ledger TO anon;
GRANT ALL ON TABLE public.coin_ledger TO authenticated;
GRANT ALL ON TABLE public.coin_ledger TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: SEQUENCE profiles_uid_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.profiles_uid_seq TO anon;
GRANT ALL ON SEQUENCE public.profiles_uid_seq TO authenticated;
GRANT ALL ON SEQUENCE public.profiles_uid_seq TO service_role;


--
-- Name: TABLE recharge_requests; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.recharge_requests TO anon;
GRANT ALL ON TABLE public.recharge_requests TO authenticated;
GRANT ALL ON TABLE public.recharge_requests TO service_role;


--
-- Name: TABLE room_controls; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.room_controls TO anon;
GRANT ALL ON TABLE public.room_controls TO authenticated;
GRANT ALL ON TABLE public.room_controls TO service_role;


--
-- Name: TABLE rooms; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.rooms TO anon;
GRANT ALL ON TABLE public.rooms TO authenticated;
GRANT ALL ON TABLE public.rooms TO service_role;


--
-- Name: TABLE user_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_items TO anon;
GRANT ALL ON TABLE public.user_items TO authenticated;
GRANT ALL ON TABLE public.user_items TO service_role;


--
-- Name: TABLE user_roles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_roles TO anon;
GRANT ALL ON TABLE public.user_roles TO authenticated;
GRANT ALL ON TABLE public.user_roles TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- PostgreSQL database dump complete
--




-- ---------- sign-up: create the profile row ----------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.create_app_profile();

-- ---------- private storage for uploaded art ----------
INSERT INTO storage.buckets (id, name, public, file_size_limit) VALUES ('app-assets', 'app-assets', false, 52428800) ON CONFLICT (id) DO NOTHING;
CREATE POLICY agency_image_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'app-assets' AND (storage.foldername(name))[1] = 'agency');
CREATE POLICY agency_image_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'app-assets' AND (storage.foldername(name))[1] = 'agency' AND (storage.foldername(name))[2] = (auth.uid())::text AND public.has_role(auth.uid(), 'host_agent'));
CREATE POLICY storage_admin ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'app-assets' AND public.has_role(auth.uid(), 'admin')) WITH CHECK (bucket_id = 'app-assets' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY storage_catalog ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'app-assets' AND EXISTS (SELECT 1 FROM public.app_assets a JOIN public.app_catalog c ON c.asset_id = a.id WHERE a.path = objects.name AND c.enabled));
CREATE POLICY storage_splash_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'app-assets' AND (storage.foldername(name))[1] = 'library' AND (storage.foldername(name))[2] = 'splash');

-- ---------- make yourself the admin (after signing up in the app) ----------
-- INSERT INTO public.user_roles (user_id, role) SELECT id, 'admin' FROM auth.users WHERE email = 'YOUR_EMAIL_HERE';
