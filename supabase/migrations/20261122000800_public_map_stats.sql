-- Real counts for the map, hero numbers and topic cards: only approved public stories.
create or replace function public.public_map_stats()
returns jsonb language sql stable security definer set search_path = '' as $$
  with a as (
    select d.province_code p, d.name_en dn, r.category::text c, coalesce(s.reviewed_at, s.created_at) t
    from public.public_stories s join public.reports r on r.id = s.report_id
    join public.districts d on d.code = r.district_code where s.status = 'approved')
  select jsonb_build_object(
    'total', (select count(*) from a),
    'pc', coalesce((select jsonb_agg(jsonb_build_array(p, c, n)) from (select p, c, count(*)::int n from a group by 1,2) x), '[]'::jsonb),
    'dc', coalesce((select jsonb_agg(jsonb_build_array(p, dn, c, n)) from (select p, dn, c, count(*)::int n from a group by 1,2,3) y), '[]'::jsonb),
    'pm', coalesce((select jsonb_agg(jsonb_build_array(p, m, n)) from (select p, (date_part('year', now())*12+date_part('month', now()) - date_part('year', t)*12 - date_part('month', t))::int m, count(*)::int n from a where t >= date_trunc('month', now()) - interval '5 months' group by 1,2) z), '[]'::jsonb),
    'latest', (select jsonb_build_object('p', p, 'dn', dn, 'c', c, 't', t) from a order by t desc limit 1));
$$;
revoke all on function public.public_map_stats() from public, anon, authenticated, service_role;
grant execute on function public.public_map_stats() to anon, authenticated;
