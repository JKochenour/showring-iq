"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const SHOW_TABS = [
  { slug: "dashboard", label: "Dashboard" },
  { slug: "classes", label: "Classes" },
  { slug: "entries", label: "Entries" },
  { slug: "check-in", label: "Check-in" },
  { slug: "issues", label: "Issues" },
  { slug: "draws", label: "Draws" },
  { slug: "scoring", label: "Scoring" },
  { slug: "results", label: "Results" },
  { slug: "exports", label: "Exports" },
  { slug: "gate", label: "Gate" },
  { slug: "announcer", label: "Announcer" },
  { slug: "staff", label: "Staff" },
  { slug: "settings", label: "Settings" },
];

function cx(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function ShowSidebarNav({ show }: { show: { id: string; name: string } }) {
  const pathname = usePathname();
  const basePath = `/shows/${show.id}`;
  const isActiveShow = pathname === basePath || pathname.startsWith(`${basePath}/`);
  const [isOpen, setIsOpen] = useState(isActiveShow);

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={cx(
          // items-start + border-l keeps the marker out of the text's
          // horizontal budget — show names are long and the sidebar is
          // only w-64, so the name gets every pixel and wraps instead
          // of truncating.
          "flex w-full items-start gap-1.5 rounded-md border-l-2 border-transparent px-2 py-1 text-left text-xs text-stone-500 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800",
          isActiveShow &&
            "border-brand-600 bg-brand-50 font-semibold text-brand-800 hover:bg-brand-100 dark:border-brand-500 dark:bg-brand-950/50 dark:text-brand-300 dark:hover:bg-brand-950/70"
        )}
        aria-current={isActiveShow ? "page" : undefined}
        aria-expanded={isOpen}
      >
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className={cx(
            "mt-1 h-2.5 w-2.5 shrink-0 transition-transform",
            isActiveShow ? "text-brand-500" : "text-stone-400",
            isOpen && "rotate-90"
          )}
        >
          <path d="M6 4l6 6-6 6V4z" />
        </svg>
        <span className="min-w-0 flex-1 leading-snug">{show.name}</span>
      </button>
      {isOpen && (
        <div className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-stone-200 pl-3 dark:border-stone-800">
          {SHOW_TABS.map((tab) => {
            const href = `${basePath}/${tab.slug}`;
            const isActive = pathname === href;
            return (
              <Link
                key={tab.slug}
                href={href}
                className={cx(
                  "truncate rounded-md px-2 py-1 text-[11px] text-stone-500 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100",
                  isActive && "bg-brand-50 font-medium text-brand-700 dark:bg-brand-950/40 dark:text-brand-500"
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
