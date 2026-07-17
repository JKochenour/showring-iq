import Link from "next/link";

// ---------------------------------------------------------------------------
// Marketing homepage. Design language: the prestige print tradition of the
// horse show — show programs, order-of-go sheets, engraved trophy plates —
// executed as luxury minimalism. Hunt-coat green canvas, cream cardstock,
// brass used like engraving. 1400px wrappers, 8px spacing rhythm, hairline
// depth, one motion choreography (hero copy → card rows → seal; marquee
// drifts). Fraunces carries oversized display type; Geist Mono carries
// anything that would be data on a real sheet.
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

const MARQUEE_ITEMS = [
  "Association rules as versioned data",
  "NRHA 2026",
  "AQHA",
  "APHA",
  "EPRHA",
  "Validation at every stage",
  "Payouts to the penny",
  "Every correction audited",
];

// Load-sequence timing: hero copy first, card header, each row posts, seal
// stamps last.
const ROW_DELAY = (i: number) => 0.45 + (i + 1) * 0.09;
const SEAL_DELAY = ROW_DELAY(CARD_ROWS.length - 1) + 0.25;

/** Arrow that slides on hover — parent needs `group`. */
function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className={`h-4 w-4 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-1 ${className}`}
    >
      <path
        d="M2 8h11M9 3.5 13.5 8 9 12.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Nav link with a brass underline that grows in from the left. */
function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="relative font-medium text-stone-300 transition-colors duration-300 after:absolute after:-bottom-1.5 after:left-0 after:h-px after:w-0 after:bg-accent-400 after:transition-[width] after:duration-300 after:ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-white hover:after:w-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-400"
    >
      {children}
    </Link>
  );
}

