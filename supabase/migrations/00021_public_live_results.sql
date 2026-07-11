-- ============================================================
-- ShowRing IQ — Public live results
-- Anonymous (anon-role) read access for the public show page
-- (`/[org-slug]/[show-slug]`, per CLAUDE.md's Routes section).
-- Scope: schedule, current class, draw order, at-gate status,
-- live (judge-signed) scores, and posted results. Rider/horse
-- names only — never fees, contact info, birthdates, addresses,
-- owner/trainer identity, or any document/financial data.
--
-- Deliberately implemented as SECURITY DEFINER RPCs rather than
-- direct anon RLS policies on shows/classes/entries/scores/results:
-- each function returns an explicit, hand-picked column list, so a
-- future column added to any of those tables can never silently
-- become public just by existing. No table gets new anon grants.
-- ============================================================

-- ------------------------------------------------------------
-- RPC: show summary by org slug + show slug
-- Only returns a row if the show is published.
-- ------------------------------------------------------------

create or replace function public.public_show(p_org_slug text, p_show_slug text)
returns table (
  id uuid,
  name text,
  start_date date,
  end_date date,
  timezone text,
  venue_name text,
  city text,
  state text,
  description text,
  organization_name text,
  organization_slug text
)
language sql
security definer
stable
set search_path = ''
as $$
  select s.id, s.name, s.start_date, s.end_date, s.timezone,
         s.venue_name, s.city, s.state, s.description,
         o.name, o.slug
  from public.shows s
  join public.organizations o on o.id = s.organization_id
  where o.slug = p_org_slug
    and s.slug = p_show_slug
    and s.status = 'published';
$$;

-- ------------------------------------------------------------
-- RPC: class list for a published show (the public schedule)
-- ------------------------------------------------------------

create or replace function public.public_show_classes(p_show uuid)
returns table (
  id uuid,
  class_number integer,
  name text,
  display_order integer,
  status text
)
language sql
security definer
stable
set search_path = ''
as $$
  select c.id, c.class_number, c.name, c.display_order, c.status
  from public.classes c
  join public.shows s on s.id = c.show_id
  where c.show_id = p_show
    and s.status = 'published'
  order by c.display_order;
$$;

-- ------------------------------------------------------------
-- RPC: draw order + at-gate status for one class
-- Rider/horse names and back number only — no owner, trainer, or
-- check-in timestamp.
-- ------------------------------------------------------------

create or replace function public.public_class_draw(p_show uuid, p_class uuid)
returns table (
  "position" integer,
  run_status text,
  entry_class_status text,
  rider_name text,
  horse_name text,
  back_number integer
)
language sql
security definer
stable
set search_path = ''
as $$
  select cd."position", cd.run_status, ec.status, e.rider_name, e.horse_name,
         bn.number
  from public.class_draws cd
  join public.classes c on c.id = cd.class_id
  join public.shows s on s.id = c.show_id
  join public.entry_classes ec on ec.id = cd.entry_class_id
  join public.entries e on e.id = ec.entry_id
  left join public.back_numbers bn on bn.entry_id = e.id and bn.show_id = p_show
  where cd.class_id = p_class
    and cd.show_id = p_show
    and s.status = 'published'
  order by cd."position";
$$;

-- ------------------------------------------------------------
-- RPC: live scores for one class
-- Only scores the judge has signed (status submitted/verified,
-- signed_at not null) — never a score still being drafted, since
-- pre-signoff values can change freely with no audit trail.
-- ------------------------------------------------------------

create or replace function public.public_class_scores(p_show uuid, p_class uuid)
returns table (
  back_number integer,
  rider_name text,
  horse_name text,
  result_status text,
  total_score_tenths integer,
  penalty_points_tenths integer,
  signed_at timestamptz
)
language sql
security definer
stable
set search_path = ''
as $$
  select bn.number, e.rider_name, e.horse_name,
         sc.result_status, sc.total_score_tenths, sc.penalty_points_tenths,
         sc.signed_at
  from public.scores sc
  join public.classes c on c.id = sc.class_id
  join public.shows s on s.id = c.show_id
  join public.entry_classes ec on ec.id = sc.entry_class_id
  join public.entries e on e.id = ec.entry_id
  left join public.back_numbers bn on bn.entry_id = e.id and bn.show_id = p_show
  where sc.class_id = p_class
    and sc.show_id = p_show
    and s.status = 'published'
    and sc.status in ('submitted', 'verified')
    and sc.signed_at is not null
  order by sc.signed_at;
$$;

-- ------------------------------------------------------------
-- RPC: posted results for one class
-- Only once the class itself has reached results_posted.
-- ------------------------------------------------------------

create or replace function public.public_class_results(p_show uuid, p_class uuid)
returns table (
  "placing" integer,
  tie_status text,
  back_number integer,
  rider_name text,
  horse_name text,
  total_score_tenths integer,
  money_won_cents integer
)
language sql
security definer
stable
set search_path = ''
as $$
  select r."placing", r.tie_status, bn.number, e.rider_name, e.horse_name,
         sc.total_score_tenths, r.money_won_cents
  from public.results r
  join public.classes c on c.id = r.class_id
  join public.shows s on s.id = c.show_id
  join public.entry_classes ec on ec.id = r.entry_class_id
  join public.entries e on e.id = ec.entry_id
  left join public.scores sc on sc.entry_class_id = ec.id
  left join public.back_numbers bn on bn.entry_id = e.id and bn.show_id = p_show
  where r.class_id = p_class
    and r.show_id = p_show
    and s.status = 'published'
    and c.status = 'results_posted'
  order by r."placing" nulls last;
$$;

grant execute on function public.public_show(text, text) to anon, authenticated;
grant execute on function public.public_show_classes(uuid) to anon, authenticated;
grant execute on function public.public_class_draw(uuid, uuid) to anon, authenticated;
grant execute on function public.public_class_scores(uuid, uuid) to anon, authenticated;
grant execute on function public.public_class_results(uuid, uuid) to anon, authenticated;
