
-- Keep direct-message writes behind a validated RPC. The caller must be a
-- participant in the target conversation and must not be blocked by the peer.
create or replace function public.send_dm(_conv uuid, _body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_peer uuid;
  v_body text := btrim(coalesce(_body, ''));
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if _conv is null or v_body = '' or length(v_body) > 1000 then
    raise exception 'invalid_message';
  end if;

  select case
    when c.user_a = v_uid then c.user_b
    when c.user_b = v_uid then c.user_a
    else null
  end
  into v_peer
  from public.conversations c
  where c.id = _conv
  for update;

  if v_peer is null then
    raise exception 'conversation_not_found_or_forbidden';
  end if;

  if exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = v_uid and b.blocked_id = v_peer)
       or (b.blocker_id = v_peer and b.blocked_id = v_uid)
  ) then
    raise exception 'messaging_blocked';
  end if;

  insert into public.messages (conversation_id, sender_id, body)
  values (_conv, v_uid, v_body);

  update public.conversations
  set last_at = now(), last_message = v_body
  where id = _conv;
end;
$$;

revoke all on function public.send_dm(uuid, text) from public, anon;
grant execute on function public.send_dm(uuid, text) to authenticated;
