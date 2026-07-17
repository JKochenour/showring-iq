import Link from "next/link";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-stone-200/80 dark:border-stone-800">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link
            href="/"
            className="font-grotesk text-xl font-semibold tracking-tight text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600 dark:text-stone-50"
          >
            ShowRing <span className="text-brand-600 dark:text-brand-400">IQ</span>
          </Link>
          <nav className="flex items-center gap-5 text-sm font-medium">
            <Link
              href="/guide"
              className="text-stone-600 transition-colors hover:text-brand-700 dark:text-stone-300 dark:hover:text-brand-400"
            >
              Guide
            </Link>
            <Link
              href="/shows"
              className="text-stone-600 transition-colors hover:text-brand-700 dark:text-stone-300 dark:hover:text-brand-400"
            >
              Find shows
            </Link>
            <Link
              href="/login"
              className="text-stone-600 transition-colors hover:text-brand-700 dark:text-stone-300 dark:hover:text-brand-400"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
      <footer className="mt-8 border-t border-stone-200/80 dark:border-stone-800">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-stone-500 dark:text-stone-400">
          <span>© 2026 ShowRing IQ</span>
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <Link href="/guide" className="transition-colors hover:text-brand-700 dark:hover:text-brand-400">
              Guide
            </Link>
            <Link href="/shows" className="transition-colors hover:text-brand-700 dark:hover:text-brand-400">
              Find shows
            </Link>
            <Link href="/legal" className="transition-colors hover:text-brand-700 dark:hover:text-brand-400">
              Legal
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
