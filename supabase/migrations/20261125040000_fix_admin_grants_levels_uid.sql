-- Fix admin grant and level/VIP actions without changing existing user data.
do $$
declare
  v text;
begin
  v := pg_get_functiondef('public.app_action(text,jsonb)'::regprocedure);
  v := replace(
    v,
    'where public_id::text=payload->>''uid'' or special_id=payload->>''uid''',
    'where uid::text=payload->>''uid'' or public_id::text=payload->>''uid'' or special_id=payload->>''uid'''
  );
  v := replace(
    v,
    'where public_id::text=payload->>''uid''',
    'where uid::text=payload->>''uid'' or public_id::text=payload->>''uid'''
  );
  v := replace(
    v,
    'else raise exception ''عملية غير معروفة''; end if;',
    'elsif admin and action=''levels'' then
      target=(select id from public.profiles where uid::text=payload->>''uid'' or public_id::text=payload->>''uid'');
      if target is null then raise exception ''المستخدم غير موجود''; end if;
      if coalesce((payload->>''level'')::integer,1) not between 1 and 100 then raise exception ''المستوى يجب أن يكون من 1 إلى 100''; end if;
      if coalesce((payload->>''vip'')::integer,0) not between 0 and 12 then raise exception ''قيمة VIP غير صحيحة''; end if;
      if coalesce((payload->>''days'')::integer,0)<0 then raise exception ''مدة VIP غير صحيحة''; end if;
      update public.profiles
      set level=coalesce((payload->>''level'')::integer,level),
          vip=coalesce((payload->>''vip'')::integer,0),
          vip_until=case
            when coalesce((payload->>''vip'')::integer,0)=0 then null
            when coalesce((payload->>''days'')::integer,0)>0 then now()+make_interval(days=>(payload->>''days'')::integer)
            else null
          end
      where id=target;
    else raise exception ''عملية غير معروفة''; end if;'
  );
  if v not like '%action=''levels''%' then
    raise exception 'Could not add levels action to app_action';
  end if;
  if v not like '%uid::text=payload->>''uid''%' then
    raise exception 'Could not add UID fallback to app_action';
  end if;
  execute v;
end $$;
