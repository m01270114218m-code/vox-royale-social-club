-- Fix media storage bucket and secure gift transaction writes.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='media') THEN
    INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
    VALUES ('media','media',true,5242880,ARRAY['image/jpeg','image/png','image/webp','image/gif']);
  ELSE
    UPDATE storage.buckets SET public=true,file_size_limit=5242880,
      allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp','image/gif']
    WHERE id='media';
  END IF;
END $$;

DROP POLICY IF EXISTS "Media public read" ON storage.objects;
CREATE POLICY "Media public read" ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id='media');

DROP POLICY IF EXISTS "Media user upload" ON storage.objects;
CREATE POLICY "Media user upload" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='media' AND (storage.foldername(name))[1]=(select auth.uid())::text);

DROP POLICY IF EXISTS "Media user update" ON storage.objects;
CREATE POLICY "Media user update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id='media' AND (storage.foldername(name))[1]=(select auth.uid())::text)
WITH CHECK (bucket_id='media' AND (storage.foldername(name))[1]=(select auth.uid())::text);

DROP POLICY IF EXISTS "Media user delete" ON storage.objects;
CREATE POLICY "Media user delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='media' AND (storage.foldername(name))[1]=(select auth.uid())::text);

CREATE OR REPLACE FUNCTION public.send_gift(_gift uuid,_receiver uuid,_room uuid,_qty integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth','extensions','pg_temp'
AS $function$
declare uid uuid := (select auth.uid()); cost bigint; sender_balance bigint;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if _qty is null or _qty < 1 or _qty > 100 then raise exception 'invalid quantity'; end if;
  if not exists(select 1 from public.room_members where room_id=_room and user_id=uid) then raise exception 'join room first'; end if;
  if not exists(select 1 from public.room_members where room_id=_room and user_id=_receiver) then raise exception 'receiver not in room'; end if;
  select price*_qty into cost from public.gifts where id=_gift and active=true;
  if cost is null then raise exception 'gift unavailable'; end if;
  select coins into sender_balance from public.wallets where user_id=uid for update;
  if coalesce(sender_balance,0) < cost then raise exception 'insufficient coins'; end if;
  update public.wallets set coins=coins-cost,updated_at=now() where user_id=uid;
  insert into public.gift_transactions(gift_id,receiver_id,sender_id,room_id,quantity,total_price)
  values(_gift,_receiver,uid,_room,_qty,cost);
end
$function$;

REVOKE EXECUTE ON FUNCTION public.send_gift(uuid,uuid,uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_gift(uuid,uuid,uuid,integer) TO authenticated;
