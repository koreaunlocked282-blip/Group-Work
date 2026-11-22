-- Every report is a public story: AI totals count all approved stories (no minimum group size).
create or replace function public.ai_pattern_totals(_category report_category default null, _province text default null)
returns table(province_code text, category report_category, total integer, last_6m integer, prev_6m integer)
language sql stable security definer set search_path = ''
as $$
  select d.province_code, r.category, count(*)::int,
         count(*) filter (where coalesce(s.reviewed_at, s.created_at) >= now() - interval '6 months')::int,
         count(*) filter (where coalesce(s.reviewed_at, s.created_at) < now() - interval '6 months' and coalesce(s.reviewed_at, s.created_at) >= now() - interval '12 months')::int
  from public.public_stories s
  join public.reports r on r.id = s.report_id
  join public.districts d on d.code = r.district_code
  where s.status = 'approved'
    and (_category is null or r.category = _category)
    and (_province is null or d.province_code = _province)
  group by d.province_code, r.category
  order by 3 desc
  limit 20;
$$;
