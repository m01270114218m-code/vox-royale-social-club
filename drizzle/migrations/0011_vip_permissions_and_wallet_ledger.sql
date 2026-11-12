ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS kind TEXT,
  ADD COLUMN IF NOT EXISTS note TEXT;

UPDATE public.wallet_transactions
SET kind = COALESCE(kind, reason),
    note = COALESCE(note, reason)
WHERE kind IS NULL OR note IS NULL;

CREATE TABLE IF NOT EXISTS public.vip_perks (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  min_level INTEGER NOT NULL CHECK (min_level BETWEEN 1 AND 6),
  icon TEXT NOT NULL DEFAULT 'crown',
  sort_order INTEGER NOT NULL DEFAULT 0
);
GRANT SELECT ON public.vip_perks TO authenticated;
ALTER TABLE public.vip_perks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vip perks readable" ON public.vip_perks;
CREATE POLICY "vip perks readable" ON public.vip_perks FOR SELECT TO authenticated USING (true);

INSERT INTO public.vip_perks(code,name,description,min_level,icon,sort_order) VALUES
('vip_badge','شارة VIP','شارة VIP ثلاثية الأبعاد تظهر مع الملف الشخصي',1,'badge',10),
('noble_gifts','هدايا Noble','الوصول إلى هدايا Noble الخاصة',1,'gift',20),
('diamond_refund','استرداد Diamond','ميزة استرداد الألماس الخاصة بالمستوى',1,'diamond',30),
('entry_effects','تأثيرات الدخول','تشغيل تأثير دخول VIP عند دخول الغرفة',1,'sparkles',40),
('exclusive_head','غطاء رأس حصري','غطاء رأس VIP حصري',2,'crown',50),
('noble_bubble','فقاعة Noble','فقاعة محادثة Noble خاصة',2,'message',60),
('special_id','رقم مميز حصري','هوية ورقم مميز للمستخدم',2,'id',70),
('exclusive_ride','Ride حصري','مركبة/مظهر Ride حصري',2,'car',80),
('exclusive_daimu','Daimu حصري','مظهر Daimu حصري',3,'star',90),
('exclusive_logo','شعار حصري','شعار VIP حصري',3,'crown',100),
('exclusive_appearance','مظهر حصري','مظهر شخصي VIP حصري',3,'sparkles',110),
('mystery_person','الشخص الغامض','هوية ومظهر الشخص الغامض',3,'flame',120),
('exclusive_start_screen','شاشة بدء حصرية','شاشة بدء VIP خاصة',4,'image',130),
('kick_protection','الحماية من الطرد','لا يمكن للمشرفين طرد صاحب هذا المستوى من الغرفة',4,'shield',140),
('advanced_entry','تأثير دخول متقدم','تأثير دخول متقدم أعلى من المستويات السابقة',4,'sparkles',150),
('enhanced_noble_gifts','هدايا Noble محسّنة','مزايا هدايا Noble محسّنة',4,'gift',160),
('mute_protection','الحماية من الكتم','لا يمكن للمشرفين كتم صوت صاحب هذا المستوى',5,'shield',170),
('royal_badge','شارة ملكية حصرية','شارة ملكية متقدمة',5,'crown',180),
('royal_appearance','مظهر ملكي متقدم','هوية ومظهر ملكي متقدم',5,'sparkles',190),
('vip_priority','أولوية مزايا VIP','أولوية في مزايا VIP المتاحة',5,'star',200),
('vip6_badge','شارة VIP 6','شارة المستوى الأعلى',6,'crown',210),
('full_royal_perks','كل المميزات','يفتح جميع مميزات VIP السابقة والحالية',6,'crown',220),
('vip6_exclusive','مميزات VIP 6 الحصرية','مميزات إضافية حصرية لأعلى مستوى',6,'sparkles',230)
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,min_level=EXCLUDED.min_level,icon=EXCLUDED.icon,sort_order=EXCLUDED.sort_order;

