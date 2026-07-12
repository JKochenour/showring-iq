import { formatCents } from "@/lib/money";

/** Minimal, text-forward transactional templates. Inline styles only —
 * email clients ignore stylesheets. */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layout(title: string, bodyHtml: string): string {
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1c1917">
  <h1 style="font-size:18px;margin:0 0 16px">${escapeHtml(title)}</h1>
  ${bodyHtml}
  <p style="margin-top:24px;font-size:12px;color:#78716c">Sent by ShowRing IQ on behalf of show management. Validation assistance only — final responsibility remains with show management and the applicable association.</p>
</div>`;
}

export function entryConfirmationEmail(opts: {
  showName: string;
  riderName: string;
  horseName: string;
  classes: { name: string; feeCents: number }[];
}): { subject: string; html: string } {
  const totalCents = opts.classes.reduce((sum, c) => sum + c.feeCents, 0);
  const rows = opts.classes
    .map(
      (c) =>
        `<tr><td style="padding:4px 12px 4px 0">${escapeHtml(c.name)}</td><td style="padding:4px 0;text-align:right;font-variant-numeric:tabular-nums">${formatCents(c.feeCents)}</td></tr>`
    )
    .join("");
  return {
    subject: `Entry received — ${opts.showName}`,
    html: layout(
      `Entry received for ${opts.showName}`,
      `<p style="margin:0 0 12px">Your entry for <strong>${escapeHtml(opts.riderName)}</strong> riding <strong>${escapeHtml(opts.horseName)}</strong> has been received.</p>
<table style="border-collapse:collapse;font-size:14px">${rows}
  <tr><td style="padding:8px 12px 0 0;border-top:1px solid #e7e5e4"><strong>Entry fees</strong></td><td style="padding:8px 0 0;border-top:1px solid #e7e5e4;text-align:right"><strong>${formatCents(totalCents)}</strong></td></tr>
</table>
<p style="margin:12px 0 0;font-size:13px;color:#57534e">Entry fees shown only — stall, office, and other standard charges are billed by the show office. This is a confirmation of receipt, not of eligibility.</p>`
    ),
  };
}

export function resultsPostedEmail(opts: {
  showName: string;
  className: string;
  classNumber: number;
  riderName: string;
  horseName: string;
  placing: number | null;
  moneyWonCents: number;
  publicUrl: string | null;
}): { subject: string; html: string } {
  const placingLine = opts.placing
    ? `<p style="margin:0 0 8px;font-size:16px">Placing: <strong>${opts.placing}</strong>${opts.moneyWonCents > 0 ? ` · Money won: <strong>${formatCents(opts.moneyWonCents)}</strong>` : ""}</p>`
    : `<p style="margin:0 0 8px">Results are posted. Your run did not place.</p>`;
  return {
    subject: `Results posted — Class ${opts.classNumber}, ${opts.showName}`,
    html: layout(
      `Results posted: Class ${opts.classNumber} — ${opts.className}`,
      `<p style="margin:0 0 12px">${escapeHtml(opts.riderName)} riding ${escapeHtml(opts.horseName)} at ${escapeHtml(opts.showName)}:</p>
${placingLine}
${opts.publicUrl ? `<p style="margin:12px 0 0"><a href="${opts.publicUrl}" style="color:#1d4ed8">View full results</a></p>` : ""}
<p style="margin:12px 0 0;font-size:13px;color:#57534e">Posted scores become official 30 minutes after the last horse of the day (NRHA Show Rules P(10)).</p>`
    ),
  };
}
