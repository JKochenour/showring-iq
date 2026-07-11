"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

export function PublicLinkCard({
  url,
  qrSvg,
}: {
  url: string;
  qrSvg: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — the link is
      // still selectable/visible as text, so this is a silent no-op.
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div
        className="h-28 w-28 shrink-0 rounded-lg border border-stone-200 bg-white p-1.5 dark:border-stone-800"
        dangerouslySetInnerHTML={{ __html: qrSvg }}
      />
      <div className="min-w-0 flex-1">
        <p className="break-all font-mono text-sm text-stone-700 dark:text-stone-300">
          {url}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={copy}>
            {copied ? "Copied!" : "Copy link"}
          </Button>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-400"
          >
            Open
          </a>
        </div>
      </div>
    </div>
  );
}
