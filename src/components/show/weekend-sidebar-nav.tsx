"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ShowSidebarNav } from "@/components/show/show-sidebar-nav";

export type SidebarShow = { id: string; name: string; label?: string };

function cx(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/**
 * A weekend (circuit) and the slates inside it.
 *
 * The weekend is the event; the slates are how it runs. Anything counted
 * once for the whole weekend — the consolidated bill, a horse's entries
 * across every slate — belongs here rather than on any one slate, so
 * those links live at this level instead of being reachable only from
 * the organization's own page.
 */
export function WeekendSidebarNav({
  orgId,
  weekend,
}: {
  orgId: string;
  weekend: { id: string; name: string; shows: SidebarShow[] };
}) {
  const pathname = usePathname();
  const basePath = `/organizations/${orgId}/weekends/${weekend.id}`;

  const isActiveWeekend =
    pathname === basePath ||
    pathname.startsWith(`${basePath}/`) ||
    weekend.shows.some(
      (s) => pathname === `/shows/${s.id}` || pathname.startsWith(`/shows/${s.id}/`)
    );
  const [isOpen, setIsOpen] = useState(isActiveWeekend);

  const links = [
    { href: basePath, label: "Overview" },
    { href: `${basePath}/entries/new`, label: "New entry" },
    { href: `${basePath}/manage`, label: "Manage entries" },
    { href: `${basePath}/financials`, label: "Consolidated billing" },
  ];

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={cx(
          "flex w-full items-start gap-1.5 rounded-md border-l-2 border-transparent px-2 py-1 text-left text-xs text-stone-500 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800",
          isActiveWeekend &&
            "border-brand-600 font-semibold text-brand-800 dark:border-brand-500 dark:text-brand-300"
        )}
        aria-expanded={isOpen}
        title={weekend.name}
      >
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className={cx(
            "mt-1 h-2.5 w-2.5 shrink-0 transition-transform",
            isActiveWeekend ? "text-brand-500" : "text-stone-400",
            isOpen && "rotate-90"
          )}
        >
          <path d="M6 4l6 6-6 6V4z" />
        </svg>
        <span className="min-w-0 flex-1 leading-snug">{weekend.name}</span>
      </button>
      {isOpen && (
        <div className="ml-3 mt-0.5 flex flex-col gap-0.5 border-l border-stone-200 pl-2 dark:border-stone-800">
          {links.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cx(
                  "truncate rounded-md px-2 py-1 text-[11px] text-stone-500 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100",
                  isActive &&
                    "bg-brand-50 font-medium text-brand-700 dark:bg-brand-950/40 dark:text-brand-500"
                )}
              >
                {link.label}
              </Link>
            );
          })}
          {weekend.shows.map((show) => (
            <ShowSidebarNav key={show.id} show={show} />
          ))}
        </div>
      )}
    </div>
  );
}
