-- ============================================================
-- ShowRing IQ — Run-level fees + fully editable bills
--
-- Reworks how judge / video / photo fees are billed. EPRHA charges these
-- once per RUN (a set of classes that run concurrent), NOT once per class:
--   * entry fee — per class (unchanged, entry_classes.fee_cents)
--   * judge fee — once per run, the HIGHEST judge fee among the run's classes
--   * video / photo (per_run standard charges) — once per run
--   * office / stall / drug (non-per_run standard charges) — once per horse
--     per weekend (unchanged, assign_back_number)
-- A "run" = an entry's entered classes grouped by classes.concurrent_group_id
-- (each ungrouped class is its own run). See memory eprha-entry-and-fee-rules.
--
-- These run fees are now COMPUTED live in src/lib/billing.ts (like entry
-- fees already are) rather than materialized as misc_charges — so they
-- self-correct when a class is scratched or regrouped. This migration:
--   1. adds classes.judge_fee_cents (per-class judge fee),
--   2. lets a materialized misc charge be edited down to $0 (comp) while
--      keeping the row (so it still counts — e.g. "Camper 1, $0"),
--   3. adds entry_run_fee_overrides so staff can override a computed run
--      fee's total for one entry (e.g. comp a video fee) from the bill,
--   4. retires apply_per_run_charges (now a no-op) and clears any stale
--      per-run misc_charges it materialized, to avoid double-counting.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Per-class judge fee. Billed once per run as the max in the run.
--    Youth classes are typically 0 (data-driven), preserving the youth
--    fee exemption without special-casing.
-- ------------------------------------------------------------

alter table public.classes
  add column judge_fee_cents integer not null default 0 check (judge_fee_cents >= 0);

grant update (judge_fee_cents) on public.classes to authenticated;

comment on column public.classes.judge_fee_cents is
  'Per-class judge fee (cents). Billed once per run (concurrent group) as the '
  'highest judge fee among the run''s classes. Computed live in billing.ts.';

-- ------------------------------------------------------------
-- 2. Allow a misc charge to be edited to $0 while the row stays, so an
--    amenity like a camper can be comped without losing the head count.
--    add_misc_charge still requires > 0 (you add real, then edit to 0).
-- ------------------------------------------------------------

alter table public.misc_charges drop constraint misc_charges_amount_cents_check;
alter table public.misc_charges add constraint misc_charges_amount_cents_check
  check (amount_cents >= 0);

-- ------------------------------------------------------------
-- 3. Run-fee overrides. Computed run fees are the default; an override
--    replaces the computed TOTAL for one (entry, fee_key). fee_key is
--    'judge' or a per_run standard-charge label (e.g. 'Video', 'Photo').
--    amount_cents = 0 => comped, the line still shows on the bill.
--    v1 granularity: per entry + fee_key (comp "this horse's video for
--    the weekend"), not per individual run.
-- ------------------------------------------------------------

create table public.entry_run_fee_overrides (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  entry_id uuid not null references public.entries (id) on delete cascade,
  fee_key text not null check (char_length(fee_key) between 1 and 60),
  amount_cents integer not null check (amount_cents >= 0),
  reason text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entry_id, fee_key)
);

create index entry_run_fee_overrides_entry_idx
  on public.entry_run_fee_overrides (entry_id);

alter table public.entry_run_fee_overrides enable row level security;

create policy "entry_run_fee_overrides_select" on public.entry_run_fee_overrides
  for select to authenticated
  using (public.has_org_permission(organization_id, 'invoice.view'));

-- Writes go through the RPCs below so every override is audited with a reason.
revoke insert, update, delete on public.entry_run_fee_overrides from authenticated;

-- ------------------------------------------------------------
-- RPC: set (upsert) a run-fee override for an entry.
-- ------------------------------------------------------------

