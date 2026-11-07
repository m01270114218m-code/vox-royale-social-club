CREATE OR REPLACE FUNCTION public.staff_kick_user(_room uuid, _user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_owner uuid;
  v_target_vip integer;
BEGIN
  IF v_actor IS NULL OR NOT public.is_room_staff(_room, v_actor) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  SELECT owner_id INTO v_owner FROM public.rooms WHERE id = _room;
  IF NOT FOUND THEN RAISE EXCEPTION 'room not found'; END IF;
  IF _user = v_owner OR _user = v_actor THEN RAISE EXCEPTION 'cannot kick this user'; END IF;
  SELECT coalesce(vip_level, 0) INTO v_target_vip FROM public.profiles WHERE id = _user;
  IF v_actor <> v_owner AND public.vip_has_moderation_protection(v_target_vip) THEN
    RAISE EXCEPTION 'vip_protected';
  END IF;
  DELETE FROM public.room_seats WHERE room_id = _room AND user_id = _user;
  DELETE FROM public.room_members WHERE room_id = _room AND user_id = _user;
  UPDATE public.rooms SET member_count = (SELECT count(*) FROM public.room_members WHERE room_id = _room) WHERE id = _room;
END;
$$;
REVOKE ALL ON FUNCTION public.staff_kick_user(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_kick_user(uuid, uuid) TO authenticated;