function ResultsCard() {
  return (
    <div className="w-full max-w-md rounded-sm bg-[#faf6ec] p-6 text-stone-900 shadow-[0_32px_80px_-16px_rgba(0,0,0,0.6)] ring-1 ring-black/10 sm:p-8">
      <div
        className="anim-rise flex items-baseline justify-between border-b-2 border-stone-900 pb-3"
        style={{ "--rise-delay": "0.35s" } as React.CSSProperties}
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
        <header className="border-b border-white/10">
          <div className="mx-auto flex w-full max-w-[87.5rem] items-center justify-between px-6 py-6 sm:px-10">
            <span className="font-display text-xl font-semibold tracking-tight text-stone-50">
              ShowRing <span className="text-accent-400">IQ</span>
            </span>
            <nav className="flex items-center gap-8 text-sm">
              <NavLink href="/shows">Find shows</NavLink>
              <NavLink href="/login">Sign in</NavLink>
              <Link
                href="/signup"
                className="group inline-flex items-center gap-2 rounded-md bg-accent-400 px-4 py-2 text-sm font-semibold text-brand-950 transition-colors duration-300 hover:bg-accent-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-300"
              >
                Get started
                <Arrow />
              </Link>
            </nav>
          </div>
        </header>

        <section className="mx-auto grid w-full max-w-[87.5rem] items-center gap-16 px-6 pb-24 pt-16 sm:px-10 lg:grid-cols-[1.05fr_0.95fr] lg:pb-32 lg:pt-24">
          <div>
            <h1
              className="anim-rise font-display text-[clamp(3rem,7vw,5.75rem)] font-semibold leading-[1.05] tracking-tight text-stone-50"
              style={{ "--rise-delay": "0s" } as React.CSSProperties}
            >
              Run the show.
              <br />
              Validate everything.
              <br />
              <em className="text-accent-300">Submit clean results.</em>
            </h1>
            <p
              className="anim-rise mt-8 max-w-lg text-lg leading-relaxed text-stone-300"
              style={{ "--rise-delay": "0.1s" } as React.CSSProperties}
            >
              The horse show operating system: entries, eligibility, scoring,
              payouts, and the official submission package — one system
              protecting the show from mistakes all weekend.
            </p>
            <div
              className="anim-rise mt-10 flex flex-wrap items-center gap-6"
              style={{ "--rise-delay": "0.2s" } as React.CSSProperties}
            >
              <Link
                href="/signup"
                className="group inline-flex items-center gap-2.5 rounded-md bg-accent-400 px-6 py-3 text-base font-semibold text-brand-950 transition-colors duration-300 hover:bg-accent-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-300"
              >
                Create your organization
                <Arrow />
              </Link>
              <Link
                href="/login"
                className="text-base font-medium text-stone-300 underline decoration-stone-600 underline-offset-4 transition-colors duration-300 hover:text-white hover:decoration-accent-400 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-400"
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

      {/* -------------------------------------------- credibility marquee */}
      <div className="marquee overflow-hidden border-b border-stone-200/70 bg-paper py-5 dark:border-stone-800">
        <div className="marquee-track flex w-max">
          {[0, 1].map((copy) => (
            <p
              key={copy}
              aria-hidden={copy === 1}
              className="flex shrink-0 items-center font-mono text-[11px] uppercase tracking-[0.22em] text-stone-500 dark:text-stone-400"
            >
              {MARQUEE_ITEMS.map((item) => (
                <span key={item} className="flex items-center">
                  <span className="px-6">{item}</span>
                  <span aria-hidden className="text-accent-500">
                    ·
                  </span>
                </span>
              ))}
            </p>
          ))}
        </div>
      </div>

      <main className="flex-1">
        {/* -------------------------------------------- the weekend, staged */}
        <section className="mx-auto w-full max-w-[87.5rem] px-6 py-24 sm:px-10 lg:py-32">
          <h2 className="font-display max-w-2xl text-4xl font-semibold leading-[1.1] tracking-tight text-stone-900 sm:text-5xl dark:text-stone-50">
            A show weekend, protected at every stage
          </h2>
          <p className="mt-6 max-w-xl text-lg text-stone-600 dark:text-stone-400">
            The same arc every show runs — with validation standing between
            each step and the mistakes that used to surface after the show.
          </p>

          <ol className="mt-16 grid gap-px overflow-hidden rounded-sm border border-stone-200/70 bg-stone-200/70 sm:grid-cols-2 lg:grid-cols-3 dark:border-stone-800 dark:bg-stone-800">
            {WEEKEND_STAGES.map((stage, i) => (
              <li
                key={stage.name}
                className="group bg-paper p-8 transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-white lg:p-10 dark:hover:bg-stone-900"
              >
                <span className="font-mono text-sm text-stone-400 transition-colors duration-300 group-hover:text-accent-600 dark:group-hover:text-accent-400">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="font-display mt-4 text-xl font-semibold text-stone-900 dark:text-stone-100">
                  {stage.name}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
                  {stage.copy}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* ------------------------------------------------- differentiators */}
        <section className="border-y border-stone-200/70 bg-white py-24 lg:py-32 dark:border-stone-800 dark:bg-stone-900">
          <div className="mx-auto grid w-full max-w-[87.5rem] gap-16 px-6 sm:px-10 lg:grid-cols-2 lg:gap-24">
            <div className="lg:border-r lg:border-stone-200/70 lg:pr-24 dark:lg:border-stone-800">
              <h3 className="font-display text-3xl font-semibold leading-[1.15] tracking-tight text-stone-900 dark:text-stone-50">
                A rule change never means a code change
              </h3>
              <p className="mt-6 leading-relaxed text-stone-600 dark:text-stone-400">
                <strong className="font-semibold text-stone-900 dark:text-stone-100">
                  Rules are data, not code.
                </strong>{" "}
                Class codes, eligibility conditions, fee caps, and export
                schemas live in versioned association rule packages with a
                review lifecycle. Seed NRHA, AQHA, or APHA starters — each
                eligibility rule carries its citation back to the rulebook —
                then edit everything as your association&apos;s rules evolve.
              </p>
            </div>
            <div>
              <h3 className="font-display text-3xl font-semibold leading-[1.15] tracking-tight text-stone-900 dark:text-stone-50">
                Every role sees exactly its own job
              </h3>
              <p className="mt-6 leading-relaxed text-stone-600 dark:text-stone-400">
                <strong className="font-semibold text-stone-900 dark:text-stone-100">
                  Built for the show office.
                </strong>{" "}
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
        <section className="mx-auto w-full max-w-[87.5rem] px-6 py-24 text-center sm:px-10 lg:py-32">
          <h2 className="font-display mx-auto max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight text-stone-900 sm:text-5xl dark:text-stone-50">
            From the first entry to a clean submission package
          </h2>
          <p className="mx-auto mt-6 max-w-md text-lg text-stone-600 dark:text-stone-400">
            Set up your organization, bring in a rule package, and build your
            show — entries to export.
          </p>
          <div className="mt-10 flex justify-center">
            <Link
              href="/signup"
              className="group inline-flex items-center gap-2.5 rounded-md bg-brand-700 px-8 py-4 text-base font-semibold text-white transition-colors duration-300 hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              Create your organization
              <Arrow />
            </Link>
          </div>
          <p className="font-display mt-8 text-lg italic text-stone-500 dark:text-stone-400">
            Ready when your first show is.
          </p>
        </section>
      </main>

      <footer className="border-t border-stone-200/70 px-6 py-10 sm:px-10 dark:border-stone-800">
        <div className="mx-auto flex w-full max-w-[87.5rem] flex-col items-center gap-4 text-center">
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
