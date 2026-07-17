import Link from "next/link";

// ---------------------------------------------------------------------------
// Marketing homepage — "mission control for the show weekend."
// Ultra-sleek technical direction: one deep oiled-leather canvas, Space
// Grotesk display type at oversized scale, Geist Mono for anything that is
// data, weathered turquoise (silver-mounted tack) as the single accent.
// Depth comes from white/10 hairlines, a
// quiet radial wash in the hero, and an asymmetric bento grid. One motion
// choreography: hero copy rises, the console card posts its rows, the seal
// stamps, the marquee drifts. Copy is preserved verbatim from the prior
// design; only the presentation layer changed.
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
    feature: false,
  },
  {
    name: "Validation",
    copy: "Memberships, licenses, birthdates, ownership — checked continuously and surfaced by severity, not discovered at export.",
    feature: true,
  },
  {
    name: "Draw & gate",
    copy: "Seeded draws with rider spacing, and a one-tap gate flow that keeps concurrent classes in lockstep.",
    feature: false,
  },
  {
    name: "Scoring",
    copy: "Judge-signed cards, verification, corrections with a required reason — every change audited with before and after.",
    feature: false,
  },
  {
    name: "Results",
    copy: "Placings, tie handling, and payouts to the penny — retainage where it applies, never on youth classes.",
    feature: false,
  },
  {
    name: "Submission",
    copy: "The ReinerSuite CSV, PDF results, score sheets, and audit log in one package — blocking issues stop the export before the association ever sees it.",
    feature: true,
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

/** Nav link with a turquoise underline that grows in from the left. */
function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="relative font-medium text-stone-400 transition-colors duration-300 after:absolute after:-bottom-1.5 after:left-0 after:h-px after:w-0 after:bg-brand-400 after:transition-[width] after:duration-300 after:ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-white hover:after:w-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-400"
    >
      {children}
    </Link>
  );
}

