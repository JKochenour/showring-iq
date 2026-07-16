-- ============================================================
-- ShowRing IQ — Public show directory + org landing pages
--
-- Discovery layer for guests: until now the only public surface was
-- /[org-slug]/[show-slug] (00021), reachable only if you already had
-- the exact URL (QR/share link). This adds anon-safe listings so a
-- guest — or a fresh login — can FIND shows: a cross-org directory of
-- published shows ("find shows" in CLAUDE.md's public routes) and a
-- public org landing page (/eprha) listing that org's shows.
--
-- Same security posture as 00021: SECURITY DEFINER RPCs returning
-- explicit hand-picked column lists, published shows only, no table
-- gets anon grants. Org contact_email is deliberately NOT exposed.
-- ============================================================

-- ------------------------------------------------------------
-- RPC: every published show across all orgs (the directory).
-- Small result set by nature (an org publishes a handful of shows a
-- year); filtering/search happens in the app layer.
-- ------------------------------------------------------------

create or replace function public.public_shows_directory()
returns table (
  name text,
  slug text,
  start_date date,
  end_date date,
  venue_name text,
  city text,
  state text,
  organization_name text,
  organization_slug text
)
language sql
security definer
stable
set search_path = ''
as $$
  select s.name, s.slug, s.start_date, s.end_date,
         s.venue_name, s.city, s.state,
         o.name, o.slug
  from public.shows s
  join public.organizations o on o.id = s.organization_id
  where s.status = 'published'
  order by s.start_date desc;
$$;

-- ------------------------------------------------------------
-- RPC: public org summary by slug (the /[org] landing page header).
-- Only returns a row if the org has at least one published show —
-- an org with nothing public shouldn't be probeable by slug.
-- ------------------------------------------------------------

create or replace function public.public_org(p_org_slug text)
returns table (
  name text,
  slug text,
  city text,
  state text,
  website text
)
language sql
security definer
stable
set search_path = ''
as $$
  select o.name, o.slug, o.city, o.state, o.website
  from public.organizations o
  where o.slug = p_org_slug
    and exists (
      select 1 from public.shows s
      where s.organization_id = o.id and s.status = 'published'
    );
$$;

-- ------------------------------------------------------------
-- RPC: one org's published shows (the /[org] landing page body).
-- ------------------------------------------------------------

create or replace function public.public_org_shows(p_org_slug text)
returns table (
  name text,
  slug text,
  start_date date,
  end_date date,
  venue_name text,
  city text,
  state text
)
language sql
security definer
stable
set search_path = ''
as $$
  select s.name, s.slug, s.start_date, s.end_date,
         s.venue_name, s.city, s.state
  from public.shows s
  join public.organizations o on o.id = s.organization_id
  where o.slug = p_org_slug
    and s.status = 'published'
  order by s.start_date desc;
$$;

grant execute on function public.public_shows_directory() to anon, authenticated;
grant execute on function public.public_org(text) to anon, authenticated;
grant execute on function public.public_org_shows(text) to anon, authenticated;