CREATE OR REPLACE FUNCTION public.vip_has_perk(_perk TEXT) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p JOIN public.vip_perks v ON v.min_level <= COALESCE(p.vip_level,0) WHERE p.id = auth.uid() AND v.code = _perk);
$$;
REVOKE ALL ON FUNCTION public.vip_has_perk(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vip_has_perk(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.my_vip_perks()
RETURNS TABLE(code TEXT,name TEXT,description TEXT,min_level INTEGER,icon TEXT,sort_order INTEGER)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT v.code,v.name,v.description,v.min_level,v.icon,v.sort_order FROM public.vip_perks v JOIN public.profiles p ON p.id=auth.uid() WHERE v.min_level <= COALESCE(p.vip_level,0) ORDER BY v.sort_order;
$$;
REVOKE ALL ON FUNCTION public.my_vip_perks() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_vip_perks() TO authenticated;

CREATE OR REPLACE FUNCTION public.buy_vip(_level int) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _price bigint; _cur int; _bal bigint;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  IF _level < 1 OR _level > 6 THEN RAISE EXCEPTION 'bad level'; END IF;
  _price := (array[1000,3000,8000,20000,50000,120000])[_level];
  SELECT vip_level INTO _cur FROM profiles WHERE id=auth.uid();
  IF _cur >= _level THEN RAISE EXCEPTION 'already vip'; END IF;
  SELECT coins INTO _bal FROM wallets WHERE user_id=auth.uid() FOR UPDATE;
  IF COALESCE(_bal,0) < _price THEN RAISE EXCEPTION 'insufficient coins'; END IF;
  UPDATE wallets SET coins=coins-_price, updated_at=now() WHERE user_id=auth.uid();
  INSERT INTO wallet_transactions(user_id,currency,amount,reason,kind,note) VALUES (auth.uid(),'coins',-_price,'vip_purchase','vip_purchase','شراء VIP المستوى ' || _level);
  UPDATE profiles SET vip_level=_level WHERE id=auth.uid();
  RETURN _bal-_price;
END $$;
REVOKE ALL ON FUNCTION public.buy_vip(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buy_vip(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.ban_user(_room uuid, _user uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _target_vip integer;
BEGIN
  IF NOT is_room_staff(_room, auth.uid()) THEN RAISE EXCEPTION 'not allowed'; END IF;
  IF _user = (SELECT owner_id FROM rooms WHERE id=_room) THEN RAISE EXCEPTION 'cannot ban owner'; END IF;
  SELECT COALESCE(vip_level,0) INTO _target_vip FROM profiles WHERE id=_user;
  IF _target_vip >= 4 THEN RAISE EXCEPTION 'vip_kick_protected'; END IF;
  INSERT INTO room_bans(room_id,user_id,banned_by) VALUES (_room,_user,auth.uid()) ON CONFLICT DO NOTHING;
  UPDATE room_seats SET user_id=null WHERE room_id=_room AND user_id=_user;
  DELETE FROM room_members WHERE room_id=_room AND user_id=_user;
END $$;
REVOKE ALL ON FUNCTION public.ban_user(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ban_user(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_seat_action(_room uuid, _seat int, _action text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _target uuid; _target_vip integer;
BEGIN
  IF NOT is_room_staff(_room, auth.uid()) THEN RAISE EXCEPTION 'not allowed'; END IF;
  SELECT user_id INTO _target FROM room_seats WHERE room_id=_room AND seat_index=_seat;
  SELECT COALESCE(vip_level,0) INTO _target_vip FROM profiles WHERE id=_target;
  IF _action='mute' AND _target_vip >= 5 THEN RAISE EXCEPTION 'vip_mute_protected'; END IF;
  IF _action='kick_seat' AND _target_vip >= 4 THEN RAISE EXCEPTION 'vip_kick_protected'; END IF;
  IF _action='lock' THEN UPDATE room_seats SET is_locked=true,user_id=null,updated_at=now() WHERE room_id=_room AND seat_index=_seat;
  ELSIF _action='unlock' THEN UPDATE room_seats SET is_locked=false,updated_at=now() WHERE room_id=_room AND seat_index=_seat;
  ELSIF _action='mute' THEN UPDATE room_seats SET is_muted=true,updated_at=now() WHERE room_id=_room AND seat_index=_seat;
  ELSIF _action='unmute' THEN UPDATE room_seats SET is_muted=false,updated_at=now() WHERE room_id=_room AND seat_index=_seat;
  ELSIF _action='kick_seat' THEN UPDATE room_seats SET user_id=null,is_muted=false,updated_at=now() WHERE room_id=_room AND seat_index=_seat;
  ELSE RAISE EXCEPTION 'unknown action'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.staff_seat_action(uuid,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_seat_action(uuid,integer,text) TO authenticated;
