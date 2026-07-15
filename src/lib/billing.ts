import type { SupabaseClient } from "@supabase/supabase-js";

/** Who a given entry bills: the trainer when the office has opted this
 * entry into barn billing (bill_to_trainer), otherwise the owner if one
 * is set (they aren't necessarily riding), otherwise the rider. */
function billedPersonId(entry: {
  rider_person_id: string;
  owner_person_id: string | null;
  trainer_person_id: string | null;
  bill_to_trainer: boolean;
}): string {
  if (entry.bill_to_trainer && entry.trainer_person_id) return entry.trainer_person_id;
  return entry.owner_person_id ?? entry.rider_person_id;
}

function billedPersonName(entry: {
  rider_name: string;
  owner_name: string | null;
  owner_person_id: string | null;
  trainer_name: string | null;
  bill_to_trainer: boolean;
}): string {
  if (entry.bill_to_trainer && entry.trainer_name) return entry.trainer_name;
  return entry.owner_person_id ? (entry.owner_name ?? entry.rider_name) : entry.rider_name;
}

interface RawEntry {
  id: string;
  rider_person_id: string;
  rider_name: string;
  owner_person_id: string | null;
  owner_name: string | null;
  trainer_person_id: string | null;
  trainer_name: string | null;
  bill_to_trainer: boolean;
  status: "active" | "scratched";
}

interface RawEntryClass {
  id: string;
  entry_id: string;
  fee_cents: number;
  status: "entered" | "scratched";
  class: { class_number: number; name: string } | null;
}

interface RawMiscCharge {
  id: string;
  person_id: string;
  description: string;
  category: string;
  amount_cents: number;
  created_at: string;
}

export type PaymentMethod = "cash" | "check" | "card" | "other";

interface RawPayment {
  id: string;
  person_id: string;
  method: PaymentMethod;
  amount_cents: number;
  reference: string | null;
  notes: string | null;
  created_at: string;
  is_refund: boolean;
  refund_of_payment_id: string | null;
}

/** Resolve the show ids that make up a weekend (its slates). */
export async function loadWeekendShowIds(
  supabase: SupabaseClient,
  weekendId: string
): Promise<string[]> {
  const { data } = await supabase
    .from("shows")
    .select("id")
    .eq("weekend_id", weekendId)
    .order("start_date");
  return (data ?? []).map((s) => s.id as string);
}

