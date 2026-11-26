alter table public.rooms
  add column if not exists background_url text;

create or replace function public.save_room_settings(
  p_name text,
  p_notice text,
  p_cover_url text default null,
  p_background_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  saved public.rooms;
begin
  if actor is null then raise exception 'سجّل الدخول أولاً'; end if;
  if char_length(coalesce(p_name,'')) > 60 then raise exception 'اسم الغرفة طويل جداً'; end if;
  if char_length(coalesce(p_notice,'')) > 200 then raise exception 'إعلان الغرفة طويل جداً'; end if;

  update public.rooms
  set name = coalesce(nullif(btrim(p_name),''), name),
      title = coalesce(nullif(btrim(p_name),''), title),
      notice = coalesce(p_notice,''),
      description = coalesce(p_notice,''),
      cover = coalesce(nullif(p_cover_url,''), cover),
      cover_url = coalesce(nullif(p_cover_url,''), cover_url),
      background_url = coalesce(nullif(p_background_url,''), background_url),
      updated_at = now()
  where owner_id = actor
  returning * into saved;

  if saved.id is null then raise exception 'هذه الغرفة غير موجودة أو ليست ملكك'; end if;
  return jsonb_build_object(
    'id', saved.id,
    'room_uid', saved.room_uid,
    'name', saved.name,
    'notice', saved.notice,
    'cover_url', saved.cover_url,
    'background_url', saved.background_url,
    'updated_at', saved.updated_at
  );
end;
$$;

revoke all on function public.save_room_settings(text,text,text,text) from public, anon;
grant execute on function public.save_room_settings(text,text,text,text) to authenticated;
