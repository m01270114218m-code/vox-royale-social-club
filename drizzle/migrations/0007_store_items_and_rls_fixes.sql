-- Store items: frames, entry effects, name effects
CREATE TABLE public.store_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('frame','entry','name_effect','theme')),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price INTEGER NOT NULL CHECK (price >= 0),
  asset_key TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT ON public.store_items TO anon, authenticated;
GRANT ALL ON public.store_items TO service_role;
ALTER TABLE public.store_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "store items readable" ON public.store_items FOR SELECT USING (true);

-- User inventory
CREATE TABLE public.user_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.store_items(id) ON DELETE CASCADE,
  acquired_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, item_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_items TO authenticated;
GRANT ALL ON public.user_items TO service_role;
ALTER TABLE public.user_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own inventory readable" ON public.user_items FOR SELECT USING (auth.uid() = user_id);

-- Equipped items on profile
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS equipped_frame TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS equipped_entry TEXT;

-- Buy an item with coins (atomic)
CREATE OR REPLACE FUNCTION public.buy_item(_item_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _price INTEGER;
  _balance BIGINT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT price INTO _price FROM public.store_items WHERE id = _item_id;
  IF _price IS NULL THEN RAISE EXCEPTION 'item not found'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_items WHERE user_id = _uid AND item_id = _item_id) THEN
    RAISE EXCEPTION 'already owned';
  END IF;
  UPDATE public.wallets SET coins = coins - _price WHERE user_id = _uid AND coins >= _price RETURNING coins INTO _balance;
  IF _balance IS NULL THEN RAISE EXCEPTION 'insufficient coins'; END IF;
  INSERT INTO public.user_items (user_id, item_id) VALUES (_uid, _item_id);
  INSERT INTO public.wallet_transactions (user_id, amount, kind, note)
    VALUES (_uid, -_price, 'purchase', (SELECT name FROM public.store_items WHERE id = _item_id));
  RETURN _balance;
END;
$$;
REVOKE ALL ON FUNCTION public.buy_item(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buy_item(UUID) TO authenticated;

-- Equip / unequip an owned item
CREATE OR REPLACE FUNCTION public.equip_item(_item_id UUID, _equip BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _kind TEXT;
  _key TEXT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT kind, asset_key INTO _kind, _key FROM public.store_items WHERE id = _item_id;
  IF _kind IS NULL THEN RAISE EXCEPTION 'item not found'; END IF;
  IF _equip AND NOT EXISTS (SELECT 1 FROM public.user_items WHERE user_id = _uid AND item_id = _item_id) THEN
    RAISE EXCEPTION 'not owned';
  END IF;
  IF _kind = 'frame' THEN
    UPDATE public.profiles SET equipped_frame = CASE WHEN _equip THEN _key ELSE NULL END WHERE id = _uid;
  ELSIF _kind = 'entry' THEN
    UPDATE public.profiles SET equipped_entry = CASE WHEN _equip THEN _key ELSE NULL END WHERE id = _uid;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.equip_item(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.equip_item(UUID, BOOLEAN) TO authenticated;

-- Seed the store catalog (frames + entry effects)
INSERT INTO public.store_items (kind, name, description, price, asset_key, sort_order) VALUES
  ('frame', 'إطار الفارس', 'إطار صورة فضي لامع', 500, 'frame-1', 1),
  ('frame', 'إطار الذهب', 'إطار ذهبي فاخر', 1500, 'frame-2', 2),
  ('frame', 'إطار الملك', 'إطار ملكي بالتاج', 4000, 'frame-3', 3),
  ('frame', 'إطار التنين', 'إطار ناري بالتنين', 9000, 'frame-4', 4),
  ('frame', 'إطار الماس', 'إطار ماسي متلألئ', 20000, 'frame-5', 5),
  ('frame', 'إطار الأسطورة', 'أندر إطار في التطبيق', 50000, 'frame-6', 6),
  ('entry', 'دخولية البرق', 'تظهر مع وميض برق عند دخولك الغرفة', 800, 'entry-bolt', 1),
  ('entry', 'دخولية السيارة', 'تدخل الغرفة بسيارة فاخرة', 2500, 'entry-car', 2),
  ('entry', 'دخولية الصاروخ', 'دخول صاروخي مدوٍّ', 6000, 'entry-rocket', 3),
  ('entry', 'دخولية التنين', 'تنين يرافق دخولك', 15000, 'entry-dragon', 4);

-- Fix open-read policies: scope follows to involved users
DROP POLICY IF EXISTS "follows readable" ON public.follows;
CREATE POLICY "follows readable" ON public.follows FOR SELECT
  USING (auth.uid() = follower_id OR auth.uid() = following_id);

-- Scope likes to post participants (post author or liker)
DROP POLICY IF EXISTS "likes readable" ON public.post_likes;
CREATE POLICY "likes readable" ON public.post_likes FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid()
  ));

-- Scope room membership to the member themselves and the room owner
DROP POLICY IF EXISTS "members readable" ON public.room_members;
CREATE POLICY "members readable" ON public.room_members FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.rooms r WHERE r.id = room_id AND r.owner_id = auth.uid()
  ));