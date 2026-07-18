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
  show_id: string;
  horse_id: string;
  horse_name: string | null;
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
  class: {
    class_number: number;
    name: string;
    concurrent_group_id: string | null;
    judge_fee_cents: number;
  } | null;
}

interface RawMiscCharge {
  id: string;
  /** Charges belong to one slate even when shown on a weekend total. */
  show_id: string;
  person_id: string;
  entry_id: string | null;
  description: string;
  category: string;
  amount_cents: number;
  /** Null on rows written before 00054. */
  quantity: number | null;
  unit_amount_cents: number | null;
  created_at: string;
}

/** A show's per-run standard charge (e.g. Video, Photo) — charged once per
 * run (concurrent group), not per class. */
interface PerRunCharge {
  label: string;
  amountCents: number;
}

interface RawRunFeeOverride {
  entry_id: string;
  fee_key: string;
  amount_cents: number;
}

export const JUDGE_FEE_KEY = "judge";

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

/** One computed run fee for one entry: judge (max in each run, summed) or a
 * per-run standard charge (amount × run count). The override, when set,
 * replaces the computed total for that (entry, feeKey). */
export interface RunFeeLine {
  entryId: string;
  backNumber: number | null;
  feeKey: string;
  label: string;
  /** The run(s) this fee covers, e.g. "Open + Intermediate Open · Reining" —
   * concurrent classes joined with +, distinct runs separated with ·. Shown
   * next to the fee so a rider can see which classes it stems from. */
  detail?: string;
  /** Number of runs (physical arena trips) this entry makes. */
  runCount: number;
  computedCents: number;
  overrideCents: number | null;
  effectiveCents: number;
}

/**
 * Run-level fees for one entry. An entry's entered classes are partitioned
 * into runs by classes.concurrent_group_id (each ungrouped class is its own
 * run). Per run: the judge fee is the highest among the run's classes, and
 * each per-run standard charge (video/photo) applies once. Overrides replace
 * the computed total for a fee_key. Exported for unit testing.
 */
