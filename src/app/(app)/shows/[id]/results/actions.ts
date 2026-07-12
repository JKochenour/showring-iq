"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  overridePlacingSchema,
  type OverridePlacingInput,
} from "@/lib/validation/result";
import {
  updatePayoutSettingsSchema,
  setRiderLevelSchema,
  type UpdatePayoutSettingsInput,
  type SetRiderLevelInput,
} from "@/lib/validation/payout";
import { sendEmail } from "@/lib/email";
import { resultsPostedEmail } from "@/lib/email-templates";
import { normalizePhone, sendSms } from "@/lib/sms";
import { formatCents } from "@/lib/money";
import { getSiteOrigin } from "@/lib/site-url";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ActionResult = { error?: string };

/** Emails each entrant with a person email on file when a class's results
 * are posted. Best-effort fan-out: failures log inside sendEmail and never
 * fail the publish. Idempotency keys make re-publishing after an unpublish
 * safe within Resend's 24h dedupe window. */
async function notifyResultsPosted(
  supabase: SupabaseClient,
  classId: string
): Promise<void> {
  const { data: cls } = await supabase
    .from("classes")
    .select("name, class_number, show_id, organization_id")
    .eq("id", classId)
    .maybeSingle();
  if (!cls) return;

  const [{ data: show }, { data: results }] = await Promise.all([
    supabase
      .from("shows")
      .select("name, slug, organization_id")
      .eq("id", cls.show_id)
      .maybeSingle(),
    supabase
      .from("results")
      .select("entry_class_id, placing, money_won_cents")
      .eq("class_id", classId),
  ]);
  if (!show || !results || results.length === 0) return;

  const { data: org } = await supabase
    .from("organizations")
    .select("slug")
    .eq("id", show.organization_id)
    .maybeSingle();
  const publicUrl = org?.slug
    ? `${await getSiteOrigin()}/${org.slug}/${show.slug}`
    : null;

  const entryClassIds = results.map((r) => r.entry_class_id as string);
  const { data: entryClasses } = await supabase
    .from("entry_classes")
    .select("id, entry_id")
    .in("id", entryClassIds);
  const entryIds = [...new Set((entryClasses ?? []).map((ec) => ec.entry_id as string))];
  if (entryIds.length === 0) return;

  const { data: entries } = await supabase
    .from("entries")
    .select("id, rider_name, horse_name, rider_person_id")
    .in("id", entryIds);
  const personIds = [
    ...new Set(
      (entries ?? [])
        .map((e) => e.rider_person_id as string | null)
        .filter((v): v is string => !!v)
    ),
  ];
  if (personIds.length === 0) return;

  const { data: people } = await supabase
    .from("people")
    .select("id, email, phone")
    .in("id", personIds);
  const emailByPerson = new Map(
    (people ?? [])
      .filter((p) => !!p.email)
      .map((p) => [p.id as string, p.email as string])
  );
  const phoneByPerson = new Map(
    (people ?? [])
      .map((p) => [p.id as string, normalizePhone(p.phone as string | null)] as const)
      .filter((pair): pair is readonly [string, string] => !!pair[1])
  );
  const entryById = new Map((entries ?? []).map((e) => [e.id as string, e]));
  const entryIdByEntryClass = new Map(
    (entryClasses ?? []).map((ec) => [ec.id as string, ec.entry_id as string])
  );

  for (const r of results) {
    const entry = entryById.get(entryIdByEntryClass.get(r.entry_class_id as string) ?? "");
    if (!entry?.rider_person_id) continue;
    const personId = entry.rider_person_id as string;
    const placing = (r.placing as number | null) ?? null;
    const moneyWonCents = (r.money_won_cents as number) ?? 0;

    const to = emailByPerson.get(personId);
    if (to) {
      const email = resultsPostedEmail({
        showName: show.name as string,
        className: cls.name as string,
        classNumber: cls.class_number as number,
        riderName: entry.rider_name as string,
        horseName: entry.horse_name as string,
        placing,
        moneyWonCents,
        publicUrl,
      });
      await sendEmail({
        to,
        subject: email.subject,
        html: email.html,
        idempotencyKey: `results-posted/${r.entry_class_id}`,
      });
    }

    const phone = phoneByPerson.get(personId);
    if (phone) {
      const placingPart = placing
        ? `${entry.horse_name}: ${placing}${ordinal(placing)}${moneyWonCents > 0 ? `, ${formatCents(moneyWonCents)} won` : ""}`
        : `${entry.horse_name}: results posted`;
      await sendSms(
        phone,
        `${show.name} — Class ${cls.class_number} ${cls.name}. ${placingPart}.${publicUrl ? ` ${publicUrl}` : ""}`
      );
    }
  }
}

