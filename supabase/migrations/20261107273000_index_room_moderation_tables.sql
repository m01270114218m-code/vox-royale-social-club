-- Cover the new moderation table foreign keys and avoid an unused expiry-only index.
drop index if exists public.room_temporary_kicks_expiry;
create index if not exists room_temporary_kicks_user_id_idx
  on public.room_temporary_kicks(user_id);
create index if not exists room_temporary_kicks_kicked_by_idx
  on public.room_temporary_kicks(kicked_by);
create index if not exists room_chat_mutes_user_id_idx
  on public.room_chat_mutes(user_id);
create index if not exists room_chat_mutes_muted_by_idx
  on public.room_chat_mutes(muted_by);
