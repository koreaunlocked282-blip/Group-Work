-- Threaded comments on approved public stories.
-- Only logged-in users can post (through the story-comments edge function). Readers see a per-story pseudonym,
-- never an account id. Comments publish immediately after the automatic name/phone check; readers can report them
-- (3 reports hide a comment) and moderators can hide or restore any comment.
create table public.story_comments (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.public_stories(report_id) on delete cascade,
  parent_id uuid references public.story_comments(id) on delete cascade,
  depth smallint not null default 0 check (depth between 0 and 3),
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 800),
  status text not null default 'visible' check (status in ('visible','hidden')),
  report_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index story_comments_story_idx on public.story_comments (story_id, created_at);
alter table public.story_comments enable row level security;
revoke all on table public.story_comments from public, anon, authenticated, service_role;

create table public.comment_reports (
  comment_id uuid not null references public.story_comments(id) on delete cascade,
  reporter_hash text not null,
  created_at timestamptz not null default now(),
  primary key (comment_id, reporter_hash)
);
alter table public.comment_reports enable row level security;
revoke all on table public.comment_reports from public, anon, authenticated, service_role;

-- Read: visible comments of an approved story. nick is stable per author per story and cannot be linked across stories.
create function public.list_story_comments(_story uuid)
returns table (id uuid, parent_id uuid, depth smallint, nick text, body text, created_at timestamptz, mine boolean, status text, report_count integer)
language sql stable security definer set search_path = '' as $$
  select c.id, c.parent_id, c.depth,
         'Student ' || upper(substr(md5(c.author_id::text || c.story_id::text), 1, 4)),
         case when c.status = 'hidden' then '' else c.body end,
         c.created_at,
         coalesce(c.author_id = (select auth.uid()), false),
         c.status,
         case when (public.has_role('moderator') or public.has_role('admin')) then c.report_count else 0 end
  from public.story_comments c
  join public.public_stories s on s.report_id = c.story_id and s.status = 'approved'
  where c.story_id = _story
    and (c.status = 'visible' or public.has_role('moderator') or public.has_role('admin'))
  order by c.created_at
  limit 300;
$$;

create function public.add_story_comment(_story uuid, _parent uuid, _author uuid, _body text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare d smallint := 0; pid uuid; nid uuid;
begin
  if not exists (select 1 from public.public_stories where report_id = _story and status = 'approved') then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if _parent is not null then
    select id, depth + 1 into pid, d from public.story_comments where id = _parent and story_id = _story and status = 'visible';
    if pid is null then raise exception 'not_found' using errcode = 'P0002'; end if;
    if d > 3 then d := 3; pid := (select parent_id from public.story_comments where id = _parent); end if;
  end if;
  insert into public.story_comments (story_id, parent_id, depth, author_id, body)
  values (_story, case when _parent is null then null else coalesce(pid, _parent) end, d, _author, _body) returning id into nid;
  return nid;
end $$;

create function public.report_story_comment(_comment uuid, _reporter text)
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer; total integer;
begin
  if _reporter is null or length(_reporter) < 32 then raise exception 'invalid' using errcode = '22023'; end if;
  if not exists (select 1 from public.story_comments where id = _comment) then raise exception 'not_found' using errcode = 'P0002'; end if;
  insert into public.comment_reports (comment_id, reporter_hash) values (_comment, _reporter) on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then
    update public.story_comments set report_count = report_count + 1,
      status = case when report_count + 1 >= 3 then 'hidden' else status end
    where id = _comment returning report_count into total;
  else
    select report_count into total from public.story_comments where id = _comment;
  end if;
  return total;
end $$;

create function public.delete_own_comment(_comment uuid, _author uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  delete from public.story_comments where id = _comment and author_id = _author;
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- Moderators and admins only (checked inside): hide or restore any comment.
create function public.mod_set_comment_status(_comment uuid, _status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (public.has_role('moderator') or public.has_role('admin')) then raise exception 'forbidden' using errcode = '42501'; end if;
  if _status not in ('visible','hidden') then raise exception 'invalid' using errcode = '22023'; end if;
  update public.story_comments set status = _status, report_count = case when _status = 'visible' then 0 else report_count end where id = _comment;
end $$;

revoke all on function public.list_story_comments(uuid), public.add_story_comment(uuid, uuid, uuid, text), public.report_story_comment(uuid, text),
  public.delete_own_comment(uuid, uuid), public.mod_set_comment_status(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.list_story_comments(uuid) to anon, authenticated;
grant execute on function public.mod_set_comment_status(uuid, text) to authenticated;
grant execute on function public.add_story_comment(uuid, uuid, uuid, text), public.report_story_comment(uuid, text), public.delete_own_comment(uuid, uuid) to service_role;
