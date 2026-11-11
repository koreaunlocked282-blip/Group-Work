-- Korea Unlocked: schema exported read-only from the live project on 2026-11-11.
-- Contains structure, policies, functions, triggers and grants only. No user data, no secrets.
-- Apply to an EMPTY Supabase project, in order: this file, then 20261111000100_seed_reference.sql.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------- enums ----------
create type public.app_role as enum ('user','moderator','admin','partner');
create type public.help_sought as enum ('none','university_office','employer','police','labor_or_human_rights_office','other');
create type public.housing_category as enum ('landlord','real_estate_agency','dormitory','shared_housing','rental_contract','other_housing');
create type public.report_category as enum ('university_classroom','workplace_parttime','housing_landlord','public_service_business','racism','language_discrimination','harassment_verbal','online_harassment','immigration_admin','public_transport_space','healthcare_service','other');
create type public.report_status as enum ('received','privacy_protected','under_review','needs_more_info','corroborated','included_in_pattern','not_published','support_referred');
create type public.resolution_status as enum ('unresolved','resolved','partly_resolved','ongoing');
create type public.student_status as enum ('current','incoming','recent_graduate','other');
create type public.treatment_type as enum ('discrimination','harassment','refusal_of_service','unfair_treatment','threat','other');
create type public.ui_language as enum ('en','ko');
create type public.verification_status as enum ('unverified','assessed','corroborated');
create type public.visibility_pref as enum ('private','pattern_after_review');
create type public.workplace_category as enum ('part_time_job','restaurant','factory','delivery','retail','other_workplace');

-- ---------- tables ----------
create table public.provinces (
  code text not null,
  name_en text not null,
  name_ko text,
  official_code text,
  sort_order smallint not null,
  is_prototype_seed boolean not null default false
);

create table public.districts (
  code text not null,
  province_code text not null,
  name_en text not null,
  name_ko text,
  official_code text,
  is_prototype_seed boolean not null default false
);

create table public.universities (
  id uuid not null default gen_random_uuid(),
  name_en text not null,
  name_ko text,
  district_code text not null,
  is_prototype_seed boolean not null default false
);

create table public.profiles (
  id uuid not null,
  display_language public.ui_language not null default 'en',
  student_status public.student_status,
  university_id uuid,
  district_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null,
  role public.app_role not null,
  granted_by uuid,
  granted_at timestamptz not null default now()
);

-- generate_case_code() is referenced by reports.case_code, so it is created before the table
create function public.generate_case_code()
 returns text language plpgsql set search_path to ''
as $function$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea := uuid_send(gen_random_uuid());
  s text := '';
  i int;
begin
  for i in 0..9 loop
    s := s || substr(alphabet, (get_byte(b, i) % 32) + 1, 1);
  end loop;
  return 'KX-' || substr(s, 1, 5) || '-' || substr(s, 6, 5);
end $function$;

