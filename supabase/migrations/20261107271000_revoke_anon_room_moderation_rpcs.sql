-- Room RPCs are intended for authenticated app users only.
-- PUBLIC and anon are explicitly revoked because existing default privileges may grant anon.
revoke all on function public.join_room(uuid) from public, anon;
revoke all on function public.send_room_message(uuid,text) from public, anon;
revoke all on function public.staff_is_chat_muted(uuid,uuid) from public, anon;
revoke all on function public.staff_set_chat_mute(uuid,uuid,boolean) from public, anon;
revoke all on function public.staff_kick_room_user(uuid,uuid) from public, anon;
revoke all on function public.staff_kick_user_24h(uuid,uuid) from public, anon;
revoke all on function public.staff_set_room_moderator(uuid,uuid,boolean) from public, anon;
revoke all on function public.staff_invite_to_mic(uuid,uuid) from public, anon;
revoke all on function public.ban_user(uuid,uuid) from public, anon;

grant execute on function public.join_room(uuid) to authenticated;
grant execute on function public.send_room_message(uuid,text) to authenticated;
grant execute on function public.staff_is_chat_muted(uuid,uuid) to authenticated;
grant execute on function public.staff_set_chat_mute(uuid,uuid,boolean) to authenticated;
grant execute on function public.staff_kick_room_user(uuid,uuid) to authenticated;
grant execute on function public.staff_kick_user_24h(uuid,uuid) to authenticated;
grant execute on function public.staff_set_room_moderator(uuid,uuid,boolean) to authenticated;
grant execute on function public.staff_invite_to_mic(uuid,uuid) to authenticated;
grant execute on function public.ban_user(uuid,uuid) to authenticated;
