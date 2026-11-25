-- Admins can permanently delete any comment (replies under it are deleted too). Authors can already delete their own.
create function public.is_site_admin()
returns boolean language sql stable security definer set search_path = '' as $$ select public.has_role('admin') $$;

create function public.admin_delete_comment(_comment uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not public.has_role('admin') then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.story_comments where id = _comment;
  get diagnostics n = row_count;
  return n > 0;
end $$;

revoke all on function public.is_site_admin(), public.admin_delete_comment(uuid) from public, anon, authenticated, service_role;
grant execute on function public.is_site_admin(), public.admin_delete_comment(uuid) to authenticated;
