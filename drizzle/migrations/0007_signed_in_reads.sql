DROP POLICY IF EXISTS "posts readable" ON public.posts;
CREATE POLICY "posts readable" ON public.posts FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "mods readable" ON public.room_moderators;
CREATE POLICY "mods readable" ON public.room_moderators FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "seats readable" ON public.room_seats;
CREATE POLICY "seats readable" ON public.room_seats FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
REVOKE SELECT ON public.posts, public.room_moderators, public.room_seats FROM anon;