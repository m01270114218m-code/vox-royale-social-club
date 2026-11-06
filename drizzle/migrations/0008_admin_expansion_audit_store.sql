-- Audit log for admin actions
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT DEFAULT '',
  target_id TEXT DEFAULT '',
  details TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read audit log" ON public.audit_log FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- Internal audit writer
CREATE OR REPLACE FUNCTION public.write_audit(_action TEXT, _target_type TEXT DEFAULT '', _target_id TEXT DEFAULT '', _details TEXT DEFAULT '')
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_log (admin_id, action, target_type, target_id, details)
  VALUES (auth.uid(), _action, _target_type, _target_id, _details);
END;
$$;
REVOKE ALL ON FUNCTION public.write_audit(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;

-- Admin: list wallet transactions
CREATE OR REPLACE FUNCTION public.admin_list_wallet_tx(_limit INTEGER DEFAULT 100)
RETURNS TABLE(user_id UUID, display_name TEXT, amount BIGINT, kind TEXT, note TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
    SELECT t.user_id, p.display_name, t.amount, t.kind, t.note, t.created_at
    FROM public.wallet_transactions t
    LEFT JOIN public.profiles p ON p.id = t.user_id
    ORDER BY t.created_at DESC LIMIT LEAST(_limit, 500);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_wallet_tx(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_wallet_tx(INTEGER) TO authenticated;

-- Admin: list gift transactions
CREATE OR REPLACE FUNCTION public.admin_list_gift_tx(_limit INTEGER DEFAULT 100)
RETURNS TABLE(sender_id UUID, sender_name TEXT, receiver_id UUID, receiver_name TEXT, gift_name TEXT, cost INTEGER, created_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
    SELECT g.sender_id, sp.display_name, g.receiver_id, rp.display_name, g.gift_name, g.cost, g.created_at
    FROM public.gift_transactions g
    LEFT JOIN public.profiles sp ON sp.id = g.sender_id
    LEFT JOIN public.profiles rp ON rp.id = g.receiver_id
    ORDER BY g.created_at DESC LIMIT LEAST(_limit, 500);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_gift_tx(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_gift_tx(INTEGER) TO authenticated;

-- Admin: create or update a store item
CREATE OR REPLACE FUNCTION public.admin_save_store_item(_id UUID, _kind TEXT, _name TEXT, _description TEXT, _price INTEGER, _asset_key TEXT, _sort_order INTEGER)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _new_id UUID;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _id IS NULL THEN
    INSERT INTO public.store_items (kind, name, description, price, asset_key, sort_order)
    VALUES (_kind, _name, _description, _price, _asset_key, _sort_order) RETURNING id INTO _new_id;
    PERFORM public.write_audit('store_item_create', 'store_item', _new_id::TEXT, _name);
    RETURN _new_id;
  END IF;
  UPDATE public.store_items SET kind = _kind, name = _name, description = _description, price = _price, asset_key = _asset_key, sort_order = _sort_order WHERE id = _id;
  PERFORM public.write_audit('store_item_update', 'store_item', _id::TEXT, _name);
  RETURN _id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_save_store_item(UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_save_store_item(UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER) TO authenticated;

-- Admin: delete a store item
CREATE OR REPLACE FUNCTION public.admin_delete_store_item(_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  DELETE FROM public.store_items WHERE id = _id;
  PERFORM public.write_audit('store_item_delete', 'store_item', _id::TEXT, '');
END;
$$;
REVOKE ALL ON FUNCTION public.admin_delete_store_item(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_store_item(UUID) TO authenticated;

-- Admin: broadcast a notification to all users
CREATE OR REPLACE FUNCTION public.admin_broadcast(_title TEXT, _body TEXT)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _count INTEGER;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.notifications (user_id, type, title, body)
    SELECT id, 'broadcast', _title, _body FROM public.profiles;
  GET DIAGNOSTICS _count = ROW_COUNT;
  PERFORM public.write_audit('broadcast', 'notification', '', _title);
  RETURN _count;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_broadcast(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_broadcast(TEXT, TEXT) TO authenticated;

-- Admin: read audit log
CREATE OR REPLACE FUNCTION public.admin_list_audit(_limit INTEGER DEFAULT 100)
RETURNS TABLE(id UUID, admin_id UUID, admin_name TEXT, action TEXT, target_type TEXT, target_id TEXT, details TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
    SELECT a.id, a.admin_id, p.display_name, a.action, a.target_type, a.target_id, a.details, a.created_at
    FROM public.audit_log a
    LEFT JOIN public.profiles p ON p.id = a.admin_id
    ORDER BY a.created_at DESC LIMIT LEAST(_limit, 500);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_audit(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_audit(INTEGER) TO authenticated;

-- Wire audit logging into existing admin actions
CREATE OR REPLACE FUNCTION public.admin_grant_coins(_user UUID, _amount BIGINT)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _balance BIGINT;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.wallets (user_id, coins) VALUES (_user, _amount)
  ON CONFLICT (user_id) DO UPDATE SET coins = public.wallets.coins + _amount
  RETURNING coins INTO _balance;
  INSERT INTO public.wallet_transactions (user_id, amount, kind, note) VALUES (_user, _amount, 'admin', 'تعديل إداري');
  PERFORM public.write_audit('grant_coins', 'user', _user::TEXT, _amount::TEXT);
  RETURN _balance;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_grant_coins(UUID, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_grant_coins(UUID, BIGINT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_vip(_user UUID, _vip INTEGER)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.profiles SET vip_level = _vip WHERE id = _user;
  PERFORM public.write_audit('set_vip', 'user', _user::TEXT, _vip::TEXT);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_vip(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_vip(UUID, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_room(_room UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  DELETE FROM public.rooms WHERE id = _room;
  PERFORM public.write_audit('delete_room', 'room', _room::TEXT, '');
END;
$$;
REVOKE ALL ON FUNCTION public.admin_delete_room(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_room(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_post(_post UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  DELETE FROM public.posts WHERE id = _post;
  PERFORM public.write_audit('delete_post', 'post', _post::TEXT, '');
END;
$$;
REVOKE ALL ON FUNCTION public.admin_delete_post(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_post(UUID) TO authenticated;