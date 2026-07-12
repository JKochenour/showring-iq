-- ============================================================
-- ShowRing IQ — Per-run and conditional fees
-- From the EPRHA Fire Cracker Classic bill: a $17/run video fee, a $25
-- late entry fee, a $50 close-out fee if the bill isn't settled by a
-- deadline, and a 3% credit-card surcharge. Four independent additions:
--
-- 1. standard_entry_charges items gain an optional "per_run" flag
--    (interpreted in app code / the new apply_per_run_charges RPC) —
--    per_run charges apply once per CLASS entered, not once per entry.
-- 2. late_entry_fee_cents + apply_late_entry_fee RPC, called from the
--    entry-creation flow when office staff mark an entry late. Kept
--    manual rather than auto-detected: this app doesn't track a
--    per-class "closes at" datetime, and shows routinely waive it.
-- 3. close_out_fee_cents + close_out_deadline + apply_close_out_fee RPC,
--    a manual bulk action (same pattern as mark_payouts_distributed)
--    that charges every person with an outstanding balance, once.
-- 4. card_surcharge_percent, applied optionally when recording a card
--    payment (record_payment gains p_apply_card_surcharge).
-- ============================================================

alter table public.shows
  add column late_entry_fee_cents integer not null default 0 check (late_entry_fee_cents >= 0),
  add column close_out_fee_cents integer not null default 0 check (close_out_fee_cents >= 0),
  add column close_out_deadline timestamptz,
  add column card_surcharge_percent numeric(5, 2) not null default 0
    check (card_surcharge_percent >= 0 and card_surcharge_percent <= 100);

comment on column public.shows.late_entry_fee_cents is
  'Flat fee applied to an entry when office staff mark it late at creation. 0 = disabled.';
comment on column public.shows.close_out_deadline is
  'When set, the Financials page reminds staff to run apply_close_out_fee after this time.';
comment on column public.shows.card_surcharge_percent is
  'Optional surcharge percent office staff can opt into per card payment (record_payment '
  'p_apply_card_surcharge). 0 = disabled — no surcharge is ever silently added.';

grant update (late_entry_fee_cents, close_out_fee_cents, close_out_deadline, card_surcharge_percent)
  on public.shows to authenticated;

-- ------------------------------------------------------------
-- RPC: apply this show's per-run standard charges to one entry_class,
-- called right after a class is added to an entry. Security-definer so
-- the entry.edit permission that already gates adding a class is
-- enough — matches assign_back_number's existing pattern of applying
-- standard charges without requiring invoice.edit.
-- ------------------------------------------------------------

