-- Evidence files (photos and audio) attached to a report.
-- Files live in a PRIVATE storage bucket. Nobody can read them through the API: only moderators (dashboard) and,
-- for files the author offered AND a moderator approved, short-lived signed links for a published story.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidence', 'evidence', false, 10485760,
  array['image/jpeg','image/png','image/webp','audio/mpeg','audio/mp4','audio/x-m4a','audio/wav','audio/x-wav','audio/ogg','audio/webm'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
-- no policies on storage.objects for anon/authenticated: only the service role and signed upload tokens can write.

create table public.report_files (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  storage_path text not null unique,
  kind text not null check (kind in ('image','audio')),
  mime text not null,
  bytes integer not null check (bytes between 1 and 10485760),
  offer_public boolean not null default false,          -- the author offered it for their public story
  public_status text not null default 'private' check (public_status in ('private','pending','approved','rejected')),
  created_at timestamptz not null default now()
);
create index report_files_report_idx on public.report_files (report_id);
alter table public.report_files enable row level security;
-- no policies: nobody reads or writes through the API. Moderators use the Supabase dashboard (postgres role):
--   update public.report_files set public_status = 'approved' where id = '...';   -- or 'rejected'
revoke all on public.report_files from public, anon, authenticated;

-- which report does this case code + secret (or signed-in user) own?
create function public.evidence_report(_case_code text, _secret_hash text, _user_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select r.id from public.reports r join public.report_access a on a.report_id = r.id
  where r.case_code = _case_code
    and ((_secret_hash is not null and a.secret_hash = _secret_hash) or (_user_id is not null and a.user_id = _user_id))
  limit 1
$$;

create function public.evidence_count(_report_id uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.report_files where report_id = _report_id
$$;

-- max 4 files per report; an offer for the public story only counts when the report itself is public
create function public.add_report_file(_report_id uuid, _path text, _kind text, _mime text, _bytes integer, _offer boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare n int; vis public.visibility_pref; pub boolean;
begin
  select visibility into vis from public.reports where id = _report_id;
  if vis is null then return false; end if;
  select count(*) into n from public.report_files where report_id = _report_id;
  if n >= 4 then return false; end if;
  pub := coalesce(_offer, false) and vis = 'public_after_review';
  insert into public.report_files (report_id, storage_path, kind, mime, bytes, offer_public, public_status)
  values (_report_id, _path, _kind, _mime, _bytes, pub, case when pub then 'pending' else 'private' end);
  return true;
end $$;

-- files a moderator approved, for stories that are currently published (withdrawn stories show nothing)
create function public.public_media_for(_ids uuid[])
returns table (report_id uuid, storage_path text, kind text, mime text)
language sql stable security definer set search_path = '' as $$
  select f.report_id, f.storage_path, f.kind, f.mime
  from public.report_files f join public.public_stories s on s.report_id = f.report_id
  where f.report_id = any(_ids) and f.public_status = 'approved' and s.status = 'approved'
  order by f.created_at
$$;

revoke all on function public.evidence_report(text, text, uuid), public.evidence_count(uuid),
  public.add_report_file(uuid, text, text, text, integer, boolean), public.public_media_for(uuid[]) from public, anon, authenticated;
grant execute on function public.evidence_report(text, text, uuid), public.evidence_count(uuid),
  public.add_report_file(uuid, text, text, text, integer, boolean), public.public_media_for(uuid[]) to service_role;
