update public.rooms r set room_no=p.display_no from public.profiles p where p.id=r.owner_id and p.display_no is not null;