create or replace function public.set_run_fee_override(
  p_entry uuid,
  p_fee_key text,
  p_amount_cents integer,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry record;
  v_key text;
  v_prior integer;
begin
  select * into v_entry from public.entries where id = p_entry;
  if v_entry is null then
    raise exception 'Entry not found';
  end if;
  if not public.has_org_permission(v_entry.organization_id, 'invoice.edit') then
    raise exception 'Missing permission: invoice.edit';
  end if;

  v_key := nullif(btrim(p_fee_key), '');
  if v_key is null then
    raise exception 'A fee is required';
  end if;
  if p_amount_cents is null or p_amount_cents < 0 then
    raise exception 'Amount cannot be negative';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required to override a fee';
  end if;

  select amount_cents into v_prior from public.entry_run_fee_overrides
  where entry_id = p_entry and fee_key = v_key;

  insert into public.entry_run_fee_overrides (
    organization_id, entry_id, fee_key, amount_cents, reason, created_by
  )
  values (
    v_entry.organization_id, p_entry, v_key, p_amount_cents, btrim(p_reason), (select auth.uid())
  )
  on conflict (entry_id, fee_key) do update
    set amount_cents = excluded.amount_cents,
        reason = excluded.reason,
        created_by = excluded.created_by,
        updated_at = now();

  perform public.log_audit(v_entry.organization_id, 'run_fee_override.set', 'entry', p_entry::text,
    case when v_prior is null then null else jsonb_build_object('fee_key', v_key, 'amount_cents', v_prior) end,
    jsonb_build_object('fee_key', v_key, 'amount_cents', p_amount_cents),
    btrim(p_reason), v_entry.show_id);
end;
$$;

revoke execute on function public.set_run_fee_override(uuid, text, integer, text) from anon;

-- ------------------------------------------------------------
-- RPC: clear a run-fee override (reset to the computed amount).
-- ------------------------------------------------------------

create or replace function public.clear_run_fee_override(
  p_entry uuid,
  p_fee_key text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry record;
  v_key text;
  v_prior integer;
begin
  select * into v_entry from public.entries where id = p_entry;
  if v_entry is null then
    raise exception 'Entry not found';
  end if;
  if not public.has_org_permission(v_entry.organization_id, 'invoice.edit') then
    raise exception 'Missing permission: invoice.edit';
  end if;

  v_key := nullif(btrim(p_fee_key), '');
  select amount_cents into v_prior from public.entry_run_fee_overrides
  where entry_id = p_entry and fee_key = v_key;
  if v_prior is null then
    return;
  end if;

  delete from public.entry_run_fee_overrides
  where entry_id = p_entry and fee_key = v_key;

  perform public.log_audit(v_entry.organization_id, 'run_fee_override.cleared', 'entry', p_entry::text,
    jsonb_build_object('fee_key', v_key, 'amount_cents', v_prior),
    null, nullif(btrim(coalesce(p_reason, '')), ''), v_entry.show_id);
end;
$$;

revoke execute on function public.clear_run_fee_override(uuid, text, text) from anon;

-- ------------------------------------------------------------
-- RPC: edit a materialized misc charge's price (incl. $0), keeping the
-- row. Reason-required and audited, like remove_misc_charge (00022).
-- ------------------------------------------------------------

create or replace function public.update_misc_charge_amount(
  p_charge uuid,
  p_amount_cents integer,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_charge record;
begin
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required to change a charge';
  end if;
  if p_amount_cents is null or p_amount_cents < 0 then
    raise exception 'Amount cannot be negative';
  end if;

  select * into v_charge from public.misc_charges where id = p_charge;
  if v_charge is null then
    raise exception 'Charge not found';
  end if;
  if not public.has_org_permission(v_charge.organization_id, 'invoice.edit') then
    raise exception 'Missing permission: invoice.edit';
  end if;

  update public.misc_charges set amount_cents = p_amount_cents where id = p_charge;

  perform public.log_audit(v_charge.organization_id, 'misc_charge.amount_changed', 'misc_charge', p_charge::text,
    jsonb_build_object('person_id', v_charge.person_id, 'description', v_charge.description,
                       'category', v_charge.category, 'amount_cents', v_charge.amount_cents),
    jsonb_build_object('person_id', v_charge.person_id, 'description', v_charge.description,
                       'category', v_charge.category, 'amount_cents', p_amount_cents),
    btrim(p_reason), v_charge.show_id);
end;
$$;

revoke execute on function public.update_misc_charge_amount(uuid, integer, text) from anon;

-- ------------------------------------------------------------
-- 4. Retire per-run charge materialization. billing.ts now computes
--    video/photo per run, so apply_per_run_charges becomes a no-op
--    (kept, not dropped, so any stray caller can't error), and its call
--    sites are removed in app code. Then clear any misc_charges it
--    already materialized (matched by this show's per_run labels) so the
--    now-computed run fees don't double up. On real data this deletes 0
--    rows — only the (since-deleted) QA slates ever exercised per_run.
-- ------------------------------------------------------------

create or replace function public.apply_per_run_charges(p_entry_class uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Deprecated in 00042: per-run fees (video/photo) are now computed live
  -- in billing.ts, once per run, instead of materialized once per class.
  return;
end;
$$;

do $$
declare
  v_deleted integer;
begin
  with per_run_labels as (
    select s.id as show_id, btrim(c.value->>'label') as label
    from public.shows s
    cross join lateral jsonb_array_elements(coalesce(s.standard_entry_charges, '[]'::jsonb)) as c(value)
    where (c.value->>'per_run')::boolean is true
      and nullif(btrim(c.value->>'label'), '') is not null
  ),
  deleted as (
    delete from public.misc_charges m
    using per_run_labels p
    where m.show_id = p.show_id and m.category = p.label
    returning m.id
  )
  select count(*) into v_deleted from deleted;
  raise notice 'apply_per_run_charges cleanup: deleted % stale per-run misc_charges', v_deleted;
end;
$$;
