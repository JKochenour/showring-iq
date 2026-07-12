/**
 * Thin Twilio SMS wrapper. Server-side only. Deliberately uses the plain
 * Messages REST API via fetch instead of the twilio SDK — one endpoint
 * doesn't justify a dependency, and SMS must never be required for core
 * function.
 *
 * Configuration (all three required together; without them sends are
 * skipped and logged, same contract as email.ts):
 * - TWILIO_ACCOUNT_SID
 * - TWILIO_AUTH_TOKEN
 * - TWILIO_FROM — an SMS-capable Twilio number in E.164 form
 *   (e.g. +15551234567) or a Messaging Service SID (MG...).
 *
 * Failures are reported in the return value, never thrown. Twilio has no
 * idempotency-key mechanism — callers that can re-fire (e.g. re-publishing
 * results) will re-send; keep messages informational so a duplicate is
 * annoying, not harmful.
 */

export interface SendSmsResult {
  sent: boolean;
  skipped?: boolean;
  error?: string;
}

/** Best-effort US-centric E.164 normalization of a free-text phone
 * column. Returns null when the value can't be a dialable number. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export async function sendSms(to: string, body: string): Promise<SendSmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (!sid || !token || !from) {
    console.log(`[sms skipped — Twilio not configured] to=${to} body="${body}"`);
    return { sent: false, skipped: true };
  }

  const params = new URLSearchParams({ To: to, Body: body });
  if (from.startsWith("MG")) params.set("MessagingServiceSid", from);
  else params.set("From", from);

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      }
    );
    if (!res.ok) {
      const detail = (await res.json().catch(() => null)) as {
        message?: string;
      } | null;
      const message = detail?.message ?? `HTTP ${res.status}`;
      console.error(`[sms failed] to=${to}: ${message}`);
      return { sent: false, error: message };
    }
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[sms failed] to=${to}: ${message}`);
    return { sent: false, error: message };
  }
}