function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return "th";
  return { 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th";
}

function revalidateResults(showId: string, classId: string) {
  revalidatePath(`/shows/${showId}/results`);
  revalidatePath(`/shows/${showId}/results/${classId}`);
  revalidatePath(`/shows/${showId}/classes`);
}

export async function resolveTie(
  entryClassId: string,
  resolution: "co_champions" | "run_off_completed",
  note: string,
  showId: string,
  classId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_tie", {
    p_entry_class: entryClassId,
    p_resolution: resolution,
    p_note: note || null,
  });
  if (error) return { error: error.message };

  revalidateResults(showId, classId);
  return {};
}

export async function calculateResults(
  classId: string,
  showId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("calculate_results", {
    p_class: classId,
  });
  if (error) return { error: error.message };

  revalidateResults(showId, classId);
  return {};
}

export async function publishResults(
  classId: string,
  showId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("publish_results", { p_class: classId });
  if (error) return { error: error.message };

  await notifyResultsPosted(supabase, classId);

  revalidateResults(showId, classId);
  return {};
}

export async function unpublishResults(
  classId: string,
  showId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("unpublish_results", {
    p_class: classId,
  });
  if (error) return { error: error.message };

  revalidateResults(showId, classId);
  return {};
}

export async function updatePayoutSettings(
  input: UpdatePayoutSettingsInput,
  showId: string
): Promise<ActionResult> {
  const parsed = updatePayoutSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("classes")
    .update({
      retainage_percent: d.retainagePercent,
      payout_schedule: d.schedule,
    })
    .eq("id", d.classId)
    .select("id");

  if (error) return { error: error.message };
  if (!updated || updated.length === 0) {
    return {
      error:
        "Update was not applied. It requires the class.edit permission on an unlocked show.",
    };
  }

  revalidateResults(showId, d.classId);
  return {};
}

export async function calculatePayouts(
  classId: string,
  showId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("calculate_payouts", {
    p_class: classId,
  });
  if (error) return { error: error.message };

  revalidateResults(showId, classId);
  return {};
}

export async function calculateSinglePursePayouts(
  classId: string,
  showId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("calculate_single_purse_payouts", {
    p_class: classId,
  });
  if (error) return { error: error.message };

  revalidateResults(showId, classId);
  return {};
}

export async function setRiderLevel(
  input: SetRiderLevelInput,
  showId: string,
  classId: string
): Promise<ActionResult> {
  const parsed = setRiderLevelSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_rider_level", {
    p_entry_class: d.entryClassId,
    p_level: d.level,
  });
  if (error) return { error: error.message };

  revalidateResults(showId, classId);
  return {};
}

export async function approvePayouts(
  classId: string,
  showId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_payouts", {
    p_class: classId,
  });
  if (error) return { error: error.message };

  revalidateResults(showId, classId);
  return {};
}

export async function overridePlacing(
  input: OverridePlacingInput,
  showId: string,
  classId: string
): Promise<ActionResult> {
  const parsed = overridePlacingSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("override_placing", {
    p_entry_class: d.entryClassId,
    p_placing: d.placing,
    p_reason: d.reason,
  });
  if (error) return { error: error.message };

  revalidateResults(showId, classId);
  return {};
}
