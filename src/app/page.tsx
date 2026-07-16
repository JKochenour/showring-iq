import Link from "next/link";
import { ButtonLink } from "@/components/ui";

const FEATURES = [
  {
    title: "Rule packages, not hard-coded logic",
    description:
      "Class codes, eligibility, fees, and export schemas live in versioned association rule packages — NRHA 2026, EPRHA, and beyond — so a rule change never means a code change.",
  },
  {
    title: "Validation from entry to export",
    description:
      "Every entry, class, and score is checked continuously — info, warning, blocking, critical — so the secretary never discovers a dirty results file after the show.",
  },
  {
    title: "Official-ready submission packages",
    description:
      "Not a generic CSV: the NRHA package bundles the ReinerSuite file, PDF results, score sheets, retainage summary, paperwork, and audit log, pre-validated before it's built.",
  },
  {
    title: "Permissions built for a show weekend",
    description:
      "Judges, gate, announcer, treasurer, secretary, and manager each see exactly what their role allows — enforced in the data layer, not just hidden in the UI.",
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-display text-xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
          ShowRing <span className="text-accent-600 dark:text-accent-400">IQ</span>
        </span>
        <nav className="flex items-center gap-6 text-sm">
          <Link
            href="/shows"
            className="font-medium text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
          >
            Find shows
          </Link>
          <Link
            href="/login"
            className="font-medium text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
          >
            Sign in
          </Link>
          <ButtonLink href="/signup">Get started</ButtonLink>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
          <div>
            <p className="mb-5 inline-flex items-center rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-800 dark:border-brand-900 dark:bg-brand-950 dark:text-brand-300">
              The modern horse show operating system
            </p>
            <h1 className="font-display max-w-xl text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl dark:text-stone-50">
              Run the show. Validate everything. Submit clean results.
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-stone-600 dark:text-stone-400">
              Entries, class codes, eligibility, scoring, payouts, live
              results, and official association submission packages — all in
              one place, protecting the show from mistakes all weekend.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/signup" className="px-6 py-3 text-base">
                Create your organization
              </ButtonLink>
              <ButtonLink href="/login" variant="secondary" className="px-6 py-3 text-base">
                Sign in
              </ButtonLink>
            </div>
          </div>

          <div className="relative mx-auto aspect-square w-full max-w-md">
            <svg
              viewBox="0 0 400 400"
              className="h-full w-full"
              role="img"
              aria-label="Concentric arena rings representing show ring validation"
            >
              <circle cx="200" cy="200" r="190" fill="none" stroke="var(--color-brand-100)" strokeWidth="1.5" />
              <circle cx="200" cy="200" r="150" fill="none" stroke="var(--color-brand-200)" strokeWidth="1.5" />
              <circle cx="200" cy="200" r="110" fill="none" stroke="var(--color-brand-300)" strokeWidth="1.5" />
              <circle
                cx="200"
                cy="200"
                r="150"
                fill="none"
                stroke="var(--color-accent-400)"
                strokeWidth="3"
                strokeDasharray="6 14"
                strokeLinecap="round"
              />
              <circle cx="200" cy="200" r="70" fill="var(--color-brand-700)" />
              <path
                d="M182 205 L196 219 L222 187"
                fill="none"
                stroke="white"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="200" cy="50" r="7" fill="var(--color-accent-500)" />
              <circle cx="350" cy="200" r="5" fill="var(--color-brand-400)" />
              <circle cx="200" cy="350" r="5" fill="var(--color-brand-400)" />
              <circle cx="50" cy="200" r="7" fill="var(--color-accent-500)" />
            </svg>
          </div>
        </section>

        <section id="features" className="border-y border-stone-200 bg-white py-16 dark:border-stone-800 dark:bg-stone-900">
          <div className="mx-auto w-full max-w-6xl px-6">
            <h2 className="font-display max-w-lg text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
              Built for the show, not just the spreadsheet
            </h2>
            <div className="mt-10 grid gap-8 sm:grid-cols-2">
              {FEATURES.map((f) => (
                <div key={f.title}>
                  <div className="mb-3 h-1 w-10 rounded-full bg-accent-400" />
                  <h3 className="font-semibold text-stone-900 dark:text-stone-100">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
                    {f.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 py-16 text-center">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
            Ready when your first show is.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-stone-600 dark:text-stone-400">
            Set up your organization, bring in a rule package, and start
            building your show — entries to export.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <ButtonLink href="/signup" className="px-6 py-3 text-base">
              Create your organization
            </ButtonLink>
          </div>
        </section>
      </main>

      <footer className="border-t border-stone-200 px-6 py-6 text-center text-xs text-stone-400 dark:border-stone-800">
        Validation assistance based on configured rule package. Final
        responsibility remains with show management and the applicable
        association.
      </footer>
    </div>
  );
}
