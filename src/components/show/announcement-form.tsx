"use client";

import { useState, useTransition } from "react";
import { sendAnnouncement } from "@/app/(app)/shows/[id]/announcements/actions";
import { Alert, Button, Input, Label, Textarea } from "@/components/ui";
import { useConfirmDialog } from "@/components/confirm-dialog";

export function AnnouncementForm({ showId }: { showId: string }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [sendSms, setSendSms] = useState(true);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const confirm = useConfirmDialog();

  const submit = async () => {
    const confirmed = await confirm({
      title: "Send announcement",
      message: `Send "${subject || "(no subject)"}" to every rider/owner entered in this show? This goes out immediately — there's no undo.`,
      confirmLabel: "Send now",
      tone: "danger",
    });
    if (!confirmed) return;

    setError(undefined);
    setResult(undefined);
    startTransition(async () => {
      const res = await sendAnnouncement({ showId, subject, body, sendEmail, sendSms });
      if (res.error) setError(res.error);
      else {
        setResult(
          `Sent to ${res.recipientCount} recipient${res.recipientCount === 1 ? "" : "s"}: ${res.emailsSent ?? 0} email${res.emailsSent === 1 ? "" : "s"}, ${res.textsSent ?? 0} text${res.textsSent === 1 ? "" : "s"}.`
        );
        setSubject("");
        setBody("");
      }
    });
  };

  return (
    <div className="space-y-3">
      {error && <Alert>{error}</Alert>}
      {result && <Alert tone="success">{result}</Alert>}
      <div>
        <Label htmlFor="ann-subject">Subject</Label>
        <Input
          id="ann-subject"
          placeholder="e.g. Arena change — Sunday moved to 7:00 AM"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="ann-body">Message</Label>
        <Textarea
          id="ann-body"
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-stone-300 accent-brand-700"
            checked={sendEmail}
            onChange={(e) => setSendEmail(e.target.checked)}
          />
          Email
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-stone-300 accent-brand-700"
            checked={sendSms}
            onChange={(e) => setSendSms(e.target.checked)}
          />
          SMS
        </label>
      </div>
      <Button
        disabled={isPending || !subject.trim() || !body.trim() || (!sendEmail && !sendSms)}
        onClick={submit}
      >
        {isPending ? "Sending…" : "Send to everyone entered"}
      </Button>
      <p className="text-xs text-stone-500 dark:text-stone-400">
        Reaches every distinct rider/owner with an active entry who has an
        email or phone on file. Skipped silently (and logged server-side)
        for anyone missing that contact info, or if Resend/Twilio aren&apos;t
        configured yet.
      </p>
    </div>
  );
}
