"use server";

import { createClient } from "@/lib/supabase/server";
import { hasOrgPermission } from "@/lib/authz";
import { sendEmail } from "@/lib/email";
import { announcementEmail } from "@/lib/email-templates";
import { normalizePhone, sendSms } from "@/lib/sms";
import { sendAnnouncementSchema, type SendAnnouncementInput } from "@/lib/validation/announcement";

export type SendAnnouncementResult = {
  error?: string;
  emailsSent?: number;
  textsSent?: number;
  recipientCount?: number;
};

/** Broadcasts a message to every distinct rider/owner entered in the
 * show, over email and/or SMS via the existing (already-optional,
 * skip-if-unconfigured) notification libs. Best-effort per recipient —
 * one bad address never blocks the rest. Not queued/scheduled; sends
 * synchronously when triggered. */
export async function sendAnnouncement(
  input: SendAnnouncementInput
): Promise<SendAnnouncementResult> {
  const parsed = sendAnnouncementSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { data: show } = await supabase
    .from("shows")
    .select("id, organization_id, name")
    .eq("id", d.showId)
    .maybeSingle();
  if (!show) return { error: "Show not found." };

  const canSend = await hasOrgPermission(show.organization_id, "show.edit");
  if (!canSend) return { error: "Missing permission: show.edit" };

  const { data: entries } = await supabase
    .from("entries")
    .select("rider_person_id, owner_person_id")
    .eq("show_id", d.showId)
    .eq("status", "active");

  const personIds = [
    ...new Set(
      (entries ?? []).flatMap((e) =>
        [e.rider_person_id, e.owner_person_id].filter((v): v is string => !!v)
      )
    ),
  ];
  if (personIds.length === 0) {
    return { error: "No active entries in this show yet.", recipientCount: 0 };
  }

  const { data: people } = await supabase
    .from("people")
    .select("id, email, phone")
    .in("id", personIds);

  const email = announcementEmail({
    showName: show.name as string,
    subject: d.subject,
    body: d.body,
  });

  let emailsSent = 0;
  let textsSent = 0;

  for (const p of people ?? []) {
    if (d.sendEmail && p.email) {
      const result = await sendEmail({
        to: p.email as string,
        subject: email.subject,
        html: email.html,
      });
      if (result.sent) emailsSent++;
    }
    if (d.sendSms) {
      const phone = normalizePhone(p.phone as string | null);
      if (phone) {
        const result = await sendSms(phone, `${show.name}: ${d.subject} — ${d.body}`);
        if (result.sent) textsSent++;
      }
    }
  }

  await supabase.rpc("log_audit", {
    p_org: show.organization_id,
    p_action: "announcement.sent",
    p_entity_type: "show",
    p_entity_id: d.showId,
    p_old: null,
    p_new: {
      subject: d.subject,
      recipient_count: (people ?? []).length,
      emails_sent: emailsSent,
      texts_sent: textsSent,
    },
    p_show: d.showId,
  });

  return { recipientCount: (people ?? []).length, emailsSent, textsSent };
}
