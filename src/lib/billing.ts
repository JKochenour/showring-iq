import type { SupabaseClient } from "@supabase/supabase-js";

/** Who a given entry bills: the owner if one is set (they aren't
 * necessarily riding), otherwise the rider. */
function billedPersonId(entry: {
  rider_person_id: string;
  owner_person_id: string | null;
}): string {
  return entry.owner_person_id ?? entry.rider_person_id;
}

function billedPersonName(entry: {
  rider_name: string;
  owner_name: string | null;
  owner_person_id: string | null;
}): string {
  return entry.owner_person_id ? (entry.owner_name ?? entry.rider_name) : entry.rider_name;
}

interface RawEntry {
  id: string;
  rider_person_id: string;
  rider_name: string;
  owner_person_id: string | null;
  owner_name: string | null;
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
}

async function loadShowBillingData(supabase: SupabaseClient, showId: string) {
  const [
    { data: entries },
    { data: entryClasses },
    { data: backNumbers },
    { data: miscCharges },
    { data: payments },
  ] = await Promise.all([
    supabase
      .from("entries")
      .select("id, rider_person_id, rider_name, owner_person_id, owner_name, status")
      .eq("show_id", showId),
    supabase
      .from("entry_classes")
      .select("id, entry_id, fee_cents, status, class:classes(class_number, name)")
      .eq("show_id", showId),
    supabase.from("back_numbers").select("entry_id, number").eq("show_id", showId),
    supabase
      .from("misc_charges")
      .select("id, person_id, description, category, amount_cents, created_at")
      .eq("show_id", showId)
      .order("created_at", { ascending: false }),
    supabase
      .from("payments")
      .select("id, person_id, method, amount_cents, reference, notes, created_at")
      .eq("show_id", showId)
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
}

export async function loadShowBillingRoster(
  supabase: SupabaseClient,
  showId: string
): Promise<BillingRosterRow[]> {
  const { entries, entryClasses, backNumbers, miscCharges, payments } =
    await loadShowBillingData(supabase, showId);

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
    };
    existing.entryFeeCents += feesByEntry.get(entry.id) ?? 0;
    existing.backNumbers.push(...(backByEntry.get(entry.id) ?? []));
    rows.set(personId, existing);
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
    if (existing) existing.paidCents += payment.amount_cents;
  }

  return [...rows.values()]
    .map((r) => ({
      ...r,
      backNumbers: [...new Set(r.backNumbers)].sort((a, b) => a - b),
      totalCents: r.entryFeeCents + r.miscChargeCents,
      balanceCents: r.entryFeeCents + r.miscChargeCents - r.paidCents,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface PersonBillLineItem {
  entryClassId: string;
  classNumber: number;
  className: string;
  status: "entered" | "scratched";
  feeCents: number;
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
}

export interface PersonBill {
  personId: string;
  name: string;
  backNumbers: number[];
  lineItems: PersonBillLineItem[];
  charges: PersonBillCharge[];
  payments: PersonBillPayment[];
  entryFeeCents: number;
  miscChargeCents: number;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
}

export async function loadPersonBill(
  supabase: SupabaseClient,
  showId: string,
  personId: string
): Promise<PersonBill | null> {
  const { entries, entryClasses, backNumbers, miscCharges, payments } =
    await loadShowBillingData(supabase, showId);

  const personEntries = entries.filter((e) => billedPersonId(e) === personId);
  if (personEntries.length === 0) return null;

  const personEntryIds = new Set(personEntries.map((e) => e.id));
  const lineItems: PersonBillLineItem[] = entryClasses
    .filter((ec) => personEntryIds.has(ec.entry_id) && ec.class)
    .map((ec) => ({
      entryClassId: ec.id,
      classNumber: ec.class!.class_number,
      className: ec.class!.name,
      status: ec.status,
      feeCents: ec.fee_cents,
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

  const personPayments: PersonBillPayment[] = payments
    .filter((p) => p.person_id === personId)
    .map((p) => ({
      id: p.id,
      method: p.method,
      amountCents: p.amount_cents,
      reference: p.reference,
      notes: p.notes,
      createdAt: p.created_at,
    }));

  // Scratched classes are still listed (so staff can see what was scratched)
  // but don't count toward fees owed, matching the Entries list convention.
  const entryFeeCents = lineItems
    .filter((li) => li.status === "entered")
    .reduce((sum, li) => sum + li.feeCents, 0);
  const miscChargeCents = charges.reduce((sum, c) => sum + c.amountCents, 0);
  const paidCents = personPayments.reduce((sum, p) => sum + p.amountCents, 0);

  return {
    personId,
    name: billedPersonName(personEntries[0]),
    backNumbers: backNums,
    lineItems,
    charges,
    payments: personPayments,
    entryFeeCents,
    miscChargeCents,
    totalCents: entryFeeCents + miscChargeCents,
    paidCents,
    balanceCents: entryFeeCents + miscChargeCents - paidCents,
  };
}