export function computeEntryRunFees(
  enteredClasses: {
    concurrentGroupId: string | null;
    judgeFeeCents: number;
    className?: string;
  }[],
  perRunCharges: PerRunCharge[],
  overrides: Map<string, number>
): { lines: Omit<RunFeeLine, "entryId" | "backNumber">[]; totalCents: number } {
  // Partition into runs, tracking each run's class names for the bill detail.
  const runJudgeMax: number[] = [];
  const runClassNames: string[][] = [];
  const groupToRun = new Map<string, number>();
  for (const c of enteredClasses) {
    let runIdx: number;
    if (c.concurrentGroupId && groupToRun.has(c.concurrentGroupId)) {
      runIdx = groupToRun.get(c.concurrentGroupId)!;
    } else {
      runIdx = runJudgeMax.length;
      runJudgeMax.push(0);
      runClassNames.push([]);
      if (c.concurrentGroupId) groupToRun.set(c.concurrentGroupId, runIdx);
    }
    runJudgeMax[runIdx] = Math.max(runJudgeMax[runIdx], c.judgeFeeCents);
    if (c.className) runClassNames[runIdx].push(c.className);
  }
  const runCount = runJudgeMax.length;

  // "Open + Intermediate Open · Reining": concurrent classes joined with +,
  // distinct runs separated with · — shows which classes a per-run fee covers.
  const detail =
    runClassNames.map((names) => names.join(" + ")).filter(Boolean).join(" · ") ||
    undefined;

  const lines: Omit<RunFeeLine, "entryId" | "backNumber">[] = [];

  const judgeComputed = runJudgeMax.reduce((s, m) => s + m, 0);
  const judgeOverride = overrides.has(JUDGE_FEE_KEY) ? overrides.get(JUDGE_FEE_KEY)! : null;
  if (judgeComputed > 0 || judgeOverride !== null) {
    lines.push({
      feeKey: JUDGE_FEE_KEY,
      label: "Judge fee",
      detail,
      runCount,
      computedCents: judgeComputed,
      overrideCents: judgeOverride,
      effectiveCents: judgeOverride ?? judgeComputed,
    });
  }

  for (const charge of perRunCharges) {
    const computed = runCount * charge.amountCents;
    const override = overrides.has(charge.label) ? overrides.get(charge.label)! : null;
    if (computed > 0 || override !== null) {
      lines.push({
        feeKey: charge.label,
        label: charge.label,
        detail,
        runCount,
        computedCents: computed,
        overrideCents: override,
        effectiveCents: override ?? computed,
      });
    }
  }

  const totalCents = lines.reduce((s, l) => s + l.effectiveCents, 0);
  return { lines, totalCents };
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
  const empty = {
    entries: [] as RawEntry[],
    entryClasses: [] as RawEntryClass[],
    backNumbers: [] as { entry_id: string; number: number }[],
    miscCharges: [] as RawMiscCharge[],
    payments: [] as RawPayment[],
    perRunByShow: new Map<string, PerRunCharge[]>(),
    showNameById: new Map<string, string>(),
    overrides: [] as RawRunFeeOverride[],
  };
  if (showIds.length === 0) return empty;

  const { data: entriesData } = await supabase
    .from("entries")
    .select(
      "id, show_id, horse_id, horse_name, rider_person_id, rider_name, owner_person_id, owner_name, trainer_person_id, trainer_name, bill_to_trainer, status"
    )
    .in("show_id", showIds);
  const entries = (entriesData as RawEntry[]) ?? [];
  const entryIds = entries.map((e) => e.id);

  const [
    { data: entryClasses },
    { data: backNumbers },
    { data: miscCharges },
    { data: payments },
    { data: shows },
    overridesRes,
  ] = await Promise.all([
    supabase
      .from("entry_classes")
      .select(
        "id, entry_id, fee_cents, status, class:classes(class_number, name, concurrent_group_id, judge_fee_cents)"
      )
      .in("show_id", showIds),
    supabase.from("back_numbers").select("entry_id, number").in("show_id", showIds),
    supabase
      .from("misc_charges")
      .select(
        "id, show_id, person_id, entry_id, description, category, amount_cents, quantity, unit_amount_cents, created_at"
      )
      .in("show_id", showIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("payments")
      .select(
        "id, person_id, method, amount_cents, reference, notes, created_at, is_refund, refund_of_payment_id"
      )
      .in("show_id", showIds)
      .order("created_at", { ascending: false }),
    supabase.from("shows").select("id, name, standard_entry_charges").in("id", showIds),
    entryIds.length > 0
      ? supabase
          .from("entry_run_fee_overrides")
          .select("entry_id, fee_key, amount_cents")
          .in("entry_id", entryIds)
      : Promise.resolve({ data: [] as RawRunFeeOverride[] }),
  ]);

  const perRunByShow = new Map<string, PerRunCharge[]>();
  const showNameById = new Map<string, string>();
  for (const s of (shows as { id: string; name: string; standard_entry_charges: { label: string; amount_cents: number; per_run?: boolean }[] }[]) ?? []) {
    showNameById.set(s.id, s.name);
    const perRun = (s.standard_entry_charges ?? [])
      .filter((c) => c.per_run === true && c.label?.trim() && c.amount_cents > 0)
      .map((c) => ({ label: c.label.trim(), amountCents: c.amount_cents }));
    perRunByShow.set(s.id, perRun);
  }

  return {
    entries,
    entryClasses: (entryClasses as unknown as RawEntryClass[]) ?? [],
    backNumbers: (backNumbers as { entry_id: string; number: number }[]) ?? [],
    miscCharges: (miscCharges as RawMiscCharge[]) ?? [],
    payments: (payments as RawPayment[]) ?? [],
    perRunByShow,
    showNameById,
    overrides: (overridesRes.data as RawRunFeeOverride[]) ?? [],
  };
}

type BillingData = Awaited<ReturnType<typeof loadShowBillingData>>;

/** Build, per entry, its entered classes + the run-fee lines for it, keyed by
 * entry id. Shared by the roster and the per-person bill. */
function runFeesByEntry(data: BillingData): Map<string, RunFeeLine[]> {
  const enteredByEntry = new Map<
    string,
    { concurrentGroupId: string | null; judgeFeeCents: number; className: string }[]
  >();
  for (const ec of data.entryClasses) {
    if (ec.status !== "entered" || !ec.class) continue;
    const list = enteredByEntry.get(ec.entry_id) ?? [];
    list.push({
      concurrentGroupId: ec.class.concurrent_group_id,
      judgeFeeCents: ec.class.judge_fee_cents ?? 0,
      className: ec.class.name,
    });
    enteredByEntry.set(ec.entry_id, list);
  }

  const overridesByEntry = new Map<string, Map<string, number>>();
  for (const o of data.overrides) {
    const m = overridesByEntry.get(o.entry_id) ?? new Map<string, number>();
    m.set(o.fee_key, o.amount_cents);
    overridesByEntry.set(o.entry_id, m);
  }

  const backByEntry = new Map<string, number>();
  for (const bn of data.backNumbers) {
    if (!backByEntry.has(bn.entry_id)) backByEntry.set(bn.entry_id, bn.number);
  }

  const showByEntry = new Map(data.entries.map((e) => [e.id, e.show_id]));

  const result = new Map<string, RunFeeLine[]>();
  // Cover every entry (an entry with an override but no entered class still
  // shows the overridden line), plus every entry that has entered classes.
  const entryIds = new Set<string>([...enteredByEntry.keys(), ...overridesByEntry.keys()]);
  for (const entryId of entryIds) {
    const showId = showByEntry.get(entryId);
    if (!showId) continue;
    const perRun = data.perRunByShow.get(showId) ?? [];
    const { lines } = computeEntryRunFees(
      enteredByEntry.get(entryId) ?? [],
      perRun,
      overridesByEntry.get(entryId) ?? new Map()
    );
    if (lines.length === 0) continue;
    result.set(
      entryId,
      lines.map((l) => ({ ...l, entryId, backNumber: backByEntry.get(entryId) ?? null }))
    );
  }
  return result;
}

export interface BillingRosterRow {
  personId: string;
  name: string;
  backNumbers: number[];
  entryFeeCents: number;
  miscChargeCents: number;
  runFeeCents: number;
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

function buildRoster(data: BillingData): BillingRosterRow[] {
  const { entries, entryClasses, backNumbers, miscCharges, payments } = data;

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

  const runFees = runFeesByEntry(data);
  const runFeeByEntry = new Map<string, number>();
  for (const [entryId, lines] of runFees) {
    runFeeByEntry.set(entryId, lines.reduce((s, l) => s + l.effectiveCents, 0));
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
      runFeeCents: 0,
      totalCents: 0,
      paidCents: 0,
      balanceCents: 0,
      billedRiderNames: [],
    };
    existing.entryFeeCents += feesByEntry.get(entry.id) ?? 0;
    existing.runFeeCents += runFeeByEntry.get(entry.id) ?? 0;
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
      const totalCents = r.entryFeeCents + r.miscChargeCents + r.runFeeCents;
      return {
        ...r,
        backNumbers: [...new Set(r.backNumbers)].sort((a, b) => a - b),
        totalCents,
        balanceCents: totalCents - r.paidCents,
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
  /** The slate this charge sits on — the weekend view spans several. */
  showId: string;
  description: string;
  category: string;
  /** The line total. Always authoritative, including for legacy rows
   * that predate quantity. */
  amountCents: number;
  quantity: number;
  /** Null on legacy rows, and treated as null once the price has been
   * overridden — see unitPriceHolds(). */
  unitAmountCents: number | null;
  createdAt: string;
}

/** Whether a charge's quantity x unit price still explains its total.
 * An "Edit price" override rewrites amount_cents only, so a stale unit
 * price must not be shown multiplying out to the wrong number. */
export function unitPriceHolds(charge: {
  amountCents: number;
  quantity: number;
  unitAmountCents: number | null;
}): boolean {
  return (
    charge.unitAmountCents !== null &&
    charge.quantity > 1 &&
    charge.unitAmountCents * charge.quantity === charge.amountCents
  );
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
  runFees: RunFeeLine[];
  charges: PersonBillCharge[];
  payments: PersonBillPayment[];
  entryFeeCents: number;
  runFeeCents: number;
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

function buildPersonBill(data: BillingData, personId: string): PersonBill | null {
  const { entries, entryClasses, backNumbers, miscCharges, payments } = data;

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

  const runFeesAll = runFeesByEntry(data);
  const runFees: RunFeeLine[] = [...personEntryIds]
    .flatMap((id) => runFeesAll.get(id) ?? [])
    .sort((a, b) => (a.backNumber ?? 0) - (b.backNumber ?? 0) || a.label.localeCompare(b.label));

  const backNums = [
    ...new Set(
      backNumbers.filter((bn) => personEntryIds.has(bn.entry_id)).map((bn) => bn.number)
    ),
  ].sort((a, b) => a - b);

  const charges: PersonBillCharge[] = miscCharges
    .filter((c) => c.person_id === personId)
    .map((c) => ({
      id: c.id,
      showId: c.show_id,
      description: c.description,
      category: c.category,
      amountCents: c.amount_cents,
      quantity: c.quantity ?? 1,
      unitAmountCents: c.unit_amount_cents ?? null,
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
  const runFeeCents = runFees.reduce((sum, l) => sum + l.effectiveCents, 0);
  const miscChargeCents = charges.reduce((sum, c) => sum + c.amountCents, 0);
  const receivedCents = personPayments
    .filter((p) => !p.isRefund)
    .reduce((sum, p) => sum + p.amountCents, 0);
  const refundedCents = personPayments
    .filter((p) => p.isRefund)
    .reduce((sum, p) => sum + p.amountCents, 0);
  const paidCents = receivedCents - refundedCents;
  const totalCents = entryFeeCents + runFeeCents + miscChargeCents;

  return {
    personId,
    name: billedPersonName(personEntries[0]),
    backNumbers: backNums,
    billedRiderNames: showRiderPerLine ? distinctRiders.sort() : [],
    lineItems,
    runFees,
    charges,
    payments: personPayments,
    entryFeeCents,
    runFeeCents,
    miscChargeCents,
    totalCents,
    paidCents,
    refundedCents,
    balanceCents: totalCents - paidCents,
  };
}

// ── Itemized statement, grouped by horse (Back #) → slate ──────────────
// Mirrors EPRHA's real printed statement: each horse's fees itemized under
// its back number, split by slate, with a Total Fees / amount due footer.

export interface StatementRow {
  qty: number;
  description: string;
  exhibitor: string | null;
  amountCents: number;
  /** Scratched class fee — shown struck, excluded from subtotals. */
  struck: boolean;
}

export interface StatementSlate {
  showId: string;
  showLabel: string;
  rows: StatementRow[];
  subtotalCents: number;
}

export interface StatementHorse {
  backNumber: number | null;
  horseName: string | null;
  slates: StatementSlate[];
}

export interface PersonStatement {
  personId: string;
  name: string;
  billedRiderNames: string[];
  horses: StatementHorse[];
  /** Person-level charges not tied to a horse (e.g. a hand-added camper). */
  otherCharges: StatementRow[];
  otherChargesCents: number;
  totalFeesCents: number;
  payments: PersonBillPayment[];
  paidCents: number;
  refundedCents: number;
  balanceCents: number;
}

function mapPersonPayments(
  payments: RawPayment[],
  personId: string
): { payments: PersonBillPayment[]; paidCents: number; refundedCents: number } {
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
  const received = personPayments.filter((p) => !p.isRefund).reduce((s, p) => s + p.amountCents, 0);
  const refundedCents = personPayments.filter((p) => p.isRefund).reduce((s, p) => s + p.amountCents, 0);
  return { payments: personPayments, paidCents: received - refundedCents, refundedCents };
}

function buildPersonStatement(data: BillingData, personId: string): PersonStatement | null {
  const { entries, entryClasses, backNumbers, miscCharges, payments, showNameById } = data;

  const personEntries = entries.filter((e) => billedPersonId(e) === personId);
  if (personEntries.length === 0) return null;
  const personEntryIds = new Set(personEntries.map((e) => e.id));

  const backByEntry = new Map<string, number>();
  for (const bn of backNumbers) if (!backByEntry.has(bn.entry_id)) backByEntry.set(bn.entry_id, bn.number);

  const ecByEntry = new Map<string, RawEntryClass[]>();
  for (const ec of entryClasses) {
    if (!personEntryIds.has(ec.entry_id) || !ec.class) continue;
    const list = ecByEntry.get(ec.entry_id) ?? [];
    list.push(ec);
    ecByEntry.set(ec.entry_id, list);
  }

  const runFeesAll = runFeesByEntry(data);

  const miscByEntry = new Map<string, RawMiscCharge[]>();
  const otherChargesRaw: RawMiscCharge[] = [];
  for (const c of miscCharges) {
    if (c.person_id !== personId) continue;
    if (c.entry_id && personEntryIds.has(c.entry_id)) {
      const list = miscByEntry.get(c.entry_id) ?? [];
      list.push(c);
      miscByEntry.set(c.entry_id, list);
    } else {
      otherChargesRaw.push(c);
    }
  }

  const horseMap = new Map<string, StatementHorse>();
  const sortedEntries = [...personEntries].sort(
    (a, b) =>
      (backByEntry.get(a.id) ?? 0) - (backByEntry.get(b.id) ?? 0) ||
      (showNameById.get(a.show_id) ?? "").localeCompare(showNameById.get(b.show_id) ?? "")
  );

  for (const entry of sortedEntries) {
    const rows: StatementRow[] = [];

    // Standard charges applied to this horse (office/stall/drug), oldest first.
    for (const c of (miscByEntry.get(entry.id) ?? []).slice().reverse()) {
      rows.push({
        qty: c.quantity ?? 1,
        description: c.description,
        exhibitor: null,
        amountCents: c.amount_cents,
        struck: false,
      });
    }

    // Entry fee per class.
    const ecs = (ecByEntry.get(entry.id) ?? [])
      .slice()
      .sort((a, b) => a.class!.class_number - b.class!.class_number);
    for (const ec of ecs) {
      rows.push({
        qty: 1,
        description: `${ec.class!.class_number} — ${ec.class!.name} entry`,
        exhibitor: entry.rider_name,
        amountCents: ec.fee_cents,
        struck: ec.status !== "entered",
      });
    }

    // Run fees (judge / video / photo) for this slate's runs.
    for (const rf of runFeesAll.get(entry.id) ?? []) {
      rows.push({
        qty: rf.feeKey === JUDGE_FEE_KEY ? 1 : rf.runCount,
        description: rf.detail ? `${rf.label} — ${rf.detail}` : rf.label,
        exhibitor: entry.rider_name,
        amountCents: rf.effectiveCents,
        struck: false,
      });
    }

    const subtotalCents = rows.filter((r) => !r.struck).reduce((s, r) => s + r.amountCents, 0);
    const slate: StatementSlate = {
      showId: entry.show_id,
      showLabel: showNameById.get(entry.show_id) ?? "",
      rows,
      subtotalCents,
    };

    const horseKey = backByEntry.has(entry.id) ? `bn:${backByEntry.get(entry.id)}` : `h:${entry.horse_id}`;
    let horse = horseMap.get(horseKey);
    if (!horse) {
      horse = { backNumber: backByEntry.get(entry.id) ?? null, horseName: entry.horse_name, slates: [] };
      horseMap.set(horseKey, horse);
    }
    horse.slates.push(slate);
  }

  const horses = [...horseMap.values()].sort((a, b) => (a.backNumber ?? 0) - (b.backNumber ?? 0));

  const otherCharges: StatementRow[] = otherChargesRaw
    .slice()
    .reverse()
    .map((c) => ({
      qty: c.quantity ?? 1,
      description: c.description,
      exhibitor: null,
      amountCents: c.amount_cents,
      struck: false,
    }));
  const otherChargesCents = otherCharges.reduce((s, r) => s + r.amountCents, 0);

  const totalFeesCents =
    horses.reduce((s, h) => s + h.slates.reduce((ss, sl) => ss + sl.subtotalCents, 0), 0) + otherChargesCents;

  const distinctRiders = [...new Set(personEntries.map((e) => e.rider_name))];
  const { payments: personPayments, paidCents, refundedCents } = mapPersonPayments(payments, personId);

  return {
    personId,
    name: billedPersonName(personEntries[0]),
    billedRiderNames: distinctRiders.length > 1 ? distinctRiders.sort() : [],
    horses,
    otherCharges,
    otherChargesCents,
    totalFeesCents,
    payments: personPayments,
    paidCents,
    refundedCents,
    balanceCents: totalFeesCents - paidCents,
  };
}

export async function loadPersonStatement(
  supabase: SupabaseClient,
  showId: string,
  personId: string
): Promise<PersonStatement | null> {
  return buildPersonStatement(await loadShowBillingData(supabase, [showId]), personId);
}

export async function loadWeekendPersonStatement(
  supabase: SupabaseClient,
  weekendId: string,
  personId: string
): Promise<PersonStatement | null> {
  const showIds = await loadWeekendShowIds(supabase, weekendId);
  return buildPersonStatement(await loadShowBillingData(supabase, showIds), personId);
}

export interface ReconciliationReport {
  /** Sum of entry fees for entered (non-scratched) rides. */
  entryFeeCents: number;
  enteredRideCount: number;
  /** Misc charges + computed run fees grouped by category, largest first. */
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
  // Fold computed run fees into the category breakdown so the report is whole
  // even though they aren't materialized as misc_charges. Each RunFeeLine
  // covers ALL of an entry's runs for one fee type, so count runs — the "N×"
  // shown for Judge fee/Video should be physical runs, not entries.
  for (const lines of runFeesByEntry(raw).values()) {
    for (const l of lines) {
      if (l.effectiveCents === 0) continue;
      const bucket = byCategory.get(l.label) ?? { count: 0, amountCents: 0 };
      bucket.count += l.runCount;
      bucket.amountCents += l.effectiveCents;
      byCategory.set(l.label, bucket);
    }
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