create or replace function public.apply_per_run_charges(p_entry_class uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ec record;
  v_entry record;
  v_charges jsonb;
  v_charge jsonb;
  v_billed_person uuid;
  v_label text;
  v_amount integer;
begin
  select ec.*, c.show_id as class_show_id
  into v_ec
  from public.entry_classes ec
  join public.classes c on c.id = ec.class_id
  where ec.id = p_entry_class;
  if v_ec is null then
    raise exception 'Entry class not found';
  end if;

  select * into v_entry from public.entries where id = v_ec.entry_id;
  if v_entry is null then
    raise exception 'Entry not found';
  end if;
  if not public.has_org_permission(v_entry.organization_id, 'entry.edit') then
    raise exception 'Missing permission: entry.edit';
  end if;

  select standard_entry_charges into v_charges from public.shows where id = v_entry.show_id;
  v_billed_person := case
    when v_entry.bill_to_trainer and v_entry.trainer_person_id is not null
      then v_entry.trainer_person_id
    else coalesce(v_entry.owner_person_id, v_entry.rider_person_id)
  end;

  for v_charge in
    select * from jsonb_array_elements(coalesce(v_charges, '[]'::jsonb))
    where (value->>'per_run')::boolean is true
  loop
    v_label := nullif(btrim(v_charge->>'label'), '');
    v_amount := nullif(v_charge->>'amount_cents', '')::integer;
    if v_label is not null and v_amount is not null and v_amount > 0 then
      insert into public.misc_charges (
        show_id, organization_id, person_id, description, category, amount_cents, created_by
      )
      values (
        v_entry.show_id, v_entry.organization_id, v_billed_person, v_label, v_label, v_amount, (select auth.uid())
      );

      perform public.log_audit(v_entry.organization_id, 'misc_charge.added', 'misc_charge', null,
        null,
        jsonb_build_object('person_id', v_billed_person, 'description', v_label,
                           'category', v_label, 'amount_cents', v_amount,
                           'source', 'per_run_charge', 'entry_class_id', p_entry_class),
        null, v_entry.show_id);
    end if;
  end loop;
end;
$$;

revoke execute on function public.apply_per_run_charges(uuid) from anon;

-- ------------------------------------------------------------
-- RPC: apply the show's late entry fee to one entry's billed person.
-- Manual — office staff opt an entry into this at creation time.
-- ------------------------------------------------------------

create or replace function public.apply_late_entry_fee(p_entry uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry record;
  v_fee integer;
  v_billed_person uuid;
begin
  select * into v_entry from public.entries where id = p_entry;
  if v_entry is null then
    raise exception 'Entry not found';
  end if;
  if not public.has_org_permission(v_entry.organization_id, 'entry.edit') then
    raise exception 'Missing permission: entry.edit';
  end if;

  select late_entry_fee_cents into v_fee from public.shows where id = v_entry.show_id;
  if coalesce(v_fee, 0) <= 0 then
    return;
  end if;

  v_billed_person := case
    when v_entry.bill_to_trainer and v_entry.trainer_person_id is not null
      then v_entry.trainer_person_id
    else coalesce(v_entry.owner_person_id, v_entry.rider_person_id)
  end;

  insert into public.misc_charges (
    show_id, organization_id, person_id, description, category, amount_cents, created_by
  )
  values (
    v_entry.show_id, v_entry.organization_id, v_billed_person,
    'Late entry fee', 'Late entry fee', v_fee, (select auth.uid())
  );

  perform public.log_audit(v_entry.organization_id, 'misc_charge.added', 'misc_charge', null,
    null,
    jsonb_build_object('person_id', v_billed_person, 'description', 'Late entry fee',
                       'category', 'Late entry fee', 'amount_cents', v_fee,
                       'source', 'late_entry_fee', 'entry_id', p_entry),
    null, v_entry.show_id);
end;
$$;

revoke execute on function public.apply_late_entry_fee(uuid) from anon;

-- ------------------------------------------------------------
-- RPC: bulk-apply the show's close-out fee to every billed person with
-- an outstanding balance who hasn't already been charged one.
-- Gated on invoice.edit (a financial, show-wide action, unlike the two
-- above). Returns the number of people charged.
-- ------------------------------------------------------------

create or replace function public.apply_close_out_fee(p_show uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_show record;
  v_count integer := 0;
  v_row record;
begin
  select * into v_show from public.shows where id = p_show;
  if v_show is null then
    raise exception 'Show not found';
  end if;
  if not public.has_org_permission(v_show.organization_id, 'invoice.edit') then
    raise exception 'Missing permission: invoice.edit';
  end if;
  if coalesce(v_show.close_out_fee_cents, 0) <= 0 then
    raise exception 'This show has no close-out fee configured';
  end if;

  for v_row in
    with billed as (
      select
        e.id as entry_id,
        case
          when e.bill_to_trainer and e.trainer_person_id is not null then e.trainer_person_id
          else coalesce(e.owner_person_id, e.rider_person_id)
        end as person_id
      from public.entries e
      where e.show_id = p_show
    ),
    fees as (
      select b.person_id, coalesce(sum(ec.fee_cents), 0) as cents
      from billed b
      join public.entry_classes ec on ec.entry_id = b.entry_id and ec.status = 'entered'
      group by b.person_id
    ),
    charges as (
      select person_id, coalesce(sum(amount_cents), 0) as cents
      from public.misc_charges
      where show_id = p_show
      group by person_id
    ),
    paid as (
      select person_id,
        coalesce(sum(case when is_refund then -amount_cents else amount_cents end), 0) as cents
      from public.payments
      where show_id = p_show
      group by person_id
    ),
    already_charged as (
      select distinct person_id from public.misc_charges
      where show_id = p_show and category = 'Close-out fee'
    ),
    balances as (
      select distinct b.person_id,
        coalesce(f.cents, 0) + coalesce(c.cents, 0) - coalesce(p.cents, 0) as balance_cents
      from billed b
      left join fees f on f.person_id = b.person_id
      left join charges c on c.person_id = b.person_id
      left join paid p on p.person_id = b.person_id
    )
    select person_id, balance_cents from balances
    where balance_cents > 0
      and person_id not in (select person_id from already_charged)
  loop
    insert into public.misc_charges (
      show_id, organization_id, person_id, description, category, amount_cents, created_by
    )
    values (
      p_show, v_show.organization_id, v_row.person_id,
      'Close-out fee', 'Close-out fee', v_show.close_out_fee_cents, (select auth.uid())
    );

    perform public.log_audit(v_show.organization_id, 'misc_charge.added', 'misc_charge', null,
      null,
      jsonb_build_object('person_id', v_row.person_id, 'description', 'Close-out fee',
                         'category', 'Close-out fee', 'amount_cents', v_show.close_out_fee_cents,
                         'source', 'close_out_fee', 'prior_balance_cents', v_row.balance_cents),
      null, p_show);

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.apply_close_out_fee(uuid) from anon;

-- ------------------------------------------------------------
-- record_payment: add an optional card-surcharge pass-through.
-- Backward compatible — existing callers omit p_apply_card_surcharge
-- and get the exact 00033 behavior. A trailing parameter still changes
-- the function's argument-type signature, so `create or replace` would
-- ADD an overload rather than replace it (the exact ambiguous-overload
-- bug fixed in 00020_fix_log_audit_overload.sql) — drop the old
-- 6-argument signature explicitly first.
-- ------------------------------------------------------------

drop function if exists public.record_payment(uuid, uuid, text, integer, text, text);

create or replace function public.record_payment(
  p_show uuid,
  p_person uuid,
  p_method text,
  p_amount_cents integer,
  p_reference text default null,
  p_notes text default null,
  p_apply_card_surcharge boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_show record;
  v_person_org uuid;
  v_payment_id uuid;
  v_surcharge_cents integer := 0;
  v_total_cents integer;
begin
  select * into v_show from public.shows where id = p_show;
  if v_show is null then
    raise exception 'Show not found';
  end if;
  if not public.has_org_permission(v_show.organization_id, 'invoice.edit') then
    raise exception 'Missing permission: invoice.edit';
  end if;

  select organization_id into v_person_org from public.people where id = p_person;
  if v_person_org is null or v_person_org <> v_show.organization_id then
    raise exception 'Person not found in this organization';
  end if;

  if p_method is null or p_method not in ('cash', 'check', 'card', 'other') then
    raise exception 'Method must be cash, check, card, or other';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  if p_apply_card_surcharge then
    if p_method <> 'card' then
      raise exception 'Card surcharge can only apply to card payments';
    end if;
    v_surcharge_cents := round(p_amount_cents * coalesce(v_show.card_surcharge_percent, 0) / 100.0);
    if v_surcharge_cents > 0 then
      insert into public.misc_charges (
        show_id, organization_id, person_id, description, category, amount_cents, created_by
      )
      values (
        p_show, v_show.organization_id, p_person,
        format('Card surcharge (%s%%)', v_show.card_surcharge_percent),
        'Card surcharge', v_surcharge_cents, (select auth.uid())
      );
      perform public.log_audit(v_show.organization_id, 'misc_charge.added', 'misc_charge', null,
        null,
        jsonb_build_object('person_id', p_person, 'description', 'Card surcharge',
                           'category', 'Card surcharge', 'amount_cents', v_surcharge_cents,
                           'source', 'card_surcharge'),
        null, p_show);
    end if;
  end if;

  v_total_cents := p_amount_cents + v_surcharge_cents;

  insert into public.payments (
    show_id, organization_id, person_id, method, amount_cents,
    reference, notes, recorded_by
  )
  values (
    p_show, v_show.organization_id, p_person, p_method, v_total_cents,
    nullif(btrim(coalesce(p_reference, '')), ''),
    case
      when v_surcharge_cents > 0 then
        btrim(concat_ws(' ', nullif(btrim(coalesce(p_notes, '')), ''),
          format('(includes %s%% card surcharge)', v_show.card_surcharge_percent)))
      else nullif(btrim(coalesce(p_notes, '')), '')
    end,
    (select auth.uid())
  )
  returning id into v_payment_id;

  perform public.log_audit(v_show.organization_id, 'payment.recorded', 'payment', v_payment_id::text,
    null,
    jsonb_build_object('person_id', p_person, 'method', p_method,
                       'amount_cents', v_total_cents, 'surcharge_cents', v_surcharge_cents,
                       'reference', nullif(btrim(coalesce(p_reference, '')), '')),
    null, p_show);

  return v_payment_id;
end;
$$;

revoke execute on function public.record_payment(uuid, uuid, text, integer, text, text, boolean) from anon;

-- ------------------------------------------------------------
-- assign_back_number: exclude per_run items from the once-per-entry
-- application, since apply_per_run_charges now applies those once per
-- CLASS instead. Same signature as 00027's version — plain replace.
-- ------------------------------------------------------------

create or replace function public.assign_back_number(
  p_entry uuid,
  p_number integer default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry record;
  v_num integer;
  v_existing record;
  v_charges jsonb;
  v_charge jsonb;
  v_billed_person uuid;
  v_label text;
  v_amount integer;
  v_all_youth boolean;
begin
  select * into v_entry from public.entries where id = p_entry;
  if v_entry is null then
    raise exception 'Entry not found';
  end if;
  if not public.has_org_permission(v_entry.organization_id, 'entry.assign_back_number') then
    raise exception 'Missing permission: entry.assign_back_number';
  end if;

  if p_number is null then
    select coalesce(max(number), 0) + 1 into v_num
    from public.back_numbers where show_id = v_entry.show_id;
  else
    v_num := p_number;
  end if;

  select * into v_existing from public.back_numbers where entry_id = p_entry;

  if v_existing is not null then
    if v_existing.number = v_num then
      return v_num;
    end if;
    update public.back_numbers set number = v_num where entry_id = p_entry;
    perform public.log_audit(v_entry.organization_id, 'back_number.transferred', 'back_number', v_existing.id::text,
      jsonb_build_object('entry_id', p_entry, 'number', v_existing.number),
      jsonb_build_object('entry_id', p_entry, 'number', v_num));
  else
    insert into public.back_numbers (show_id, organization_id, number, entry_id)
    values (v_entry.show_id, v_entry.organization_id, v_num, p_entry);
    perform public.log_audit(v_entry.organization_id, 'back_number.assigned', 'back_number', null,
      null, jsonb_build_object('entry_id', p_entry, 'number', v_num));

    select bool_and(c.is_youth) into v_all_youth
    from public.entry_classes ec
    join public.classes c on c.id = ec.class_id
    where ec.entry_id = p_entry and ec.status = 'entered';

    -- Apply this show's standard per-entry charges (e.g. stall, office,
    -- drug fee) once, now that this entry has a back number. A person
    -- with multiple entries/back numbers gets the charge once per entry
    -- — each horse needs its own stall, paperwork, etc. Skipped entirely
    -- when every class this entry is in is a youth class (Show Rules
    -- P(7): no office fee may be charged to Youth classes). per_run
    -- charges (e.g. a per-run video fee) are excluded here — those are
    -- applied once per class by apply_per_run_charges instead.
    if coalesce(v_all_youth, false) = false then
      select standard_entry_charges into v_charges from public.shows where id = v_entry.show_id;
      v_billed_person := case
        when v_entry.bill_to_trainer and v_entry.trainer_person_id is not null
          then v_entry.trainer_person_id
        else coalesce(v_entry.owner_person_id, v_entry.rider_person_id)
      end;

      for v_charge in
        select * from jsonb_array_elements(coalesce(v_charges, '[]'::jsonb))
        where (value->>'per_run')::boolean is not true
      loop
        v_label := nullif(btrim(v_charge->>'label'), '');
        v_amount := nullif(v_charge->>'amount_cents', '')::integer;
        if v_label is not null and v_amount is not null and v_amount > 0 then
          insert into public.misc_charges (
            show_id, organization_id, person_id, description, category, amount_cents, created_by
          )
          values (
            v_entry.show_id, v_entry.organization_id, v_billed_person, v_label, v_label, v_amount, (select auth.uid())
          );

          perform public.log_audit(v_entry.organization_id, 'misc_charge.added', 'misc_charge', null,
            null,
            jsonb_build_object('person_id', v_billed_person, 'description', v_label,
                               'category', v_label, 'amount_cents', v_amount, 'source', 'standard_entry_charge'),
            null, v_entry.show_id);
        end if;
      end loop;
    end if;
  end if;

  return v_num;
end;
$$;

revoke execute on function public.assign_back_number(uuid, integer) from anon;
