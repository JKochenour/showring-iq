import Link from "next/link";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-stone-200 dark:border-stone-800">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link
            href="/"
            className="font-display text-xl font-semibold tracking-tight text-stone-900 dark:text-stone-50"
          >
            ShowRing <span className="text-accent-600 dark:text-accent-400">IQ</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm font-medium">
            <Link
              href="/shows"
              className="text-stone-600 hover:text-stone-900 dark:text-stone-300 dark:hover:text-stone-50"
            >
              Find shows
            </Link>
            <Link
              href="/login"
              className="text-stone-600 hover:text-stone-900 dark:text-stone-300 dark:hover:text-stone-50"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  );
}
