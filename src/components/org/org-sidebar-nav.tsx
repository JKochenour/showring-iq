"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ShowSidebarNav } from "@/components/show/show-sidebar-nav";

const MAX_SHOWS_SHOWN = 5;

const TOP_TABS = [{ slug: "", label: "Overview" }];

const BOTTOM_TABS = [
  { slug: "people", label: "People" },
  { slug: "horses", label: "Horses" },
  { slug: "rule-packages", label: "Rule Packages" },
  { slug: "members", label: "Members" },
  { slug: "settings", label: "Settings" },
  { slug: "audit", label: "Audit log" },
];

function cx(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function OrgSidebarNav({
  org,
  shows,
}: {
  org: { id: string; name: string };
  shows: { id: string; name: string }[];
}) {
  const pathname = usePathname();
  const basePath = `/organizations/${org.id}`;
  const showsHref = `${basePath}/shows`;
  const isActiveOrg =
    pathname === basePath ||
    pathname.startsWith(`${basePath}/`) ||
    shows.some((s) => pathname.startsWith(`/shows/${s.id}`));
  const [isOpen, setIsOpen] = useState(isActiveOrg);

  const visibleShows = shows.slice(0, MAX_SHOWS_SHOWN);
  const hiddenShowCount = shows.length - visibleShows.length;

  function renderTabLink(tab: { slug: string; label: string }) {
    const href = tab.slug ? `${basePath}/${tab.slug}` : basePath;
    const isActive = pathname === href;
    return (
      <Link
        key={tab.slug}
        href={href}
        className={cx(
          "truncate rounded-md px-2 py-1 text-xs text-stone-500 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100",
          isActive && "bg-brand-50 font-medium text-brand-700 dark:bg-brand-950/40 dark:text-brand-500"
        )}
      >
        {tab.label}
      </Link>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={cx(
          "flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800",
          isActiveOrg && "font-medium text-stone-900 dark:text-stone-100"
        )}
        aria-expanded={isOpen}
      >
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className={cx("h-3 w-3 shrink-0 text-stone-400 transition-transform", isOpen && "rotate-90")}
        >
          <path d="M6 4l6 6-6 6V4z" />
        </svg>
        <span className="truncate">{org.name}</span>
      </button>
      {isOpen && (
        <div className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-stone-200 pl-3 dark:border-stone-800">
          {TOP_TABS.map(renderTabLink)}

          <Link
            href={showsHref}
            className={cx(
              "truncate rounded-md px-2 py-1 text-xs text-stone-500 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100",
              pathname === showsHref &&
                "bg-brand-50 font-medium text-brand-700 dark:bg-brand-950/40 dark:text-brand-500"
            )}
          >
            Shows
          </Link>
          {visibleShows.length > 0 && (
            <div className="ml-3 flex flex-col gap-0.5 border-l border-stone-200 pl-2 dark:border-stone-800">
              {visibleShows.map((show) => (
                <ShowSidebarNav key={show.id} show={show} />
              ))}
              {hiddenShowCount > 0 && (
                <Link
                  href={showsHref}
                  className="truncate rounded-md px-2 py-1 text-[11px] text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-300"
                >
                  +{hiddenShowCount} more show{hiddenShowCount === 1 ? "" : "s"}…
                </Link>
              )}
            </div>
          )}

          {BOTTOM_TABS.map(renderTabLink)}
        </div>
      )}
    </div>
  );
}
