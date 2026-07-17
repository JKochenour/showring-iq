import Link from "next/link";

// ---------------------------------------------------------------------------
// Marketing homepage. Design language: the prestige print tradition of the
// horse show itself — show programs, order-of-go sheets, engraved trophy
// plates. Hunt-coat green canvas, cream cardstock, brass used like engraving.
// The hero artifact is a typeset results card: the product's promise ("submit
// clean results"), rendered literally. Fraunces carries display type; Geist
// Mono carries anything that would be data on a real sheet.
// ---------------------------------------------------------------------------

const CARD_ROWS = [
  { draw: 1, back: 212, horse: "Gunners Moontune", rider: "C. Alvarez", score: "72.5" },
  { draw: 2, back: 147, horse: "Spook Street Cat", rider: "R. Whitfield", score: "70.0" },
  { draw: 3, back: 308, horse: "Tinsel N Whizkey", rider: "M. Okafor", score: "73.0" },
  { draw: 4, back: 221, horse: "Smart Lil Dunit", rider: "J. Pruitt", score: "71.5" },
  { draw: 5, back: 194, horse: "Chexs Last Word", rider: "T. Barnes", score: "—" },
];

const WEEKEND_STAGES = [
  {
    name: "Entries",
    copy: "Office or online: rider, horse, owner, and classes — billed to the right party, one back number per horse for the whole weekend.",
  },
  {
    name: "Validation",
    copy: "Memberships, licenses, birthdates, ownership — checked continuously and surfaced by severity, not discovered at export.",
  },
  {
    name: "Draw & gate",
    copy: "Seeded draws with rider spacing, and a one-tap gate flow that keeps concurrent classes in lockstep.",
  },
  {
    name: "Scoring",
    copy: "Judge-signed cards, verification, corrections with a required reason — every change audited with before and after.",
  },
  {
    name: "Results",
    copy: "Placings, tie handling, and payouts to the penny — retainage where it applies, never on youth classes.",
  },
  {
    name: "Submission",
    copy: "The ReinerSuite CSV, PDF results, score sheets, and audit log in one package — blocking issues stop the export before the association ever sees it.",
  },
];

// Load-sequence timing: header first, then each row posts, seal stamps last.
const ROW_DELAY = (i: number) => 0.15 + (i + 1) * 0.09;
const SEAL_DELAY = ROW_DELAY(CARD_ROWS.length - 1) + 0.25;