create table public.reports (
  id uuid not null default gen_random_uuid(),
  case_code text not null default public.generate_case_code(),
  category public.report_category not null,
  treatment_type public.treatment_type not null,
  description text not null,
  district_code text not null,
  university_id uuid,
  workplace_category public.workplace_category,
  housing_category public.housing_category,
  incident_date_from date not null,
  incident_date_to date not null,
  resolution public.resolution_status not null default 'unresolved',
  help_sought public.help_sought not null default 'none',
  visibility public.visibility_pref not null default 'private',
  pattern_consent boolean not null default false,
  submitted_language public.ui_language not null default 'en',
  status public.report_status not null default 'received',
  verification_status public.verification_status not null default 'unverified',
  corroboration_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.report_access (
  report_id uuid not null,
  user_id uuid,
  secret_hash text,
  created_at timestamptz not null default now()
);

create table public.report_status_history (
  id bigint generated always as identity not null,
  report_id uuid not null,
  from_status public.report_status,
  to_status public.report_status not null,
  changed_by uuid,
  user_visible_note text,
  created_at timestamptz not null default now()
);

create table public.rate_limit_events (
  id bigint generated always as identity not null,
  bucket text not null,
  key_hash text not null,
  created_at timestamptz not null default now()
);

-- ---------- constraints ----------
alter table public.districts add constraint districts_pkey primary key (code);
alter table public.profiles add constraint profiles_pkey primary key (id);
alter table public.provinces add constraint provinces_pkey primary key (code);
alter table public.rate_limit_events add constraint rate_limit_events_pkey primary key (id);
alter table public.report_access add constraint report_access_pkey primary key (report_id);
alter table public.report_status_history add constraint report_status_history_pkey primary key (id);
alter table public.reports add constraint reports_pkey primary key (id);
alter table public.universities add constraint universities_pkey primary key (id);
alter table public.user_roles add constraint user_roles_pkey primary key (user_id, role);

alter table public.districts add constraint districts_province_code_name_en_key unique (province_code, name_en);
alter table public.provinces add constraint provinces_name_en_key unique (name_en);
alter table public.reports add constraint reports_case_code_key unique (case_code);
alter table public.universities add constraint universities_name_en_key unique (name_en);

alter table public.report_access add constraint report_access_check check (((user_id is not null) or (secret_hash is not null)));
alter table public.report_access add constraint report_access_secret_hash_check check (((secret_hash is null) or (secret_hash ~ '^[0-9a-f]{64}$'::text)));
alter table public.report_status_history add constraint report_status_history_user_visible_note_check check (((user_visible_note is null) or (char_length(user_visible_note) <= 500)));
alter table public.reports add constraint reports_check check ((incident_date_from <= incident_date_to));
alter table public.reports add constraint reports_check1 check (((not pattern_consent) or (visibility = 'pattern_after_review'::public.visibility_pref)));
alter table public.reports add constraint reports_corroboration_count_check check ((corroboration_count >= 0));
alter table public.reports add constraint reports_description_check check (((char_length(description) >= 10) and (char_length(description) <= 5000)));
alter table public.reports add constraint reports_incident_date_from_check check ((incident_date_from >= '2000-01-01'::date));

alter table public.districts add constraint districts_province_code_fkey foreign key (province_code) references public.provinces(code);
alter table public.profiles add constraint profiles_district_code_fkey foreign key (district_code) references public.districts(code) on delete set null;
alter table public.profiles add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade;
alter table public.profiles add constraint profiles_university_id_fkey foreign key (university_id) references public.universities(id) on delete set null;
alter table public.report_access add constraint report_access_report_id_fkey foreign key (report_id) references public.reports(id) on delete cascade;
alter table public.report_access add constraint report_access_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.report_status_history add constraint report_status_history_changed_by_fkey foreign key (changed_by) references auth.users(id) on delete set null;
alter table public.report_status_history add constraint report_status_history_report_id_fkey foreign key (report_id) references public.reports(id) on delete cascade;
alter table public.reports add constraint reports_district_code_fkey foreign key (district_code) references public.districts(code);
alter table public.reports add constraint reports_university_id_fkey foreign key (university_id) references public.universities(id) on delete set null;
alter table public.universities add constraint universities_district_code_fkey foreign key (district_code) references public.districts(code);
alter table public.user_roles add constraint user_roles_granted_by_fkey foreign key (granted_by) references auth.users(id) on delete set null;
alter table public.user_roles add constraint user_roles_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

-- ---------- indexes ----------
create index districts_name_trgm on public.districts using gin (name_en extensions.gin_trgm_ops);
create index districts_province_idx on public.districts using btree (province_code);
create index profiles_district_idx on public.profiles using btree (district_code);
create index profiles_university_idx on public.profiles using btree (university_id);
create index rate_limit_lookup_idx on public.rate_limit_events using btree (bucket, key_hash, created_at);
create index report_access_user_idx on public.report_access using btree (user_id) where (user_id is not null);
create index report_status_history_report_idx on public.report_status_history using btree (report_id, created_at);
create index reports_category_idx on public.reports using btree (category);
create index reports_created_idx on public.reports using btree (created_at);
create index reports_district_idx on public.reports using btree (district_code);
create index reports_pattern_idx on public.reports using btree (district_code, category, incident_date_to) where pattern_consent;
create index reports_status_idx on public.reports using btree (status);
create index reports_university_idx on public.reports using btree (university_id) where (university_id is not null);
create index reports_verification_idx on public.reports using btree (verification_status);
create index universities_district_idx on public.universities using btree (district_code);
create index universities_name_trgm on public.universities using gin (name_en extensions.gin_trgm_ops);

-- ---------- functions ----------
create function public.has_role(_role public.app_role)
 returns boolean language sql stable security definer set search_path to ''
as $function$
  select exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = _role)
$function$;

