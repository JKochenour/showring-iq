"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/** The show section tab bar. One horizontally-scrollable row on every
 * screen size (18 tabs would otherwise force the whole page to scroll
 * sideways on phones), with the active tab highlighted and scrolled
 * into view on load. */
export function ShowTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();
  const activeRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [pathname]);

  return (
    <nav className="scrollbar-thin mt-4 flex gap-1 overflow-x-auto border-b border-stone-200 dark:border-stone-800">
      {tabs.map((tab) => {
        const isActive =
          pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            ref={isActive ? activeRef : undefined}
            href={tab.href}
            className={`shrink-0 whitespace-nowrap rounded-t-md px-3 py-2 text-sm font-medium ${
              isActive
                ? "border-b-2 border-brand-700 text-brand-700 dark:border-brand-500 dark:text-brand-400"
                : "text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
