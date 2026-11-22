-- Public stories (opt-in, moderated) and the two read-only lookups the AI assistant may use.
-- Private reports are never exposed: the AI function can only call these functions.

-- pattern consent is also implied by choosing public sharing
do $$ declare c text; begin
  select conname into c from pg_constraint where conrelid='public.reports'::regclass and pg_get_constraintdef(oid) like '%pattern_consent%';
  if c is not null then execute format('alter table public.reports drop constraint %I', c); end if;
end $$;
alter table public.reports add constraint reports_consent_visibility_chk
  check ((not pattern_consent) or visibility in ('pattern_after_review','public_after_review'));

create type public.story_status as enum ('pending','approved','rejected','withdrawn');

create table public.public_stories (
  report_id uuid primary key references public.reports(id) on delete cascade,
  story_text text not null check (char_length(story_text) between 10 and 5000),  -- moderator rewrites this; draft starts as the author's text and is never shown while pending
  status public.story_status not null default 'pending',
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.public_stories enable row level security;
-- no policies: nobody reads or writes through the API. Moderators use the Supabase dashboard (postgres role).

-- 1) create the pending story when a report asks to be shared
create function public.create_pending_story() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.visibility = 'public_after_review' then
    insert into public.public_stories (report_id, story_text) values (new.id, new.description) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger reports_create_pending_story after insert on public.reports
  for each row execute function public.create_pending_story();

-- 2) submit_report must accept the new visibility (consent is implied)
create or replace function public.submit_report(_category public.report_category, _treatment public.treatment_type, _description text, _district_code text, _university_id uuid, _workplace_category public.workplace_category, _housing_category public.housing_category, _date_from date, _date_to date, _resolution public.resolution_status, _help_sought public.help_sought, _visibility public.visibility_pref, _pattern_consent boolean, _language public.ui_language, _user_id uuid, _secret_hash text)
returns text language plpgsql security definer set search_path = '' as $function$
declare
  v_id uuid; v_code text;
  v_desc text := btrim(coalesce(_description, ''));
  v_vis public.visibility_pref := coalesce(_visibility, 'private');
  v_consent boolean := coalesce(_pattern_consent, false) or v_vis = 'public_after_review';
  i int;
begin
  if _user_id is null and (_secret_hash is null or _secret_hash !~ '^[0-9a-f]{64}$') then
    raise exception 'invalid_request' using errcode = '22023'; end if;
  if char_length(v_desc) < 10 or char_length(v_desc) > 5000 then
    raise exception 'invalid_request' using errcode = '22023'; end if;
  if _date_from is null or _date_to is null or _date_from > _date_to
     or _date_from < date '2000-01-01' or _date_to > current_date + 1 then
    raise exception 'invalid_request' using errcode = '22023'; end if;
  if v_consent and v_vis not in ('pattern_after_review','public_after_review') then
    raise exception 'invalid_request' using errcode = '22023'; end if;
  if not exists (select 1 from public.districts where code = _district_code) then
    raise exception 'invalid_request' using errcode = '22023'; end if;
  if _university_id is not null and not exists (select 1 from public.universities where id = _university_id) then
    raise exception 'invalid_request' using errcode = '22023'; end if;

  for i in 1..5 loop
    begin
      insert into public.reports (category, treatment_type, description, district_code,
        university_id, workplace_category, housing_category, incident_date_from, incident_date_to,
        resolution, help_sought, visibility, pattern_consent, submitted_language)
      values (_category, _treatment, v_desc, _district_code, _university_id,
        _workplace_category, _housing_category, _date_from, _date_to,
        coalesce(_resolution, 'unresolved'), coalesce(_help_sought, 'none'), v_vis, v_consent, coalesce(_language, 'en'))
      returning id, case_code into v_id, v_code;
      exit;
    exception when unique_violation then
      if i = 5 then raise; end if;
    end;
  end loop;

  insert into public.report_access (report_id, user_id, secret_hash) values (v_id, _user_id, _secret_hash);
  return v_code;
end $function$;

-- 3) approved story by id (public page). Returns only moderator-approved text, province-level area, month.
create function public.get_public_story(_id uuid)
returns table (id uuid, category public.report_category, province_code text, story_text text, approved_month date)
language sql stable security definer set search_path = '' as $$
  select s.report_id, r.category, d.province_code, s.story_text, date_trunc('month', coalesce(s.reviewed_at, s.created_at))::date
  from public.public_stories s
  join public.reports r on r.id = s.report_id
  join public.districts d on d.code = r.district_code
  where s.report_id = _id and s.status = 'approved';
$$;

-- 4) AI: search approved stories only
create function public.ai_search_stories(_category public.report_category default null, _province text default null, _limit int default 3)
returns table (id uuid, category public.report_category, province_code text, story_text text)
language sql stable security definer set search_path = '' as $$
  select s.report_id, r.category, d.province_code, left(s.story_text, 600)
  from public.public_stories s
  join public.reports r on r.id = s.report_id
  join public.districts d on d.code = r.district_code
  where s.status = 'approved'
    and (_category is null or r.category = _category)
    and (_province is null or d.province_code = _province)
  order by coalesce(s.reviewed_at, s.created_at) desc
  limit least(greatest(coalesce(_limit, 3), 1), 5);
$$;

-- 5) AI: privacy-safe totals. Only reviewed, consented reports; a group is returned only when it has >= 5.
create function public.ai_pattern_totals(_category public.report_category default null, _province text default null)
returns table (province_code text, category public.report_category, total int, last_6m int, prev_6m int)
language sql stable security definer set search_path = '' as $$
  select d.province_code, r.category, count(*)::int,
         count(*) filter (where r.created_at >= now() - interval '6 months')::int,
         count(*) filter (where r.created_at < now() - interval '6 months' and r.created_at >= now() - interval '12 months')::int
  from public.reports r
  join public.districts d on d.code = r.district_code
  where r.pattern_consent and r.status in ('included_in_pattern','corroborated')
    and (_category is null or r.category = _category)
    and (_province is null or d.province_code = _province)
  group by d.province_code, r.category
  having count(*) >= 5
  order by 3 desc
  limit 20;
$$;

revoke all on table public.public_stories from public, anon, authenticated, service_role;
revoke all on function public.create_pending_story(), public.get_public_story(uuid), public.ai_search_stories(public.report_category, text, int), public.ai_pattern_totals(public.report_category, text) from public, anon, authenticated, service_role;
grant execute on function public.submit_report(public.report_category, public.treatment_type, text, text, uuid, public.workplace_category, public.housing_category, date, date, public.resolution_status, public.help_sought, public.visibility_pref, boolean, public.ui_language, uuid, text) to service_role;
grant execute on function public.get_public_story(uuid) to anon, authenticated;
grant execute on function public.ai_search_stories(public.report_category, text, int), public.ai_pattern_totals(public.report_category, text) to service_role;
