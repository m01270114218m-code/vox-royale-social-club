-- Performance indexes for hot room/admin/realtime queries.
create index if not exists idx_room_members_room_user on public.room_members(room_id,user_id);
create index if not exists idx_room_members_user_room on public.room_members(user_id,room_id);
create index if not exists idx_room_seats_room_user on public.room_seats(room_id,user_id);
create index if not exists idx_room_messages_room_created on public.room_messages(room_id,created_at desc);
create index if not exists idx_room_messages_user_created on public.room_messages(user_id,created_at desc);
create index if not exists idx_gift_transactions_room_created on public.gift_transactions(room_id,created_at desc);
create index if not exists idx_gift_transactions_gift on public.gift_transactions(gift_id);
create index if not exists idx_notifications_user_read_created on public.notifications(user_id,is_read,created_at desc);
create index if not exists idx_admin_settings_key on public.admin_settings(key);
create index if not exists idx_admin_assets_key_active on public.admin_assets(asset_key,is_active);
create index if not exists idx_conversations_user_a on public.conversations(user_a);
create index if not exists idx_conversations_user_b on public.conversations(user_b);
create index if not exists idx_messages_conversation_read on public.messages(conversation_id,read_at);
