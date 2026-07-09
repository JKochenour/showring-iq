import Link from "next/link";
import { ButtonLink } from "@/components/ui";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="flex items-center justify-between px-6 py-4">
        <span className="text-lg font-bold tracking-tight">
          ShowRing <span className="text-emerald-700">IQ</span>
        </span>
        <nav className="flex items-center gap-4 text-sm">
          <Link
            href="/login"
            className="font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Sign in
          </Link>
          <ButtonLink href="/signup">Get started</ButtonLink>
        </nav>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-24 text-center">
        <p className="mb-4 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
          The modern horse show operating system
        </p>
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
          Run the show. Validate everything. Submit clean results.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
          Entries, class codes, eligibility, scoring, payouts, live results,
          and official association submission packages — all in one place.
        </p>
        <div className="mt-8 flex gap-3">
          <ButtonLink href="/signup">Create your organization</ButtonLink>
          <ButtonLink href="/login" variant="secondary">
            Sign in
          </ButtonLink>
        </div>
      </main>
      <footer className="px-6 py-4 text-center text-xs text-zinc-400">
        Validation assistance based on configured rule package. Final
        responsibility remains with show management and the applicable
        association.
      </footer>
    </div>
  );
}
