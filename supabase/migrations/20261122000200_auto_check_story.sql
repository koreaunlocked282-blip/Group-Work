-- Public version of a story is checked automatically (phone numbers, people's names, business details).
-- Clean text is published at once; anything else is held for the moderator. Authors can withdraw their story.

drop trigger if exists reports_create_pending_story on public.reports;
drop function if exists public.create_pending_story();

alter table public.public_stories add column if not exists auto_published boolean not null default false;
alter table public.public_stories add column if not exists check_notes text;  -- reasons from the automatic check, for the moderator

drop function if exists public.submit_report(public.report_category, public.treatment_type, text, text, uuid, public.workplace_category, public.housing_category, date, date, public.resolution_status, public.help_sought, public.visibility_pref, boolean, public.ui_language, uuid, text);

create function public.submit_report(_category public.report_category, _treatment public.treatment_type, _description text, _district_code text, _university_id uuid, _workplace_category public.workplace_category, _housing_category public.housing_category, _date_from date, _date_to date, _resolution public.resolution_status, _help_sought public.help_sought, _visibility public.visibility_pref, _pattern_consent boolean, _language public.ui_language, _user_id uuid, _secret_hash text, _public_text text default null, _public_auto boolean default false, _check_notes text default null)
returns text language plpgsql security definer set search_path = '' as $function$
declare
  v_id uuid; v_code text;
  v_desc text := btrim(coalesce(_description, ''));
  v_pub text := btrim(coalesce(_public_text, ''));
  v_vis public.visibility_pref := coalesce(_visibility, 'private');
  v_consent boolean := coalesce(_pattern_consent, false) or v_vis = 'public_after_review';
  i int;
begin
  if _user_id is null and (_secret_hash is null or _secret_hash !~ '^[0-9a-f]{64}$') then
    raise exception 'invalid_request' using errcode = '22023'; end if;
  if char_length(v_desc) < 10 or char_length(v_desc) > 5000 then
    raise exception 'invalid_request' using errcode = '22023'; end if;
  if v_vis = 'public_after_review' and (char_length(v_pub) < 10 or char_length(v_pub) > 5000) then
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

  if v_vis = 'public_after_review' then
    insert into public.public_stories (report_id, story_text, status, reviewed_at, auto_published, check_notes)
    values (v_id, v_pub, case when coalesce(_public_auto, false) then 'approved'::public.story_status else 'pending'::public.story_status end,
            case when coalesce(_public_auto, false) then now() end, coalesce(_public_auto, false), left(_check_notes, 1000));
  end if;
  return v_code;
end $function$;

-- tracking now also says whether a public story exists and its state
create or replace function public.get_case_for_tracking(_case_code text, _secret_hash text)
returns jsonb language sql stable security definer set search_path = '' as $function$
  select jsonb_build_object(
    'case_code', r.case_code, 'status', r.status, 'verification_status', r.verification_status,
    'submitted_at', r.created_at, 'updated_at', r.updated_at,
    'story_status', (select s.status from public.public_stories s where s.report_id = r.id),
    'history', coalesce((select jsonb_agg(jsonb_build_object('status', h.to_status, 'note', h.user_visible_note, 'at', h.created_at)
                         order by h.created_at, h.id)
                         from public.report_status_history h where h.report_id = r.id), '[]'::jsonb))
  from public.reports r join public.report_access a on a.report_id = r.id
  where r.case_code = _case_code and a.secret_hash is not null and a.secret_hash = _secret_hash
$function$;

-- take-down: by case code + tracking secret, or by the signed-in owner. Takes effect immediately.
create function public.withdraw_story(_case_code text, _secret_hash text default null, _user_id uuid default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update public.public_stories s set status = 'withdrawn'
  from public.reports r join public.report_access a on a.report_id = r.id
  where s.report_id = r.id and r.case_code = _case_code and s.status in ('pending','approved')
    and ((_secret_hash is not null and a.secret_hash = _secret_hash) or (_user_id is not null and a.user_id = _user_id));
  get diagnostics n = row_count;
  return n > 0;
end $$;

revoke all on function public.submit_report(public.report_category, public.treatment_type, text, text, uuid, public.workplace_category, public.housing_category, date, date, public.resolution_status, public.help_sought, public.visibility_pref, boolean, public.ui_language, uuid, text, text, boolean, text) from public, anon, authenticated, service_role;
grant execute on function public.submit_report(public.report_category, public.treatment_type, text, text, uuid, public.workplace_category, public.housing_category, date, date, public.resolution_status, public.help_sought, public.visibility_pref, boolean, public.ui_language, uuid, text, text, boolean, text) to service_role;
revoke all on function public.withdraw_story(text, text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.withdraw_story(text, text, uuid) to service_role;
revoke all on function public.get_case_for_tracking(text, text) from public, anon, authenticated, service_role;
grant execute on function public.get_case_for_tracking(text, text) to service_role;
