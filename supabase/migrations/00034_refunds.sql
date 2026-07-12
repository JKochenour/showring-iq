-- ============================================================
-- ShowRing IQ — Refunds as first-class payment records
--
-- Distinct from remove_payment (00033), which is for a payment that was
-- entered in error and never really happened. A refund is money that WAS
-- properly received and is now being returned (a scratch refund, an
-- overpayment returned, etc.) — it needs its own audit trail and must
-- show up on statements and the reconciliation report as its own line,
-- not as if the original payment never existed.
--
-- Implementation: a refund is its own row in public.payments with
-- is_refund = true and refund_of_payment_id pointing at the payment it
-- refunds. amount_cents stays positive (like every other payment row);
-- callers/reporting code subtract refund rows from the paid total
-- instead of storing negative amounts, so "sum of amount_cents" always
-- means "total dollars that changed hands" for reporting.
-- ============================================================

alter table public.payments
  add column is_refund boolean not null default false,
  add column refund_of_payment_id uuid references public.payments (id) on delete restrict;

alter table public.payments
  add constraint payments_refund_shape check (
    (is_refund = false and refund_of_payment_id is null)
    or (is_refund = true and refund_of_payment_id is not null)
  );

comment on column public.payments.is_refund is
  'true = this row is money paid back out, not money received. '
  'amount_cents is still positive; subtract it from receipts when totaling.';
comment on column public.payments.refund_of_payment_id is
  'The original payment this refund is against. Null for ordinary payments.';

create index payments_refund_of_idx on public.payments (refund_of_payment_id)
  where refund_of_payment_id is not null;

-- ------------------------------------------------------------
-- RPC: refund some or all of an existing payment
-- ------------------------------------------------------------

create or replace function public.record_refund(
  p_payment uuid,
  p_amount_cents integer,
  p_reason text,
  p_method text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_original record;
  v_already_refunded integer;
  v_refund_id uuid;
  v_method text;
begin
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required to record a refund';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'Refund amount must be greater than zero';
  end if;

  select * into v_original from public.payments where id = p_payment;
  if v_original is null then
    raise exception 'Payment not found';
  end if;
  if v_original.is_refund then
    raise exception 'Cannot refund a refund';
  end if;
  if not public.has_org_permission(v_original.organization_id, 'invoice.edit') then
    raise exception 'Missing permission: invoice.edit';
  end if;

  select coalesce(sum(amount_cents), 0) into v_already_refunded
  from public.payments
  where refund_of_payment_id = p_payment;

  if v_already_refunded + p_amount_cents > v_original.amount_cents then
    raise exception 'Refund of % would exceed the original payment (% already refunded of %)',
      p_amount_cents, v_already_refunded, v_original.amount_cents;
  end if;

  v_method := coalesce(p_method, v_original.method);
  if v_method not in ('cash', 'check', 'card', 'other') then
    raise exception 'Method must be cash, check, card, or other';
  end if;

  insert into public.payments (
    show_id, organization_id, person_id, method, amount_cents,
    reference, notes, recorded_by, is_refund, refund_of_payment_id
  )
  values (
    v_original.show_id, v_original.organization_id, v_original.person_id,
    v_method, p_amount_cents, v_original.reference, btrim(p_reason),
    (select auth.uid()), true, p_payment
  )
  returning id into v_refund_id;

  perform public.log_audit(v_original.organization_id, 'payment.refunded', 'payment', v_refund_id::text,
    jsonb_build_object('original_payment_id', p_payment, 'original_amount_cents', v_original.amount_cents),
    jsonb_build_object('person_id', v_original.person_id, 'method', v_method,
                       'amount_cents', p_amount_cents, 'reason', btrim(p_reason)),
    btrim(p_reason), v_original.show_id);

  return v_refund_id;
end;
$$;

revoke execute on function public.record_refund(uuid, integer, text, text) from anon;
