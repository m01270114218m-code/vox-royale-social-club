-- Fix private inbox participant visibility without recursive RLS.
create or replace function public.is_private_conversation_member(p_conversation_id uuid,p_user_id uuid)
returns boolean language sql stable security definer set search_path=public
as $$
  select exists(select 1 from public.private_conversation_members m
    where m.conversation_id=p_conversation_id and m.user_id=p_user_id);
$$;
revoke all on function public.is_private_conversation_member(uuid,uuid) from public,anon;
grant execute on function public.is_private_conversation_member(uuid,uuid) to authenticated;

drop policy if exists private_conversation_members_participant_read on public.private_conversation_members;
create policy private_conversation_members_participant_read
on public.private_conversation_members for select to authenticated
using (public.is_private_conversation_member(conversation_id,(select auth.uid())));

-- Assign stable public numeric IDs to new accounts starting at 5050.
create or replace function public.assign_profile_uid()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  if new.uid is null or new.uid < 5050 then
    new.uid := nextval('public.profiles_uid_seq');
  end if;
  return new;
end;
$$;
select setval('public.profiles_uid_seq',
  greatest(5049,coalesce((select max(uid) from public.profiles),5049)),true);
drop trigger if exists profiles_assign_uid on public.profiles;
create trigger profiles_assign_uid before insert on public.profiles
for each row execute function public.assign_profile_uid();
create unique index if not exists profiles_uid_unique on public.profiles(uid);
