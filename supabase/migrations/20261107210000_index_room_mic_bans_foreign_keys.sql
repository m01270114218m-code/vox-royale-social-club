CREATE INDEX IF NOT EXISTS idx_room_mic_bans_user_id ON public.room_mic_bans(user_id);
CREATE INDEX IF NOT EXISTS idx_room_mic_bans_blocked_by ON public.room_mic_bans(blocked_by);