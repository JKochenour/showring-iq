"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type ShowTab = { href: string; label: string };
export type ShowTabGroup = { label: string; tabs: ShowTab[] };

function cx(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/**
 * The show section nav, grouped by the stage of the show it belongs to.
 *
 * A flat bar of 18 tabs meant scanning the whole row to find anything and
 * forced horizontal scrolling on small screens. Grouping into the phases a
 * show actually moves through — set up, take entries, run it, settle up —
 * gives five things to choose from and a place to reason about, so a tab
 * you have never opened is still findable.
 *
 * A group holding a single tab renders as a plain link, not a menu.
 */
export function ShowTabs({ groups }: { groups: ShowTabGroup[] }) {
  const pathname = usePathname();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const navRef = useRef<HTMLElement>(null);

  const isTabActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  useEffect(() => {
    if (openIndex === null) return;
    function onPointerDown(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenIndex(null);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenIndex(null);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openIndex]);

  const linkClass = (active: boolean) =>
    cx(
      "block whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium",
      active
        ? "bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-400"
        : "text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"
    );

  return (
    <nav
      ref={navRef}
      className="mt-4 flex flex-wrap items-center gap-1 border-b border-stone-200 pb-1 dark:border-stone-800"
    >
      {groups.map((group, index) => {
        const groupActive = group.tabs.some((t) => isTabActive(t.href));

        if (group.tabs.length === 1) {
          const tab = group.tabs[0];
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cx(
                "shrink-0 whitespace-nowrap rounded-t-md px-3 py-2 text-sm font-medium",
                groupActive
                  ? "border-b-2 border-brand-700 text-brand-700 dark:border-brand-500 dark:text-brand-400"
                  : "text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"
              )}
            >
              {tab.label}
            </Link>
          );
        }

        const isOpen = openIndex === index;
        const activeTab = group.tabs.find((t) => isTabActive(t.href));

        return (
          <div key={group.label} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : index)}
              aria-expanded={isOpen}
              aria-haspopup="true"
              className={cx(
                "flex items-center gap-1.5 whitespace-nowrap rounded-t-md px-3 py-2 text-sm font-medium",
                groupActive
                  ? "border-b-2 border-brand-700 text-brand-700 dark:border-brand-500 dark:text-brand-400"
                  : "text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"
              )}
            >
              <span>{group.label}</span>
              {/* Name the current page so the collapsed group still says
                  where you are, the way the flat bar used to. */}
              {activeTab && (
                <span className="text-xs font-normal opacity-70">
                  · {activeTab.label}
                </span>
              )}
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className={cx(
                  "h-2.5 w-2.5 shrink-0 transition-transform",
                  isOpen && "rotate-90"
                )}
              >
                <path d="M6 4l6 6-6 6V4z" />
              </svg>
            </button>
            {isOpen && (
              <div className="absolute left-0 top-full z-40 mt-1 min-w-44 rounded-lg border border-stone-200 bg-white p-1 shadow-lg dark:border-stone-800 dark:bg-stone-900">
                {group.tabs.map((tab) => (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    onClick={() => setOpenIndex(null)}
                    className={linkClass(isTabActive(tab.href))}
                  >
                    {tab.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