create function public.is_admin_aal2()
 returns boolean language sql stable security definer set search_path to ''
as $function$
  select public.has_role('admin') and coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
$function$;

create function public.owns_report(_report_id uuid)
 returns boolean language sql stable security definer set search_path to ''
as $function$
  select exists (select 1 from public.report_access
                 where report_id = _report_id and user_id = (select auth.uid()))
$function$;

create function public.admin_grant_role(_user_id uuid, _role public.app_role)
 returns void language plpgsql security definer set search_path to ''
as $function$
begin
  if not public.is_admin_aal2() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  insert into public.user_roles (user_id, role, granted_by)
  values (_user_id, _role, (select auth.uid()))
  on conflict (user_id, role) do nothing;
end $function$;

create function public.admin_revoke_role(_user_id uuid, _role public.app_role)
 returns void language plpgsql security definer set search_path to ''
as $function$
begin
  if not public.is_admin_aal2() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if _role = 'admin' and _user_id = (select auth.uid()) then
    raise exception 'admins cannot revoke their own admin role' using errcode = '42501';
  end if;
  delete from public.user_roles where user_id = _user_id and role = _role;
end $function$;

create function public.block_history_update()
 returns trigger language plpgsql set search_path to ''
as $function$
begin raise exception 'history is append-only' using errcode = '42501'; end $function$;

create function public.check_rate_limit(_bucket text, _key_hash text, _max integer, _window interval)
 returns boolean language plpgsql security definer set search_path to ''
as $function$
declare n integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(_bucket || ':' || _key_hash, 0));
  select count(*) into n from public.rate_limit_events
   where bucket = _bucket and key_hash = _key_hash and created_at > now() - _window;
  if n >= _max then return false; end if;
  insert into public.rate_limit_events (bucket, key_hash) values (_bucket, _key_hash);
  return true;
end $function$;

create function public.get_case_for_tracking(_case_code text, _secret_hash text)
 returns jsonb language sql stable security definer set search_path to ''
as $function$
  select jsonb_build_object(
    'case_code', r.case_code, 'status', r.status, 'verification_status', r.verification_status,
    'submitted_at', r.created_at, 'updated_at', r.updated_at,
    'history', coalesce((select jsonb_agg(jsonb_build_object('status', h.to_status, 'note', h.user_visible_note, 'at', h.created_at)
                         order by h.created_at, h.id)
                         from public.report_status_history h where h.report_id = r.id), '[]'::jsonb))
  from public.reports r join public.report_access a on a.report_id = r.id
  where r.case_code = _case_code and a.secret_hash is not null and a.secret_hash = _secret_hash
$function$;

create function public.guard_report_immutable()
 returns trigger language plpgsql set search_path to ''
as $function$
begin
  if new.id <> old.id or new.case_code <> old.case_code or new.created_at <> old.created_at then
    raise exception 'immutable fields' using errcode = '42501';
  end if;
  return new;
end $function$;

create function public.handle_new_user()
 returns trigger language plpgsql security definer set search_path to ''
as $function$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  lang public.ui_language := 'en';
  stat public.student_status := null;
begin
  if m->>'display_language' in ('en','ko') then lang := (m->>'display_language')::public.ui_language; end if;
  if m->>'student_status' in ('current','incoming','recent_graduate','other') then stat := (m->>'student_status')::public.student_status; end if;
  insert into public.profiles (id, display_language, student_status) values (new.id, lang, stat);
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  return new;
end $function$;

create function public.log_report_status()
 returns trigger language plpgsql security definer set search_path to ''
as $function$
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return null; end if;
  insert into public.report_status_history (report_id, from_status, to_status, changed_by)
  values (new.id, case when tg_op = 'UPDATE' then old.status end, new.status, (select auth.uid()));
  return null;
end $function$;

create function public.purge_rate_limit_events(_older_than interval default '2 days'::interval)
 returns integer language plpgsql security definer set search_path to ''
as $function$
declare n integer;
begin
  delete from public.rate_limit_events where created_at < now() - _older_than;
  get diagnostics n = row_count;
  return n;
end $function$;

create function public.set_updated_at()
 returns trigger language plpgsql set search_path to ''
as $function$
begin new.updated_at = now(); return new; end $function$;

