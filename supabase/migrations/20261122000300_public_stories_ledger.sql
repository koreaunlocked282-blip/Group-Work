-- Public stories ledger: list approved stories and simple statistics (anon-callable, approved only).
create function public.list_public_stories(_category public.report_category default null, _province text default null, _limit int default 12, _offset int default 0)
returns table (id uuid, category public.report_category, province_code text, story_text text, approved_month date)
language sql stable security definer set search_path = '' as $$
  select s.report_id, r.category, d.province_code, s.story_text, date_trunc('month', coalesce(s.reviewed_at, s.created_at))::date
  from public.public_stories s
  join public.reports r on r.id = s.report_id
  join public.districts d on d.code = r.district_code
  where s.status = 'approved'
    and (_category is null or r.category = _category)
    and (_province is null or d.province_code = _province)
  order by coalesce(s.reviewed_at, s.created_at) desc
  limit least(greatest(coalesce(_limit, 12), 1), 30) offset greatest(coalesce(_offset, 0), 0);
$$;

create function public.public_story_stats()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'total', (select count(*) from public.public_stories where status = 'approved'),
    'by_category', coalesce((select jsonb_object_agg(c, n) from (
        select r.category::text c, count(*)::int n from public.public_stories s join public.reports r on r.id = s.report_id
        where s.status = 'approved' group by 1) x), '{}'::jsonb),
    'by_province', coalesce((select jsonb_object_agg(p, n) from (
        select d.province_code p, count(*)::int n from public.public_stories s join public.reports r on r.id = s.report_id
        join public.districts d on d.code = r.district_code where s.status = 'approved' group by 1) y), '{}'::jsonb));
$$;

revoke all on function public.list_public_stories(public.report_category, text, int, int), public.public_story_stats() from public, anon, authenticated, service_role;
grant execute on function public.list_public_stories(public.report_category, text, int, int), public.public_story_stats() to anon, authenticated;
