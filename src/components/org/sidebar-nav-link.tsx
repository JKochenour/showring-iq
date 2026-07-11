"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

function cx(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function SidebarNavLink({
  href,
  children,
  icon,
}: {
  href: string;
  children: ReactNode;
  icon?: ReactNode;
}) {
  const pathname = usePathname();
  const isActive = pathname === href;
  return (
    <Link
      href={href}
      className={cx(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 font-medium text-stone-700 transition-colors hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800",
        isActive &&
          "bg-brand-50 text-brand-800 hover:bg-brand-50 dark:bg-brand-950/50 dark:text-brand-400 dark:hover:bg-brand-950/50"
      )}
    >
      {icon}
      {children}
    </Link>
  );
}