create function public.submit_report(_category public.report_category, _treatment public.treatment_type, _description text, _district_code text, _university_id uuid, _workplace_category public.workplace_category, _housing_category public.housing_category, _date_from date, _date_to date, _resolution public.resolution_status, _help_sought public.help_sought, _visibility public.visibility_pref, _pattern_consent boolean, _language public.ui_language, _user_id uuid, _secret_hash text)
 returns text language plpgsql security definer set search_path to ''
as $function$
declare
  v_id uuid; v_code text;
  v_desc text := btrim(coalesce(_description, ''));
  v_consent boolean := coalesce(_pattern_consent, false);
  v_vis public.visibility_pref := coalesce(_visibility, 'private');
  i int;
begin
  if _user_id is null and (_secret_hash is null or _secret_hash !~ '^[0-9a-f]{64}$') then
    raise exception 'invalid_request' using errcode = '22023'; end if;
  if char_length(v_desc) < 10 or char_length(v_desc) > 5000 then
    raise exception 'invalid_request' using errcode = '22023'; end if;
  if _date_from is null or _date_to is null or _date_from > _date_to
     or _date_from < date '2000-01-01' or _date_to > current_date + 1 then
    raise exception 'invalid_request' using errcode = '22023'; end if;
  if v_consent and v_vis <> 'pattern_after_review' then
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

-- ---------- triggers ----------
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger report_status_history_no_update before update on public.report_status_history for each row execute function public.block_history_update();
create trigger reports_guard_immutable before update on public.reports for each row execute function public.guard_report_immutable();
create trigger reports_log_status after insert or update of status on public.reports for each row execute function public.log_report_status();
create trigger reports_set_updated_at before update on public.reports for each row execute function public.set_updated_at();

-- ---------- row level security ----------
alter table public.districts enable row level security;
alter table public.profiles enable row level security;
alter table public.provinces enable row level security;
alter table public.rate_limit_events enable row level security;
alter table public.report_access enable row level security;
alter table public.report_status_history enable row level security;
alter table public.reports enable row level security;
alter table public.universities enable row level security;
alter table public.user_roles enable row level security;

create policy "reference readable by everyone" on public.districts as permissive for select to anon, authenticated using (true);
create policy "reference readable by everyone" on public.provinces as permissive for select to anon, authenticated using (true);
create policy "reference readable by everyone" on public.universities as permissive for select to anon, authenticated using (true);
create policy "read own profile" on public.profiles as permissive for select to authenticated using ((id = (select auth.uid())));
create policy "update own profile" on public.profiles as permissive for update to authenticated using ((id = (select auth.uid()))) with check ((id = (select auth.uid())));
create policy "owner reads own report history" on public.report_status_history as permissive for select to authenticated using (public.owns_report(report_id));
create policy "owner reads own reports" on public.reports as permissive for select to authenticated using (public.owns_report(id));
create policy "admin aal2 reads all roles" on public.user_roles as permissive for select to authenticated using (public.is_admin_aal2());
create policy "read own roles" on public.user_roles as permissive for select to authenticated using ((user_id = (select auth.uid())));

-- ---------- grants (restrictive: Supabase defaults are removed, then only what the live project has) ----------
revoke all on all tables in schema public from anon, authenticated, service_role;
revoke all on all functions in schema public from public, anon, authenticated, service_role;

grant select on public.districts, public.provinces, public.universities to anon, authenticated;
grant select on public.profiles, public.reports, public.report_status_history, public.user_roles to authenticated;
grant update (display_language, student_status, university_id, district_code) on public.profiles to authenticated;
grant references, trigger, truncate on all tables in schema public to service_role;

grant execute on function public.has_role(public.app_role) to authenticated;
grant execute on function public.is_admin_aal2() to authenticated;
grant execute on function public.owns_report(uuid) to authenticated;
grant execute on function public.admin_grant_role(uuid, public.app_role) to authenticated;
grant execute on function public.admin_revoke_role(uuid, public.app_role) to authenticated;
grant execute on function public.check_rate_limit(text, text, integer, interval) to service_role;
grant execute on function public.get_case_for_tracking(text, text) to service_role;
grant execute on function public.purge_rate_limit_events(interval) to service_role;
grant execute on function public.submit_report(public.report_category, public.treatment_type, text, text, uuid, public.workplace_category, public.housing_category, date, date, public.resolution_status, public.help_sought, public.visibility_pref, boolean, public.ui_language, uuid, text) to service_role;

-- Ensure new functions/tables in public are not auto-exposed to browser roles.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
