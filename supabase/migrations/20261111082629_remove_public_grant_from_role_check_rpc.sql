revoke execute on function public.has_role(public.app_role, uuid) from public, anon;
grant execute on function public.has_role(public.app_role, uuid) to authenticated;
