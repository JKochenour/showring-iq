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
  const isActiveShow = pathname.startsWith(`${basePath}/`);
  const [isOpen, setIsOpen] = useState(isActiveShow);

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={cx(
          "flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs text-stone-500 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800",
          isActiveShow && "font-medium text-stone-900 dark:text-stone-100"
        )}
        aria-expanded={isOpen}
      >
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className={cx("h-2.5 w-2.5 shrink-0 text-stone-400 transition-transform", isOpen && "rotate-90")}
        >
          <path d="M6 4l6 6-6 6V4z" />
        </svg>
        <span className="truncate">{show.name}</span>
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
