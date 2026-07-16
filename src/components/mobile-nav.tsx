"use client";

import { useState } from "react";

/** Phone-width navigation: a hamburger that slides the full sidebar
 * nav (passed server-rendered as children) over the page. Any link
 * tap inside closes it. Hidden ≥sm where the real sidebar shows. */
export function MobileNav({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        className="flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-md text-stone-700 hover:bg-stone-100 dark:text-stone-200 dark:hover:bg-stone-800"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        ) : (
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6">
            <path d="M2 5.75A.75.75 0 0 1 2.75 5h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 5.75Zm0 4.25A.75.75 0 0 1 2.75 9.25h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Zm.75 3.5a.75.75 0 0 0 0 1.5h14.5a.75.75 0 0 0 0-1.5H2.75Z" />
          </svg>
        )}
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 top-[57px] z-40 bg-stone-950/40"
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed inset-y-0 left-0 top-[57px] z-50 w-72 overflow-y-auto border-r border-stone-200 bg-white px-4 py-4 dark:border-stone-800 dark:bg-stone-900"
            onClickCapture={(e) => {
              // Navigating from the drawer should close it.
              if ((e.target as HTMLElement).closest("a")) setOpen(false);
            }}
          >
            {children}
          </div>
        </>
      )}
    </div>
  );
}