async function loadShowBillingData(supabase: SupabaseClient, showIds: string[]) {
  if (showIds.length === 0) {
    return {
      entries: [] as RawEntry[],
      entryClasses: [] as RawEntryClass[],
      backNumbers: [] as { entry_id: string; number: number }[],
      miscCharges: [] as RawMiscCharge[],
      payments: [] as RawPayment[],
    };
  }
  const [
    { data: entries },
    { data: entryClasses },
    { data: backNumbers },
    { data: miscCharges },
    { data: payments },
  ] = await Promise.all([
    supabase
      .from("entries")
      .select(
        "id, rider_person_id, rider_name, owner_person_id, owner_name, trainer_person_id, trainer_name, bill_to_trainer, status"
      )
      .in("show_id", showIds),
    supabase
      .from("entry_classes")
      .select("id, entry_id, fee_cents, status, class:classes(class_number, name)")
      .in("show_id", showIds),
    supabase.from("back_numbers").select("entry_id, number").in("show_id", showIds),
    supabase
      .from("misc_charges")
      .select("id, person_id, description, category, amount_cents, created_at")
      .in("show_id", showIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("payments")
      .select(
        "id, person_id, method, amount_cents, reference, notes, created_at, is_refund, refund_of_payment_id"
      )
      .in("show_id", showIds)
      .order("created_at", { ascending: false }),
  ]);

  return {
    entries: (entries as RawEntry[]) ?? [],
    entryClasses: (entryClasses as unknown as RawEntryClass[]) ?? [],
    backNumbers: (backNumbers as { entry_id: string; number: number }[]) ?? [],
    miscCharges: (miscCharges as RawMiscCharge[]) ?? [],
    payments: (payments as RawPayment[]) ?? [],
  };
}

export interface BillingRosterRow {
  personId: string;
  name: string;
  backNumbers: number[];
  entryFeeCents: number;
  miscChargeCents: number;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  /** Distinct rider names billed on this row via bill_to_trainer — set
   * only when this row represents a trainer/barn bill for >1 rider. */
  billedRiderNames: string[];
}

export async function loadShowBillingRoster(
  supabase: SupabaseClient,
  showId: string
): Promise<BillingRosterRow[]> {
  return buildRoster(await loadShowBillingData(supabase, [showId]));
}

/** Roster billed across a whole weekend — one row per responsible party,
 * aggregating every slate's entry fees, misc charges, and payments. */
export async function loadWeekendBillingRoster(
  supabase: SupabaseClient,
  weekendId: string
): Promise<BillingRosterRow[]> {
  const showIds = await loadWeekendShowIds(supabase, weekendId);
  return buildRoster(await loadShowBillingData(supabase, showIds));
}

function buildRoster({
  entries,
  entryClasses,
  backNumbers,
  miscCharges,
  payments,
}: Awaited<ReturnType<typeof loadShowBillingData>>): BillingRosterRow[] {
  const backByEntry = new Map<string, number[]>();
  for (const bn of backNumbers) {
    const list = backByEntry.get(bn.entry_id) ?? [];
    list.push(bn.number);
    backByEntry.set(bn.entry_id, list);
  }

  // Scratched classes don't count toward fees owed — matches the Entries
  // list page's "Class fees" total, which excludes them the same way.
  const feesByEntry = new Map<string, number>();
  for (const ec of entryClasses) {
    if (ec.status !== "entered") continue;
    feesByEntry.set(ec.entry_id, (feesByEntry.get(ec.entry_id) ?? 0) + ec.fee_cents);
  }

  const rows = new Map<string, BillingRosterRow>();
  const ridersByPerson = new Map<string, Set<string>>();
  for (const entry of entries) {
    const personId = billedPersonId(entry);
    const existing = rows.get(personId) ?? {
      personId,
      name: billedPersonName(entry),
      backNumbers: [],
      entryFeeCents: 0,
      miscChargeCents: 0,
      totalCents: 0,
      paidCents: 0,
      balanceCents: 0,
      billedRiderNames: [],
    };
    existing.entryFeeCents += feesByEntry.get(entry.id) ?? 0;
    existing.backNumbers.push(...(backByEntry.get(entry.id) ?? []));
    rows.set(personId, existing);

    if (entry.bill_to_trainer) {
      const riders = ridersByPerson.get(personId) ?? new Set<string>();
      riders.add(entry.rider_name);
      ridersByPerson.set(personId, riders);
    }
  }

  for (const charge of miscCharges) {
    const existing = rows.get(charge.person_id);
    if (existing) existing.miscChargeCents += charge.amount_cents;
    // A misc charge for a person with no entry at this show can't happen
    // today (add_misc_charge requires an existing org person, but there's
    // no UI path to charge someone with zero entries) — if it ever does,
    // it simply won't surface on the roster search until they have one.
  }

  for (const payment of payments) {
    const existing = rows.get(payment.person_id);
    if (existing) {
      existing.paidCents += payment.is_refund ? -payment.amount_cents : payment.amount_cents;
    }
  }

  return [...rows.values()]
    .map((r) => {
      const riders = ridersByPerson.get(r.personId);
      return {
        ...r,
        backNumbers: [...new Set(r.backNumbers)].sort((a, b) => a - b),
        totalCents: r.entryFeeCents + r.miscChargeCents,
        balanceCents: r.entryFeeCents + r.miscChargeCents - r.paidCents,
        billedRiderNames: riders && riders.size > 1 ? [...riders].sort() : [],
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface PersonBillLineItem {
  entryClassId: string;
  classNumber: number;
  className: string;
  status: "entered" | "scratched";
  feeCents: number;
  /** Set only on trainer/barn bills with more than one billed rider, so
   * the statement can show whose class fee each row is. */
  riderName: string | null;
}

export interface PersonBillCharge {
  id: string;
  description: string;
  category: string;
  amountCents: number;
  createdAt: string;
}

export interface PersonBillPayment {
  id: string;
  method: PaymentMethod;
  amountCents: number;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  isRefund: boolean;
  refundOfPaymentId: string | null;
  /** Sum of refunds already recorded against this payment (0 for refund
   * rows themselves). Used to cap/hide the Refund action once fully
   * refunded. */
  refundedCents: number;
}

export interface PersonBill {
  personId: string;
  name: string;
  backNumbers: number[];
  billedRiderNames: string[];
  lineItems: PersonBillLineItem[];
  charges: PersonBillCharge[];
  payments: PersonBillPayment[];
  entryFeeCents: number;
  miscChargeCents: number;
  totalCents: number;
  paidCents: number;
  refundedCents: number;
  balanceCents: number;
}

export async function loadPersonBill(
  supabase: SupabaseClient,
  showId: string,
  personId: string
): Promise<PersonBill | null> {
  return buildPersonBill(await loadShowBillingData(supabase, [showId]), personId);
}

/** One person's consolidated bill across an entire weekend (all slates). */
export async function loadWeekendPersonBill(
  supabase: SupabaseClient,
  weekendId: string,
  personId: string
): Promise<PersonBill | null> {
  const showIds = await loadWeekendShowIds(supabase, weekendId);
  return buildPersonBill(await loadShowBillingData(supabase, showIds), personId);
}

function buildPersonBill(
  {
    entries,
    entryClasses,
    backNumbers,
    miscCharges,
    payments,
  }: Awaited<ReturnType<typeof loadShowBillingData>>,
  personId: string
): PersonBill | null {

  const personEntries = entries.filter((e) => billedPersonId(e) === personId);
  if (personEntries.length === 0) return null;

  const distinctRiders = [...new Set(personEntries.map((e) => e.rider_name))];
  const riderNameByEntry = new Map(personEntries.map((e) => [e.id, e.rider_name]));
  const showRiderPerLine = distinctRiders.length > 1;

  const personEntryIds = new Set(personEntries.map((e) => e.id));
  const lineItems: PersonBillLineItem[] = entryClasses
    .filter((ec) => personEntryIds.has(ec.entry_id) && ec.class)
    .map((ec) => ({
      entryClassId: ec.id,
      classNumber: ec.class!.class_number,
      className: ec.class!.name,
      status: ec.status,
      feeCents: ec.fee_cents,
      riderName: showRiderPerLine ? (riderNameByEntry.get(ec.entry_id) ?? null) : null,
    }))
    .sort((a, b) => a.classNumber - b.classNumber);

  const backNums = [
    ...new Set(
      backNumbers.filter((bn) => personEntryIds.has(bn.entry_id)).map((bn) => bn.number)
    ),
  ].sort((a, b) => a - b);

  const charges: PersonBillCharge[] = miscCharges
    .filter((c) => c.person_id === personId)
    .map((c) => ({
      id: c.id,
      description: c.description,
      category: c.category,
      amountCents: c.amount_cents,
      createdAt: c.created_at,
    }));

  const refundedByOriginal = new Map<string, number>();
  for (const p of payments) {
    if (p.is_refund && p.refund_of_payment_id) {
      refundedByOriginal.set(
        p.refund_of_payment_id,
        (refundedByOriginal.get(p.refund_of_payment_id) ?? 0) + p.amount_cents
      );
    }
  }

  const personPayments: PersonBillPayment[] = payments
    .filter((p) => p.person_id === personId)
    .map((p) => ({
      id: p.id,
      method: p.method,
      amountCents: p.amount_cents,
      reference: p.reference,
      notes: p.notes,
      createdAt: p.created_at,
      isRefund: p.is_refund,
      refundOfPaymentId: p.refund_of_payment_id,
      refundedCents: refundedByOriginal.get(p.id) ?? 0,
    }));

  // Scratched classes are still listed (so staff can see what was scratched)
  // but don't count toward fees owed, matching the Entries list convention.
  const entryFeeCents = lineItems
    .filter((li) => li.status === "entered")
    .reduce((sum, li) => sum + li.feeCents, 0);
  const miscChargeCents = charges.reduce((sum, c) => sum + c.amountCents, 0);
  const receivedCents = personPayments
    .filter((p) => !p.isRefund)
    .reduce((sum, p) => sum + p.amountCents, 0);
  const refundedCents = personPayments
    .filter((p) => p.isRefund)
    .reduce((sum, p) => sum + p.amountCents, 0);
  const paidCents = receivedCents - refundedCents;

  return {
    personId,
    name: billedPersonName(personEntries[0]),
    backNumbers: backNums,
    billedRiderNames: showRiderPerLine ? distinctRiders.sort() : [],
    lineItems,
    charges,
    payments: personPayments,
    entryFeeCents,
    miscChargeCents,
    totalCents: entryFeeCents + miscChargeCents,
    paidCents,
    refundedCents,
    balanceCents: entryFeeCents + miscChargeCents - paidCents,
  };
}

export interface ReconciliationReport {
  /** Sum of entry fees for entered (non-scratched) rides. */
  entryFeeCents: number;
  enteredRideCount: number;
  /** Misc charges grouped by category, largest first. */
  chargesByCategory: { category: string; count: number; amountCents: number }[];
  miscChargeCents: number;
  totalChargedCents: number;
  /** Payments received grouped by method, largest first (refunds excluded). */
  paymentsByMethod: { method: PaymentMethod; count: number; amountCents: number }[];
  /** Net collected = received − refunded. */
  totalCollectedCents: number;
  refundedCents: number;
  /** Every billed person whose balance isn't zero. */
  openBalances: BillingRosterRow[];
  outstandingCents: number;
  overpaidCents: number;
}

/** End-of-show money reconciliation: what was charged, what came in by
 * method, and who still owes (or is owed). Everything is derived live
 * from the same data the roster uses — there is no separate ledger to
 * drift out of sync. */
export async function loadReconciliation(
  supabase: SupabaseClient,
  showId: string
): Promise<ReconciliationReport> {
  const raw = await loadShowBillingData(supabase, [showId]);
  const roster = buildRoster(raw);

  const entryFeeCents = roster.reduce((sum, r) => sum + r.entryFeeCents, 0);
  const enteredRideCount = raw.entryClasses.filter(
    (ec) => ec.status === "entered"
  ).length;

  const byCategory = new Map<string, { count: number; amountCents: number }>();
  for (const c of raw.miscCharges) {
    const bucket = byCategory.get(c.category) ?? { count: 0, amountCents: 0 };
    bucket.count += 1;
    bucket.amountCents += c.amount_cents;
    byCategory.set(c.category, bucket);
  }
  const chargesByCategory = [...byCategory.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.amountCents - a.amountCents);
  const miscChargeCents = chargesByCategory.reduce((s, c) => s + c.amountCents, 0);

  const byMethod = new Map<PaymentMethod, { count: number; amountCents: number }>();
  let refundedCents = 0;
  for (const p of raw.payments) {
    if (p.is_refund) {
      refundedCents += p.amount_cents;
      continue;
    }
    const bucket = byMethod.get(p.method) ?? { count: 0, amountCents: 0 };
    bucket.count += 1;
    bucket.amountCents += p.amount_cents;
    byMethod.set(p.method, bucket);
  }
  const paymentsByMethod = [...byMethod.entries()]
    .map(([method, v]) => ({ method, ...v }))
    .sort((a, b) => b.amountCents - a.amountCents);
  const receivedCents = paymentsByMethod.reduce((s, m) => s + m.amountCents, 0);
  const totalCollectedCents = receivedCents - refundedCents;

  const openBalances = roster.filter((r) => r.balanceCents !== 0);
  const outstandingCents = openBalances
    .filter((r) => r.balanceCents > 0)
    .reduce((s, r) => s + r.balanceCents, 0);
  const overpaidCents = openBalances
    .filter((r) => r.balanceCents < 0)
    .reduce((s, r) => s - r.balanceCents, 0);

  return {
    entryFeeCents,
    enteredRideCount,
    chargesByCategory,
    miscChargeCents,
    totalChargedCents: entryFeeCents + miscChargeCents,
    paymentsByMethod,
    totalCollectedCents,
    refundedCents,
    openBalances,
    outstandingCents,
    overpaidCents,
  };
}
