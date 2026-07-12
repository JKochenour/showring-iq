import { Resend } from "resend";

/**
 * Thin Resend wrapper for transactional email. Server-side only.
 *
 * Configuration (both optional — the app never requires email to function):
 * - RESEND_API_KEY: without it, sends are skipped and logged to the server
 *   console so every flow stays testable with no credentials.
 * - RESEND_FROM: verified sender, e.g. "ShowRing IQ <shows@yourdomain.com>".
 *   Defaults to Resend's sandbox sender, which can only deliver to the
 *   Resend account owner's own email — fine for trying it out, useless in
 *   production, so set both together.
 *
 * Failures are reported in the return value, never thrown — notification
 * email must never break the flow that triggered it (an entry that saved
 * but didn't email is fine; an entry that failed because email hiccuped
 * is not).
 */

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  /** Resend idempotency key, "<event-type>/<entity-id>" — prevents
   * duplicate sends when an action retries. 24h dedupe window. */
  idempotencyKey?: string;
}

export interface SendEmailResult {
  sent: boolean;
  skipped?: boolean;
  error?: string;
}

let client: Resend | null = null;

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(
      `[email skipped — RESEND_API_KEY not set] to=${input.to} subject="${input.subject}"`
    );
    return { sent: false, skipped: true };
  }

  client ??= new Resend(apiKey);
  const from = process.env.RESEND_FROM ?? "ShowRing IQ <onboarding@resend.dev>";

  const { error } = await client.emails.send(
    { from, to: [input.to], subject: input.subject, html: input.html },
    input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined
  );

  if (error) {
    console.error(
      `[email failed] to=${input.to} subject="${input.subject}": ${error.message}`
    );
    return { sent: false, error: error.message };
  }
  return { sent: true };
}
