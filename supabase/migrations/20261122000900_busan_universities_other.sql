-- All 16 Busan districts, the universities of Busan, and a free-text "Other university" on reports.
insert into public.districts (code, province_code, name_en, name_ko, is_prototype_seed) values
 ('busan-gangseo-gu','busan','Gangseo-gu','강서구',true),('busan-gijang-gun','busan','Gijang-gun','기장군',true),
 ('busan-dong-gu','busan','Dong-gu','동구',true),('busan-dongnae-gu','busan','Dongnae-gu','동래구',true),
 ('busan-saha-gu','busan','Saha-gu','사하구',true),('busan-sasang-gu','busan','Sasang-gu','사상구',true),
 ('busan-seo-gu','busan','Seo-gu','서구',true),('busan-suyeong-gu','busan','Suyeong-gu','수영구',true),
 ('busan-yeongdo-gu','busan','Yeongdo-gu','영도구',true),('busan-yeonje-gu','busan','Yeonje-gu','연제구',true),
 ('busan-jung-gu','busan','Jung-gu','중구',true),('busan-buk-gu','busan','Buk-gu','북구',true)
on conflict (code) do nothing;

update public.universities set name_ko='부산대학교' where name_en='Pusan National University' and name_ko is null;
insert into public.universities (name_en, name_ko, district_code, is_prototype_seed)
select v.n, v.k, v.d, true from (values
 ('Pukyong National University','부경대학교','busan-nam-gu'),
 ('Korea Maritime & Ocean University','한국해양대학교','busan-yeongdo-gu'),
 ('Dong-A University','동아대학교','busan-saha-gu'),
 ('Dong-Eui University','동의대학교','busan-busanjin-gu'),
 ('Dongseo University','동서대학교','busan-sasang-gu'),
 ('Silla University','신라대학교','busan-sasang-gu'),
 ('Kyungsung University','경성대학교','busan-nam-gu'),
 ('Tongmyong University','동명대학교','busan-nam-gu'),
 ('Busan University of Foreign Studies','부산외국어대학교','busan-geumjeong-gu'),
 ('Kosin University','고신대학교','busan-yeongdo-gu'),
 ('Catholic University of Pusan','부산가톨릭대학교','busan-geumjeong-gu'),
 ('Busan National University of Education','부산교육대학교','busan-yeonje-gu'),
 ('Busan Women''s University','부산여자대학교','busan-busanjin-gu'),
 ('Youngsan University (Busan campus)','영산대학교 (부산캠퍼스)','busan-haeundae-gu')
) v(n,k,d)
where not exists (select 1 from public.universities u where u.name_en = v.n);

alter table public.reports add column if not exists university_other text check (university_other is null or char_length(university_other) between 2 and 100);

drop function if exists public.submit_report(public.report_category, public.treatment_type, text, text, uuid, public.workplace_category, public.housing_category, date, date, public.resolution_status, public.help_sought, public.visibility_pref, boolean, public.ui_language, uuid, text, text, boolean, text);
create function public.submit_report(_category public.report_category, _treatment public.treatment_type, _description text, _district_code text, _university_id uuid, _workplace_category public.workplace_category, _housing_category public.housing_category, _date_from date, _date_to date, _resolution public.resolution_status, _help_sought public.help_sought, _visibility public.visibility_pref, _pattern_consent boolean, _language public.ui_language, _user_id uuid, _secret_hash text, _public_text text default null, _public_auto boolean default false, _check_notes text default null, _university_other text default null)
returns text language plpgsql security definer set search_path = '' as $function$
declare
  v_id uuid; v_code text;
  v_desc text := btrim(coalesce(_description, ''));
  v_pub text := btrim(coalesce(_public_text, ''));
  v_vis public.visibility_pref := coalesce(_visibility, 'private');
  v_consent boolean := coalesce(_pattern_consent, false) or v_vis = 'public_after_review';
  v_uo text := nullif(btrim(coalesce(_university_other, '')), '');
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
  if v_uo is not null and (char_length(v_uo) < 2 or char_length(v_uo) > 100 or _university_id is not null) then
    raise exception 'invalid_request' using errcode = '22023'; end if;

  for i in 1..5 loop
    begin
      insert into public.reports (category, treatment_type, description, district_code,
        university_id, university_other, workplace_category, housing_category, incident_date_from, incident_date_to,
        resolution, help_sought, visibility, pattern_consent, submitted_language)
      values (_category, _treatment, v_desc, _district_code, _university_id, v_uo,
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
revoke all on function public.submit_report(public.report_category, public.treatment_type, text, text, uuid, public.workplace_category, public.housing_category, date, date, public.resolution_status, public.help_sought, public.visibility_pref, boolean, public.ui_language, uuid, text, text, boolean, text, text) from public, anon, authenticated;
grant execute on function public.submit_report(public.report_category, public.treatment_type, text, text, uuid, public.workplace_category, public.housing_category, date, date, public.resolution_status, public.help_sought, public.visibility_pref, boolean, public.ui_language, uuid, text, text, boolean, text, text) to service_role;