function ResultsCard() {
  return (
    <div className="w-full max-w-md rounded-sm bg-[#faf6ec] p-6 text-stone-900 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.55)] ring-1 ring-black/10 sm:p-7">
      <div
        className="anim-rise flex items-baseline justify-between border-b-2 border-stone-900 pb-3"
        style={{ "--rise-delay": "0.05s" } as React.CSSProperties}
      >
        <span className="font-display text-lg font-semibold tracking-tight">
          Class 7 — Open
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-stone-500">
          Sat · Pattern 9
        </span>
      </div>

      <div className="mt-3 grid grid-cols-[2rem_3rem_1fr_auto] gap-x-3 font-mono text-[11px] uppercase tracking-[0.14em] text-stone-400">
        <span>Draw</span>
        <span>Back</span>
        <span>Horse · Rider</span>
        <span className="text-right">Score</span>
      </div>

      <ul className="mt-1 divide-y divide-stone-200">
        {CARD_ROWS.map((r, i) => (
          <li
            key={r.draw}
            className="anim-rise grid grid-cols-[2rem_3rem_1fr_auto] items-baseline gap-x-3 py-2.5"
            style={{ "--rise-delay": `${ROW_DELAY(i)}s` } as React.CSSProperties}
          >
            <span className="font-mono text-sm text-stone-400">{r.draw}</span>
            <span className="font-mono text-sm font-medium">{r.back}</span>
            <span className="truncate text-sm">
              {r.horse}
              <span className="text-stone-500"> · {r.rider}</span>
            </span>
            <span className="text-right font-mono text-sm font-semibold tabular-nums">
              {r.score}
            </span>
          </li>
        ))}
      </ul>

      <div
        className="anim-stamp mt-4 flex items-center gap-3 border-t-2 border-stone-900 pt-4"
        style={{ "--rise-delay": `${SEAL_DELAY}s` } as React.CSSProperties}
      >
        <span
          aria-hidden
          className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-accent-500 text-accent-600"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none">
            <path
              d="M4 10.5 8 14.5 16 6"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-accent-700">
            NRHA submission · Ready
          </p>
          <p className="mt-0.5 text-xs text-stone-500">
            0 blocking issues · package validated
          </p>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      {/* ------------------------------------------------------ dark canvas */}
      <div className="bg-brand-950 text-stone-100">
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
          <span className="font-display text-xl font-semibold tracking-tight text-stone-50">
            ShowRing <span className="text-accent-400">IQ</span>
          </span>
          <nav className="flex items-center gap-6 text-sm">
            <Link
              href="/shows"
              className="font-medium text-stone-300 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-400"
            >
              Find shows
            </Link>
            <Link
              href="/login"
              className="font-medium text-stone-300 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-400"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-accent-400 px-4 py-2 text-sm font-semibold text-brand-950 transition-colors hover:bg-accent-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-300"
            >
              Get started
            </Link>
          </nav>
        </header>

        <section className="mx-auto grid w-full max-w-6xl items-center gap-14 px-6 pb-20 pt-12 lg:grid-cols-[1.05fr_0.95fr] lg:pb-28 lg:pt-20">
          <div>
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.28em] text-accent-400">
              The horse show operating system
            </p>
            <h1 className="font-display mt-6 text-[clamp(2.6rem,6vw,4.4rem)] font-semibold leading-[1.04] tracking-tight text-stone-50">
              Run the show.
              <br />
              Validate everything.
              <br />
              <em className="text-accent-300">Submit clean results.</em>
            </h1>
            <p className="mt-7 max-w-md text-lg leading-relaxed text-stone-300">
              Entries, eligibility, scoring, payouts, and the official
              submission package — one system protecting the show from
              mistakes all weekend.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-5">
              <Link
                href="/signup"
                className="rounded-md bg-accent-400 px-6 py-3 text-base font-semibold text-brand-950 transition-colors hover:bg-accent-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-300"
              >
                Create your organization
              </Link>
              <Link
                href="/login"
                className="text-base font-medium text-stone-300 underline decoration-stone-600 underline-offset-4 transition-colors hover:text-white hover:decoration-accent-400 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-400"
              >
                Sign in
              </Link>
            </div>
          </div>

          <div className="mx-auto w-full max-w-md lg:justify-self-end">
            <ResultsCard />
          </div>
        </section>
      </div>

      {/* ------------------------------------------------ credibility strip */}
      <div className="border-b border-stone-200 bg-paper dark:border-stone-800">
        <p className="mx-auto w-full max-w-6xl px-6 py-5 font-mono text-[11px] uppercase tracking-[0.22em] text-stone-500 dark:text-stone-400">
          Association rules as versioned data
          <span className="mx-3 text-accent-500">—</span>
          NRHA 2026 · AQHA · APHA · EPRHA
        </p>
      </div>

      <main className="flex-1">
        {/* -------------------------------------------- the weekend, staged */}
        <section className="mx-auto w-full max-w-6xl px-6 py-20">
          <h2 className="font-display max-w-xl text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl dark:text-stone-50">
            A show weekend, protected at every stage
          </h2>
          <p className="mt-4 max-w-xl text-stone-600 dark:text-stone-400">
            The same arc every show runs — with validation standing between
            each step and the mistakes that used to surface after the show.
          </p>

          <ol className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {WEEKEND_STAGES.map((stage, i) => (
              <li key={stage.name} className="relative">
                <div className="flex items-baseline gap-3 border-t-2 border-stone-900 pt-4 dark:border-stone-100">
                  <span className="font-mono text-xs text-accent-600 dark:text-accent-400">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-display text-lg font-semibold text-stone-900 dark:text-stone-100">
                    {stage.name}
                  </h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
                  {stage.copy}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* ------------------------------------------------- differentiators */}
        <section className="border-y border-stone-200 bg-white py-20 dark:border-stone-800 dark:bg-stone-900">
          <div className="mx-auto grid w-full max-w-6xl gap-14 px-6 lg:grid-cols-2">
            <div>
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.28em] text-accent-600 dark:text-accent-400">
                Rules are data, not code
              </p>
              <h3 className="font-display mt-4 text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
                A rule change never means a code change
              </h3>
              <p className="mt-4 leading-relaxed text-stone-600 dark:text-stone-400">
                Class codes, eligibility conditions, fee caps, and export
                schemas live in versioned association rule packages with a
                review lifecycle. Seed NRHA, AQHA, or APHA starters — each
                eligibility rule carries its citation back to the rulebook —
                then edit everything as your association&apos;s rules evolve.
              </p>
            </div>
            <div>
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.28em] text-accent-600 dark:text-accent-400">
                Built for the show office
              </p>
              <h3 className="font-display mt-4 text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
                Every role sees exactly its own job
              </h3>
              <p className="mt-4 leading-relaxed text-stone-600 dark:text-stone-400">
                Judges score their assigned classes; the gate runs its one-tap
                board; the announcer reads, the treasurer reconciles, the
                secretary runs everything — permissions enforced in the data
                layer, not hidden in the interface. Every override, correction,
                and re-draw lands in the audit log with who, when, and why.
              </p>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------- final CTA */}
        <section className="mx-auto w-full max-w-6xl px-6 py-24 text-center">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.28em] text-accent-600 dark:text-accent-400">
            Ready when your first show is
          </p>
          <h2 className="font-display mx-auto mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl dark:text-stone-50">
            From the first entry to a clean submission package
          </h2>
          <p className="mx-auto mt-4 max-w-md text-stone-600 dark:text-stone-400">
            Set up your organization, bring in a rule package, and build your
            show — entries to export.
          </p>
          <div className="mt-8 flex justify-center">
            <Link
              href="/signup"
              className="rounded-md bg-brand-700 px-7 py-3.5 text-base font-semibold text-white transition-colors hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              Create your organization
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-stone-200 px-6 py-8 dark:border-stone-800">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-3 text-center">
          <span className="font-display text-sm font-semibold tracking-tight text-stone-700 dark:text-stone-300">
            ShowRing <span className="text-accent-600 dark:text-accent-400">IQ</span>
          </span>
          <p className="max-w-xl text-xs leading-relaxed text-stone-400">
            Validation assistance based on configured rule package. Final
            responsibility remains with show management and the applicable
            association.
          </p>
        </div>
      </footer>
    </div>
  );
}