/** The hero artifact: a live results console. */
function ResultsConsole() {
  return (
    <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#211A15] p-6 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)] sm:p-8">
      <div
        className="anim-rise flex items-center justify-between border-b border-white/10 pb-4"
        style={{ "--rise-delay": "0.35s" } as React.CSSProperties}
      >
        <span className="font-mono text-sm font-semibold uppercase tracking-[0.12em] text-stone-100">
          Class 7 — Open
        </span>
        <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-stone-500">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand-400" />
          Sat · Pattern 9
        </span>
      </div>

      <div className="mt-4 grid grid-cols-[2rem_3rem_1fr_auto] gap-x-3 font-mono text-[10px] uppercase tracking-[0.16em] text-stone-600">
        <span>Draw</span>
        <span>Back</span>
        <span>Horse · Rider</span>
        <span className="text-right">Score</span>
      </div>

      <ul className="mt-1 divide-y divide-white/5">
        {CARD_ROWS.map((r, i) => (
          <li
            key={r.draw}
            className="anim-rise grid grid-cols-[2rem_3rem_1fr_auto] items-baseline gap-x-3 py-2.5"
            style={{ "--rise-delay": `${ROW_DELAY(i)}s` } as React.CSSProperties}
          >
            <span className="font-mono text-sm text-stone-600">{r.draw}</span>
            <span className="font-mono text-sm font-medium text-stone-300">{r.back}</span>
            <span className="truncate text-sm text-stone-300">
              {r.horse}
              <span className="text-stone-500"> · {r.rider}</span>
            </span>
            <span className="text-right font-mono text-sm font-semibold tabular-nums text-stone-100">
              {r.score}
            </span>
          </li>
        ))}
      </ul>

      <div
        className="anim-stamp mt-4 flex items-center gap-3 rounded-lg border border-brand-500/30 bg-brand-500/5 px-4 py-3"
        style={{ "--rise-delay": `${SEAL_DELAY}s` } as React.CSSProperties}
      >
        <span
          aria-hidden
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand-500/50 text-brand-400"
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
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-brand-400">
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
    <div className="flex min-h-screen flex-col bg-[#17120F] text-stone-200">
      <header className="border-b border-white/10">
        <div className="mx-auto flex w-full max-w-[87.5rem] items-center justify-between px-6 py-6 sm:px-10">
          <span className="font-grotesk text-xl font-semibold tracking-tight text-white">
            ShowRing <span className="text-brand-400">IQ</span>
          </span>
          <nav className="flex items-center gap-8 text-sm">
            <NavLink href="/shows">Find shows</NavLink>
            <NavLink href="/login">Sign in</NavLink>
            <Link
              href="/signup"
              className="group inline-flex items-center gap-2 rounded-md bg-brand-400 px-4 py-2 text-sm font-semibold text-[#17120F] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-[1.03] hover:bg-brand-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300"
            >
              Get started
              <Arrow />
            </Link>
          </nav>
        </div>
      </header>

      {/* --------------------------------------------------------------- hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_70%_-10%,rgba(67,167,156,0.16),transparent_65%)]"
        />
        <div className="relative mx-auto grid w-full max-w-[87.5rem] items-center gap-16 px-6 pb-24 pt-16 sm:px-10 lg:grid-cols-[1.05fr_0.95fr] lg:pb-32 lg:pt-24">
          <div>
            <h1
              className="anim-rise font-grotesk text-[clamp(3rem,7vw,6rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-white"
              style={{ "--rise-delay": "0s" } as React.CSSProperties}
            >
              Run the show.
              <br />
              Validate everything.
              <br />
              <span className="bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent">
                Submit clean results.
              </span>
            </h1>
            <p
              className="anim-rise mt-8 max-w-lg text-lg leading-relaxed text-stone-400"
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
                className="group inline-flex items-center gap-2.5 rounded-md bg-brand-400 px-6 py-3 text-base font-semibold text-[#17120F] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-[1.03] hover:bg-brand-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300"
              >
                Create your organization
                <Arrow />
              </Link>
              <Link
                href="/login"
                className="text-base font-medium text-stone-400 underline decoration-stone-700 underline-offset-4 transition-colors duration-300 hover:text-white hover:decoration-brand-400 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-400"
              >
                Sign in
              </Link>
            </div>
          </div>

          <div className="mx-auto w-full max-w-md lg:justify-self-end">
            <ResultsConsole />
          </div>
        </div>
      </section>

      {/* -------------------------------------------------- credibility marquee */}
      <div className="marquee overflow-hidden border-y border-white/10 py-5">
        <div className="marquee-track flex w-max">
          {[0, 1].map((copy) => (
            <p
              key={copy}
              aria-hidden={copy === 1}
              className="flex shrink-0 items-center font-mono text-[11px] uppercase tracking-[0.22em] text-stone-500"
            >
              {MARQUEE_ITEMS.map((item) => (
                <span key={item} className="flex items-center">
                  <span className="px-6">{item}</span>
                  <span aria-hidden className="text-brand-500">
                    ·
                  </span>
                </span>
              ))}
            </p>
          ))}
        </div>
      </div>

      <main className="flex-1">
        {/* ------------------------------------------------ the weekend, bento */}
        <section className="mx-auto w-full max-w-[87.5rem] px-6 py-24 sm:px-10 lg:py-32">
          <h2 className="font-grotesk max-w-2xl text-4xl font-semibold leading-[1.1] tracking-[-0.02em] text-white sm:text-5xl">
            A show weekend, protected at every stage
          </h2>
          <p className="mt-6 max-w-xl text-lg text-stone-400">
            The same arc every show runs — with validation standing between
            each step and the mistakes that used to surface after the show.
          </p>

          <ol className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {WEEKEND_STAGES.map((stage, i) => (
              <li
                key={stage.name}
                className={`group rounded-xl border border-white/10 p-8 transition-[border-color,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-brand-500/40 ${
                  stage.feature
                    ? "bg-[radial-gradient(ellipse_120%_100%_at_0%_0%,rgba(67,167,156,0.13),transparent_70%)] sm:col-span-2"
                    : "bg-white/[0.02]"
                }`}
              >
                <span className="font-mono text-sm text-stone-600 transition-colors duration-300 group-hover:text-brand-400">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="font-grotesk mt-4 text-xl font-semibold tracking-tight text-white">
                  {stage.name}
                </h3>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-stone-400">
                  {stage.copy}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* --------------------------------------------------- differentiators */}
        <section className="border-y border-white/10">
          <div className="mx-auto grid w-full max-w-[87.5rem] gap-16 px-6 py-24 sm:px-10 lg:grid-cols-2 lg:gap-24 lg:py-32">
            <div className="lg:border-r lg:border-white/10 lg:pr-24">
              <h3 className="font-grotesk text-3xl font-semibold leading-[1.15] tracking-[-0.02em] text-white">
                A rule change never means a code change
              </h3>
              <p className="mt-6 leading-relaxed text-stone-400">
                <strong className="font-semibold text-stone-100">
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
              <h3 className="font-grotesk text-3xl font-semibold leading-[1.15] tracking-[-0.02em] text-white">
                Every role sees exactly its own job
              </h3>
              <p className="mt-6 leading-relaxed text-stone-400">
                <strong className="font-semibold text-stone-100">
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

        {/* ----------------------------------------------------------- final CTA */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_50%_120%,rgba(67,167,156,0.1),transparent_70%)]"
          />
          <div className="relative mx-auto w-full max-w-[87.5rem] px-6 py-24 text-center sm:px-10 lg:py-32">
            <h2 className="font-grotesk mx-auto max-w-3xl text-4xl font-semibold leading-[1.1] tracking-[-0.02em] text-white sm:text-5xl">
              From the first entry to a clean submission package
            </h2>
            <p className="mx-auto mt-6 max-w-md text-lg text-stone-400">
              Set up your organization, bring in a rule package, and build your
              show — entries to export.
            </p>
            <div className="mt-10 flex justify-center">
              <Link
                href="/signup"
                className="group inline-flex items-center gap-2.5 rounded-md bg-brand-400 px-8 py-4 text-base font-semibold text-[#17120F] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-[1.03] hover:bg-brand-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300"
              >
                Create your organization
                <Arrow />
              </Link>
            </div>
            <p className="mt-8 font-mono text-xs uppercase tracking-[0.22em] text-stone-500">
              Ready when your first show is.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 px-6 py-10 sm:px-10">
        <div className="mx-auto flex w-full max-w-[87.5rem] flex-col items-center gap-4 text-center">
          <span className="font-grotesk text-sm font-semibold tracking-tight text-stone-300">
            ShowRing <span className="text-brand-400">IQ</span>
          </span>
          <p className="max-w-xl text-xs leading-relaxed text-stone-500">
            Validation assistance based on configured rule package. Final
            responsibility remains with show management and the applicable
            association.
          </p>
        </div>
      </footer>
    </div>
  );
}
