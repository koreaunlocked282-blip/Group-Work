-- Moderation: moderators and admins review public stories and evidence files from the website.
-- Roles live in public.user_roles (moderator | admin). Only security-definer functions below can touch the queues,
-- and each one checks the caller's role itself. Normal users and anonymous visitors get an error.

alter table public.public_stories add column if not exists reviewed_by uuid;

create function public.is_moderator()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles
                 where user_id = (select auth.uid()) and role in ('moderator','admin'))
$$;

-- stories by status: pending (held by the automatic check), approved (published), rejected
create function public.mod_story_queue(_status public.story_status, _limit integer default 20, _offset integer default 0)
returns table (report_id uuid, story_text text, status public.story_status, auto_published boolean, check_notes text,
               category public.report_category, province_code text, created_at timestamptz, reviewed_at timestamptz,
               confirm_count integer, files integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_moderator() then raise exception 'not authorized' using errcode = '42501'; end if;
  return query
    select s.report_id, s.story_text, s.status, s.auto_published, s.check_notes, r.category, d.province_code,
           s.created_at, s.reviewed_at,
           s.confirm_count,
           (select count(*)::int from public.report_files f where f.report_id = s.report_id and f.public_status = 'pending')
    from public.public_stories s
    join public.reports r on r.id = s.report_id
    left join public.districts d on d.code = r.district_code
    where s.status = _status
    order by s.created_at desc
    limit least(greatest(_limit, 1), 50) offset greatest(_offset, 0);
end $$;

-- approve (optionally with an edited text), reject, or take down a published story
create function public.mod_review_story(_report_id uuid, _action text, _text text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare t text := btrim(coalesce(_text, ''));
begin
  if not public.is_moderator() then raise exception 'not authorized' using errcode = '42501'; end if;
  if _action not in ('approve','reject') then raise exception 'invalid_request' using errcode = '22023'; end if;
  if _action = 'approve' then
    if t <> '' and char_length(t) not between 10 and 5000 then raise exception 'invalid_request' using errcode = '22023'; end if;
    update public.public_stories
       set status = 'approved', reviewed_at = now(), reviewed_by = (select auth.uid()),
           story_text = case when t <> '' then t else story_text end
     where report_id = _report_id and status in ('pending','rejected','approved');
  else
    update public.public_stories
       set status = 'rejected', reviewed_at = now(), reviewed_by = (select auth.uid())
     where report_id = _report_id and status in ('pending','approved');
  end if;
  return found;
end $$;

-- evidence files that authors offered for their public story and that wait for a decision
create function public.mod_file_queue(_limit integer default 20)
returns table (id uuid, report_id uuid, kind text, mime text, bytes integer, storage_path text, story_status public.story_status, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_moderator() then raise exception 'not authorized' using errcode = '42501'; end if;
  return query
    select f.id, f.report_id, f.kind, f.mime, f.bytes, f.storage_path, s.status, f.created_at
    from public.report_files f left join public.public_stories s on s.report_id = f.report_id
    where f.public_status = 'pending'
    order by f.created_at
    limit least(greatest(_limit, 1), 50);
end $$;

create function public.mod_review_file(_id uuid, _action text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_moderator() then raise exception 'not authorized' using errcode = '42501'; end if;
  if _action not in ('approve','reject') then raise exception 'invalid_request' using errcode = '22023'; end if;
  update public.report_files set public_status = case when _action = 'approve' then 'approved' else 'rejected' end
   where id = _id and offer_public;
  return found;
end $$;

revoke all on function public.is_moderator(), public.mod_story_queue(public.story_status, integer, integer),
  public.mod_review_story(uuid, text, text), public.mod_file_queue(integer), public.mod_review_file(uuid, text) from public, anon;
grant execute on function public.is_moderator(), public.mod_story_queue(public.story_status, integer, integer),
  public.mod_review_story(uuid, text, text), public.mod_file_queue(integer), public.mod_review_file(uuid, text) to authenticated;
