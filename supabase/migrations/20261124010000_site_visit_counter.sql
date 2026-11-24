-- Privacy-friendly visitor counter. No cookies and no stored IP address:
-- "visitor" is a hash of (day, IP, browser, server secret), so the same person
-- counts once per day and cannot be followed across days.
create table if not exists core."SiteVisit" (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  day date not null default (now() at time zone 'utc')::date,
  visitor text not null,
  path text not null,
  country text,
  device text,
  referrer text
);
create index if not exists "SiteVisit_day_idx" on core."SiteVisit"(day);
create index if not exists "SiteVisit_at_idx" on core."SiteVisit"(at);
alter table core."SiteVisit" enable row level security;
alter table core."SiteVisit" force row level security;
revoke all on core."SiteVisit" from anon, authenticated;
grant select, insert on core."SiteVisit" to service_role;

-- One summary for the team console. Only service_role (trade-api, after the
-- operator check) can call it.
create or replace function core.site_visit_stats()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with today as (select (now() at time zone 'utc')::date d)
  select jsonb_build_object(
    'now', (select count(distinct visitor) from core."SiteVisit" where at > now() - interval '5 minutes'),
    'today', (select count(distinct visitor) from core."SiteVisit", today where day = today.d),
    'todayViews', (select count(*) from core."SiteVisit", today where day = today.d),
    'week', (select count(distinct visitor) from core."SiteVisit", today where day > today.d - 7),
    'days', coalesce((select jsonb_agg(jsonb_build_object('day', g.x::date, 'visitors',
       (select count(distinct visitor) from core."SiteVisit" v where v.day = g.x::date)) order by g.x)
       from today, generate_series(today.d - 6, today.d, interval '1 day') as g(x)), '[]'::jsonb),
    'countries', coalesce((select jsonb_agg(jsonb_build_object('country', c, 'visitors', n) order by n desc)
       from (select coalesce(country, '??') c, count(distinct visitor) n from core."SiteVisit", today
             where day > today.d - 7 group by 1 order by 2 desc limit 10) x), '[]'::jsonb),
    'pages', coalesce((select jsonb_agg(jsonb_build_object('path', path, 'views', n) order by n desc)
       from (select path, count(*) n from core."SiteVisit", today where day > today.d - 7 and path not like '/e/%' group by 1 order by 2 desc limit 8) x), '[]'::jsonb),
    -- Request steps over 7 days, by distinct visitor: opened the form, sent it,
    -- hit an error, or went to WhatsApp / email from a page.
    'steps', jsonb_build_object(
      'requestOpen', (select count(distinct visitor) from core."SiteVisit", today where day > today.d - 7 and path = '/e/request-open'),
      'requestSent', (select count(distinct visitor) from core."SiteVisit", today where day > today.d - 7 and path = '/e/request-sent'),
      'requestError', (select count(distinct visitor) from core."SiteVisit", today where day > today.d - 7 and path = '/e/request-error'),
      'whatsapp', (select count(distinct visitor) from core."SiteVisit", today where day > today.d - 7 and (path = '/e/request-whatsapp' or path like '/e/wa/%')),
      'email', (select count(distinct visitor) from core."SiteVisit", today where day > today.d - 7 and path like '/e/email/%')),
    'devices', coalesce((select jsonb_object_agg(coalesce(device, 'other'), n)
       from (select device, count(distinct visitor) n from core."SiteVisit", today where day > today.d - 7 group by 1) x), '{}'::jsonb)
  );
$$;
revoke all on function core.site_visit_stats() from public, anon, authenticated;
grant execute on function core.site_visit_stats() to service_role;
notify pgrst, 'reload schema';
