-- Room microphone access restrictions, independent from room bans.
CREATE TABLE IF NOT EXISTS public.room_mic_bans (
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

ALTER TABLE public.room_mic_bans ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.room_mic_bans TO authenticated;
DROP POLICY IF EXISTS "room staff read mic restrictions" ON public.room_mic_bans;
CREATE POLICY "room staff read mic restrictions"
  ON public.room_mic_bans FOR SELECT TO authenticated
  USING (public.is_room_staff(room_id, (SELECT auth.uid())));

CREATE OR REPLACE FUNCTION public.staff_set_mic_access(_room uuid, _user uuid, _blocked boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_owner uuid;
BEGIN
  IF v_actor IS NULL OR NOT public.is_room_staff(_room, v_actor) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  SELECT owner_id INTO v_owner FROM public.rooms WHERE id = _room;
  IF NOT FOUND THEN RAISE EXCEPTION 'room not found'; END IF;
  IF _user = v_owner OR _user = v_actor THEN RAISE EXCEPTION 'cannot restrict this user'; END IF;

  IF _blocked THEN
    INSERT INTO public.room_mic_bans(room_id, user_id, blocked_by)
    VALUES (_room, _user, v_actor)
    ON CONFLICT (room_id, user_id) DO UPDATE SET blocked_by = EXCLUDED.blocked_by, created_at = now();
    UPDATE public.room_seats
      SET user_id = NULL, is_muted = false, updated_at = now()
      WHERE room_id = _room AND user_id = _user;
  ELSE
    DELETE FROM public.room_mic_bans WHERE room_id = _room AND user_id = _user;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.staff_set_mic_access(uuid, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_set_mic_access(uuid, uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_is_mic_blocked(_room uuid, _user uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_room_staff(_room, auth.uid()) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.room_mic_bans
    WHERE room_id = _room AND user_id = _user
  );
END;
$$;
REVOKE ALL ON FUNCTION public.staff_is_mic_blocked(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_is_mic_blocked(uuid, uuid) TO authenticated;

-- Preserve exact-seat selection: never silently move a user to another free mic.
-- Keep the transaction lock so rapid taps cannot assign the same user twice.
CREATE OR REPLACE FUNCTION public.take_seat(_room uuid, _seat integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth, extensions, pg_temp
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_locked boolean;
  v_current_user_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.room_members
    WHERE room_id = _room AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'join room first';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.room_mic_bans
    WHERE room_id = _room AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'microphone access blocked';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(_room::text || ':' || v_uid::text, 0)
  );

  SELECT rs.is_locked, rs.user_id
    INTO v_locked, v_current_user_id
  FROM public.room_seats rs
  WHERE rs.room_id = _room AND rs.seat_index = _seat
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'seat not found'; END IF;
  IF v_locked THEN RAISE EXCEPTION 'seat locked'; END IF;
  IF v_current_user_id IS NOT NULL AND v_current_user_id <> v_uid THEN
    RAISE EXCEPTION 'seat occupied';
  END IF;

  UPDATE public.room_seats
    SET user_id = NULL, is_muted = false, updated_at = now()
    WHERE room_id = _room AND user_id = v_uid;

  UPDATE public.room_seats
    SET user_id = v_uid, is_muted = false, updated_at = now()
    WHERE room_id = _room AND seat_index = _seat;
END;
$$;
REVOKE ALL ON FUNCTION public.take_seat(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.take_seat(uuid, integer) TO authenticated;
