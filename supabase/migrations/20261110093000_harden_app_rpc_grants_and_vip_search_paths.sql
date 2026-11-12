alter function public.vip_perk_color(integer) set search_path = public, pg_temp;
alter function public.vip_bubble_color(integer) set search_path = public, pg_temp;
alter function public.vip_has_moderation_protection(integer) set search_path = public, pg_temp;

revoke execute on function public.apply_vip_perks() from public, anon;
revoke execute on function public.buy_item(uuid) from public, anon;
revoke execute on function public.create_room(text, text, text, text, boolean, integer) from public, anon;
revoke execute on function public.credit_gift_receiver_diamonds() from public, anon;
revoke execute on function public.recalculate_support_level(uuid) from public, anon;
revoke execute on function public.send_asset_direct(uuid, text, text, text) from public, anon;
revoke execute on function public.send_asset_to_user(uuid, text, text, text) from public, anon;
revoke execute on function public.send_lucky_gift(uuid, uuid, uuid, integer) from public, anon;
revoke execute on function public.take_any_seat(uuid) from public, anon;
revoke execute on function public.update_room_mic_mode(uuid, text) from public, anon;

grant execute on function public.apply_vip_perks() to authenticated;
grant execute on function public.buy_item(uuid) to authenticated;
grant execute on function public.create_room(text, text, text, text, boolean, integer) to authenticated;
grant execute on function public.credit_gift_receiver_diamonds() to authenticated;
grant execute on function public.recalculate_support_level(uuid) to authenticated;
grant execute on function public.send_asset_direct(uuid, text, text, text) to authenticated;
grant execute on function public.send_asset_to_user(uuid, text, text, text) to authenticated;
grant execute on function public.send_lucky_gift(uuid, uuid, uuid, integer) to authenticated;
grant execute on function public.take_any_seat(uuid) to authenticated;
grant execute on function public.update_room_mic_mode(uuid, text) to authenticated;
