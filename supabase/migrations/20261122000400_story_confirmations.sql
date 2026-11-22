-- "Confirm this report": other readers can confirm an approved public story.
-- One confirmation per salted client hash per story. Counts are shown publicly; hashes never are.
alter table public.public_stories add column confirm_count integer not null default 0;

create table public.story_confirmations (
  story_id uuid not null references public.public_stories(report_id) on delete cascade,
  voter_hash text not null,
  created_at timestamptz not null default now(),
  primary key (story_id, voter_hash)
);
alter table public.story_confirmations enable row level security;
revoke all on table public.story_confirmations from public, anon, authenticated, service_role;

create function public.confirm_story(_story uuid, _voter text)
returns table (total integer, added boolean)
language plpgsql security definer set search_path = '' as $$
declare n integer; a boolean := false;
begin
  if _voter is null or length(_voter) < 32 then raise exception 'invalid' using errcode = '22023'; end if;
  if not exists (select 1 from public.public_stories where report_id = _story and status = 'approved') then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  insert into public.story_confirmations (story_id, voter_hash) values (_story, _voter) on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then
    a := true;
    update public.public_stories set confirm_count = confirm_count + 1 where report_id = _story;
  end if;
  return query select s.confirm_count, a from public.public_stories s where s.report_id = _story;
end $$;

drop function public.list_public_stories(public.report_category, text, int, int);
create function public.list_public_stories(_category public.report_category default null, _province text default null, _limit int default 12, _offset int default 0, _sort text default 'latest')
returns table (id uuid, category public.report_category, province_code text, story_text text, approved_month date, confirm_count integer)
language sql stable security definer set search_path = '' as $$
  select s.report_id, r.category, d.province_code, s.story_text, date_trunc('month', coalesce(s.reviewed_at, s.created_at))::date, s.confirm_count
  from public.public_stories s
  join public.reports r on r.id = s.report_id
  join public.districts d on d.code = r.district_code
  where s.status = 'approved'
    and (_category is null or r.category = _category)
    and (_province is null or d.province_code = _province)
  order by case when _sort = 'confirmed' then s.confirm_count end desc nulls last, coalesce(s.reviewed_at, s.created_at) desc
  limit least(greatest(coalesce(_limit, 12), 1), 30) offset greatest(coalesce(_offset, 0), 0);
$$;

drop function public.get_public_story(uuid);
create function public.get_public_story(_id uuid)
returns table (id uuid, category public.report_category, province_code text, story_text text, approved_month date, confirm_count integer)
language sql stable security definer set search_path = '' as $$
  select s.report_id, r.category, d.province_code, s.story_text, date_trunc('month', coalesce(s.reviewed_at, s.created_at))::date, s.confirm_count
  from public.public_stories s
  join public.reports r on r.id = s.report_id
  join public.districts d on d.code = r.district_code
  where s.report_id = _id and s.status = 'approved';
$$;

revoke all on function public.confirm_story(uuid, text), public.list_public_stories(public.report_category, text, int, int, text), public.get_public_story(uuid) from public, anon, authenticated, service_role;
grant execute on function public.confirm_story(uuid, text) to service_role;
grant execute on function public.list_public_stories(public.report_category, text, int, int, text), public.get_public_story(uuid) to anon, authenticated;
