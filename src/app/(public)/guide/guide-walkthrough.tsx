"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";

/**
 * Interactive step-by-step show-setup walkthrough. The "screens" are
 * component-accurate UI frames rendered from the app's own design tokens —
 * illustrative representations of each stage, deliberately NOT screenshots of
 * live data (this is a public page; no real exhibitor names appear here).
 */

// --------------------------------------------------------------- UI frame kit
// Small primitives that make each mock screen read like the real app without
// pulling in the full component tree or any real data.

function Frame({ path, children }: { path: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm dark:border-stone-800 dark:bg-stone-900">
      <div className="flex items-center gap-2 border-b border-stone-200 bg-stone-50 px-4 py-2.5 dark:border-stone-800 dark:bg-stone-950/40">
        <span className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-stone-300 dark:bg-stone-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-stone-300 dark:bg-stone-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-stone-300 dark:bg-stone-700" />
        </span>
        <span className="ml-2 font-mono text-[11px] text-stone-400">{path}</span>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-stone-400">
        {label}
      </span>
      <span className="block rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 dark:border-stone-700 dark:bg-stone-950/40 dark:text-stone-200">
        {value}
      </span>
    </label>
  );
}

function PrimaryBtn({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white">
      {children}
    </span>
  );
}

const SEV: Record<string, string> = {
  blocking: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  ok: "bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300",
};

function Tag({ tone, children }: { tone: keyof typeof SEV; children: ReactNode }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${SEV[tone]}`}>
      {children}
    </span>
  );
}

// ------------------------------------------------------------------- screens
function OrgScreen() {
  return (
    <Frame path="/organizations/new">
      <p className="mb-4 text-sm font-semibold text-stone-900 dark:text-stone-100">
        New organization
      </p>
      <div className="space-y-3">
        <Field label="Organization name" value="Eastern PA Reining Horse Assn." />
        <Field label="URL slug" value="eprha" />
      </div>
      <div className="mt-4 flex justify-end">
        <PrimaryBtn>Create organization</PrimaryBtn>
      </div>
    </Frame>
  );
}

function PeopleHorsesScreen() {
  return (
    <Frame path="/organizations/eprha/people">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
            People
          </p>
          <ul className="space-y-1.5 text-sm">
            {[
              ["A. Rivera", "Rider · NRHA 1183042"],
              ["M. Chen", "Owner · NRHA 908771"],
              ["T. Brooks", "Trainer · NRHA 774510"],
            ].map(([n, r]) => (
              <li key={n} className="rounded-md border border-stone-200 px-3 py-2 dark:border-stone-800">
                <span className="font-medium text-stone-800 dark:text-stone-100">{n}</span>
                <span className="block text-xs text-stone-500">{r}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
            Horses
          </p>
          <ul className="space-y-1.5 text-sm">
            {[
              ["Gunners Moontune", "Reg. 0642189 · Lic. C-5521"],
              ["Spook Street Cat", "Reg. 0710554 · Lic. C-6033"],
              ["Tinsel N Whizkey", "Reg. 0588120 · Lic. C-4487"],
            ].map(([n, r]) => (
              <li key={n} className="rounded-md border border-stone-200 px-3 py-2 dark:border-stone-800">
                <span className="font-medium text-stone-800 dark:text-stone-100">{n}</span>
                <span className="block text-xs text-stone-500">{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Frame>
  );
}

function ShowScreen() {
  return (
    <Frame path="/organizations/eprha/shows/new">
      <p className="mb-4 text-sm font-semibold text-stone-900 dark:text-stone-100">
        New show
      </p>
      <div className="space-y-3">
        <Field label="Show name" value="EPRHA Summer Slide 2026" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date" value="Jul 16, 2026" />
          <Field label="End date" value="Jul 19, 2026" />
        </div>
        <Field label="Venue" value="Keystone Arena — Harrisburg, PA" />
      </div>
      <div className="mt-4 flex justify-end">
        <PrimaryBtn>Create show</PrimaryBtn>
      </div>
    </Frame>
  );
}

function StaffScreen() {
  return (
    <Frame path="/shows/summer-slide/staff">
      <p className="mb-3 text-sm font-semibold text-stone-900 dark:text-stone-100">
        Show staff
      </p>
      <ul className="divide-y divide-stone-200 text-sm dark:divide-stone-800">
        {[
          ["D. Whitfield", "Judge"],
          ["R. Okafor", "Judge"],
          ["S. Pruitt", "Gate"],
          ["L. Barnes", "Announcer"],
          ["K. Alvarez", "Treasurer"],
        ].map(([n, role]) => (
          <li key={n} className="flex items-center justify-between py-2">
            <span className="text-stone-800 dark:text-stone-100">{n}</span>
            <Tag tone="ok">{role}</Tag>
          </li>
        ))}
      </ul>
    </Frame>
  );
}

function ClassesScreen() {
  return (
    <Frame path="/shows/summer-slide/classes">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">Classes</p>
        <span className="rounded-md border border-stone-300 px-2.5 py-1 text-xs text-stone-500 dark:border-stone-700">
          Import from show bill
        </span>
      </div>
      <div className="overflow-hidden rounded-md border border-stone-200 dark:border-stone-800">
        <div className="grid grid-cols-[2rem_1fr_4rem_3rem_4rem] gap-2 bg-stone-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-stone-400 dark:bg-stone-950/40">
          <span>#</span>
          <span>Class</span>
          <span>Code</span>
          <span>Ptn</span>
          <span className="text-right">Fee</span>
        </div>
        {[
          ["7", "Open", "5100", "9", "$250"],
          ["12", "Green Reiner L1", "5300", "4", "$50"],
          ["18", "Youth 14–18", "6000", "14", "$0"],
        ].map((r) => (
          <div
            key={r[0]}
            className="grid grid-cols-[2rem_1fr_4rem_3rem_4rem] gap-2 border-t border-stone-100 px-3 py-2 text-sm dark:border-stone-800"
          >
            <span className="font-mono text-stone-400">{r[0]}</span>
            <span className="text-stone-800 dark:text-stone-100">{r[1]}</span>
            <span className="font-mono text-stone-500">{r[2]}</span>
            <span className="font-mono text-stone-500">{r[3]}</span>
            <span className="text-right font-mono text-stone-700 dark:text-stone-200">{r[4]}</span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

function EntriesScreen() {
  return (
    <Frame path="/shows/summer-slide/entries/new">
      <p className="mb-4 text-sm font-semibold text-stone-900 dark:text-stone-100">New entry</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Rider" value="A. Rivera" />
        <Field label="Horse" value="Gunners Moontune" />
      </div>
      <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-stone-400">
        Classes
      </p>
      <div className="space-y-1.5 text-sm">
        {[["Open", true], ["Green Reiner L1", true], ["Non Pro Derby", false]].map(
          ([label, on]) => (
            <div
              key={label as string}
              className="flex items-center gap-2 rounded-md border border-stone-200 px-3 py-2 dark:border-stone-800"
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] ${
                  on
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-stone-300 text-transparent dark:border-stone-600"
                }`}
              >
                ✓
              </span>
              <span className="text-stone-800 dark:text-stone-100">{label}</span>
              {!on && (
                <span className="ml-auto text-xs text-red-600 dark:text-red-400">
                  ✕ missing ownership relationship
                </span>
              )}
            </div>
          )
        )}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm text-stone-500">
          Back number <span className="font-mono text-stone-800 dark:text-stone-100">212</span>
        </span>
        <PrimaryBtn>Save entry</PrimaryBtn>
      </div>
    </Frame>
  );
}

function IssuesScreen() {
  return (
    <Frame path="/shows/summer-slide/issues">
      <p className="mb-3 text-sm font-semibold text-stone-900 dark:text-stone-100">
        Validation issues
      </p>
      <ul className="space-y-2 text-sm">
        {[
          ["blocking", "Back number not assigned", "Entry #147 · Spook Street Cat"],
          ["warning", "Membership expires before show", "M. Chen · NRHA 908771"],
          ["ok", "All documents on file", "Entry #212 · Gunners Moontune"],
        ].map(([tone, title, sub]) => (
          <li
            key={title}
            className="flex items-start gap-3 rounded-md border border-stone-200 px-3 py-2 dark:border-stone-800"
          >
            <Tag tone={tone as keyof typeof SEV}>{tone === "ok" ? "clear" : (tone as string)}</Tag>
            <span>
              <span className="block text-stone-800 dark:text-stone-100">{title}</span>
              <span className="block text-xs text-stone-500">{sub}</span>
            </span>
          </li>
        ))}
      </ul>
    </Frame>
  );
}

function GateScreen() {
  return (
    <Frame path="/shows/summer-slide/gate">
      <p className="mb-3 text-sm font-semibold text-stone-900 dark:text-stone-100">
        Gate — Class 7 Open
      </p>
      <div className="space-y-2">
        <div className="rounded-lg border border-brand-500/40 bg-brand-500/5 px-4 py-3">
          <span className="font-mono text-[11px] uppercase tracking-wide text-brand-600 dark:text-brand-400">
            Now
          </span>
          <div className="mt-0.5 flex items-baseline gap-3">
            <span className="font-mono text-2xl font-semibold text-stone-900 dark:text-stone-50">212</span>
            <span className="text-sm text-stone-600 dark:text-stone-300">Gunners Moontune · A. Rivera</span>
          </div>
        </div>
        {[
          ["On deck", "147", "Spook Street Cat · R. Whitfield"],
          ["2 away", "308", "Tinsel N Whizkey · M. Okafor"],
        ].map(([slot, back, who]) => (
          <div key={slot} className="flex items-baseline gap-3 rounded-md border border-stone-200 px-4 py-2 dark:border-stone-800">
            <span className="w-16 font-mono text-[11px] uppercase tracking-wide text-stone-400">{slot}</span>
            <span className="font-mono text-lg font-medium text-stone-700 dark:text-stone-200">{back}</span>
            <span className="text-sm text-stone-500">{who}</span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

function ScoringScreen() {
  return (
    <Frame path="/shows/summer-slide/scoring/7">
      <p className="mb-3 text-sm font-semibold text-stone-900 dark:text-stone-100">
        Scoring — Class 7 Open
      </p>
      <div className="space-y-2 text-sm">
        {[
          ["212", "Gunners Moontune", "72.5", "Verified"],
          ["308", "Tinsel N Whizkey", "73.0", "Submitted"],
          ["147", "Spook Street Cat", "—", "Pending"],
        ].map(([back, horse, score, status]) => (
          <div
            key={back}
            className="grid grid-cols-[3rem_1fr_4rem_5rem] items-center gap-2 rounded-md border border-stone-200 px-3 py-2 dark:border-stone-800"
          >
            <span className="font-mono text-stone-500">{back}</span>
            <span className="truncate text-stone-800 dark:text-stone-100">{horse}</span>
            <span className="rounded border border-stone-300 px-2 py-0.5 text-center font-mono text-stone-700 dark:border-stone-700 dark:text-stone-200">
              {score}
            </span>
            <Tag tone={status === "Verified" ? "ok" : status === "Submitted" ? "warning" : "blocking"}>
              {status}
            </Tag>
          </div>
        ))}
      </div>
    </Frame>
  );
}

function ResultsScreen() {
  return (
    <Frame path="/shows/summer-slide/results/7">
      <p className="mb-3 text-sm font-semibold text-stone-900 dark:text-stone-100">
        Results — Class 7 Open
      </p>
      <div className="overflow-hidden rounded-md border border-stone-200 dark:border-stone-800">
        <div className="grid grid-cols-[2.5rem_1fr_4rem_5rem] gap-2 bg-stone-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-stone-400 dark:bg-stone-950/40">
          <span>Place</span>
          <span>Horse · Rider</span>
          <span>Score</span>
          <span className="text-right">Money</span>
        </div>
        {[
          ["1", "Tinsel N Whizkey · M. Okafor", "73.0", "$480.00"],
          ["2", "Gunners Moontune · A. Rivera", "72.5", "$288.00"],
          ["3", "Smart Lil Dunit · J. Pruitt", "71.5", "$192.00"],
        ].map((r) => (
          <div
            key={r[0]}
            className="grid grid-cols-[2.5rem_1fr_4rem_5rem] gap-2 border-t border-stone-100 px-3 py-2 text-sm dark:border-stone-800"
          >
            <span className="font-mono font-semibold text-brand-700 dark:text-brand-400">{r[0]}</span>
            <span className="truncate text-stone-800 dark:text-stone-100">{r[1]}</span>
            <span className="font-mono text-stone-600 dark:text-stone-300">{r[2]}</span>
            <span className="text-right font-mono text-stone-800 dark:text-stone-100">{r[3]}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-stone-400">Pool balanced · 5% retainage applied · ties split evenly</p>
    </Frame>
  );
}

function ExportScreen() {
  return (
    <Frame path="/shows/summer-slide/exports">
      <div className="flex items-center gap-3 rounded-lg border border-brand-500/30 bg-brand-500/5 px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand-500/50 text-brand-500">
          ✓
        </span>
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
            NRHA submission · Ready
          </p>
          <p className="text-xs text-stone-500">0 blocking issues · package validated</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {["ReinerSuite CSV", "PDF results", "Score sheets", "Full ZIP package"].map((f) => (
          <span
            key={f}
            className="rounded-md border border-stone-300 px-3 py-1.5 text-xs text-stone-600 dark:border-stone-700 dark:text-stone-300"
          >
            ↓ {f}
          </span>
        ))}
      </div>
    </Frame>
  );
}

// -------------------------------------------------------------------- steps
interface Step {
  title: string;
  path: string;
  minutes: number;
  intro: string;
  actions: string[];
  screen: ReactNode;
}

const STEPS: Step[] = [
  {
    title: "Create your organization",
    path: "Organizations → New organization",
    minutes: 2,
    intro:
      "Everything in ShowRing IQ hangs off an organization — your club or association. You create it once, and every future show, person, horse, and template lives under it, so you never re-enter your world each year.",
    actions: [
      "Give the organization a name and a short URL slug (e.g. eprha).",
      "You become its Organization Owner automatically.",
      "Invite staff later from Organization → Members and assign role presets.",
    ],
    screen: <OrgScreen />,
  },
  {
    title: "Add people & horses",
    path: "Organization → People / Horses",
    minutes: 6,
    intro:
      "Build your directory of riders, owners, and trainers, and your horses — with the association membership and registration numbers that eligibility checks depend on. Import a spreadsheet to seed it fast.",
    actions: [
      "Add people with their roles and NRHA (or AQHA/APHA) membership numbers.",
      "Add horses with registration and competition-license numbers, plus ownership.",
      "Duplicate detection flags similar names and matching numbers for review.",
    ],
    screen: <PeopleHorsesScreen />,
  },
  {
    title: "Create the show",
    path: "Organization → Shows → New show",
    minutes: 3,
    intro:
      "Spin up the actual event: name, dates, and venue. The show gets its own dashboard and its own set of tabs for everything from classes to exports.",
    actions: [
      "Set the show name, start/end dates, and venue.",
      "Add the NRHA affiliation and approval number in Settings.",
      "Shows group into weekends/circuits when you run multiple slates.",
    ],
    screen: <ShowScreen />,
  },
  {
    title: "Assign staff",
    path: "Show → Staff",
    minutes: 3,
    intro:
      "Tell the show who's judging, running the gate, announcing, and handling money. Each role sees exactly its own job — judges only their classes, the announcer read-only, and so on.",
    actions: [
      "Assign judges, gate/paddock, announcer, and treasurer.",
      "The event-classification checklist confirms required staffing.",
      "Permissions are enforced in the data layer, not just hidden in the UI.",
    ],
    screen: <StaffScreen />,
  },
  {
    title: "Build the class list",
    path: "Show → Classes",
    minutes: 8,
    intro:
      "Add every class with its NRHA class code, pattern number, entry fee, and added money. Already have a printed show bill? Import it — the parser reads day, arena, times, and fees straight off the PDF.",
    actions: [
      "Set the class code, pattern, entry fee, and added money on each class.",
      "Group classes that run concurrently so they share one draw and go.",
      "Import from a show-bill PDF, then review the editable preview.",
    ],
    screen: <ClassesScreen />,
  },
  {
    title: "Take entries & back numbers",
    path: "Show → Entries → New entry",
    minutes: 10,
    intro:
      "Enter riders and horses into classes and assign back numbers. Ineligible classes still show — with the exact reason — so nobody is turned away without an explanation. Exhibitors can also self-enter online.",
    actions: [
      "Pick rider and horse; check the classes; assign a back number.",
      "One back number per horse for the whole weekend; fees bill to the right party.",
      "Ineligible classes reveal their reason instead of disappearing.",
    ],
    screen: <EntriesScreen />,
  },
  {
    title: "Validate & check in",
    path: "Show → Issues / Check-in",
    minutes: 5,
    intro:
      "The Issues tab watches continuously and sorts problems by severity — missing back numbers, expired memberships, missing documents. You fix them before they become an export problem, or override with a reason that's logged.",
    actions: [
      "Resolve blocking issues, or override with a required, audited reason.",
      "Check entries in with one tap once they're clear.",
      "Nothing dirty reaches the association file after the show.",
    ],
    screen: <IssuesScreen />,
  },
  {
    title: "Draw & run the gate",
    path: "Show → Draws / Gate",
    minutes: 4,
    intro:
      "Generate a seeded draw with rider spacing, then run the show from the one-tap gate board — Now, On deck, 2 away, 3 away — with concurrent classes kept in lockstep. The announcer screen mirrors it, read-only.",
    actions: [
      "Auto-generate the order of go; re-draws are audited.",
      "Drive the gate with one-tap check-in / hold / scratch / drag.",
      "Tablet mode enlarges targets for arena-side use.",
    ],
    screen: <GateScreen />,
  },
  {
    title: "Score & verify",
    path: "Show → Scoring",
    minutes: 6,
    intro:
      "Judges (or the secretary) enter scores and result status in draw order and submit signed cards; a verifier marks them official. After verification, any change is a corrections with a required reason — every edit audited before and after.",
    actions: [
      "Enter score and status (shown / zero / no-score / DQ / excused), then submit.",
      "A Score Verifier reviews and marks scores official.",
      "Corrections capture who, why, and the before/after values.",
    ],
    screen: <ScoringScreen />,
  },
  {
    title: "Results & payouts",
    path: "Show → Results",
    minutes: 5,
    intro:
      "Once a class is official, placings calculate automatically — ties handled per the rules — and payouts distribute to the penny from the schedule you set, with retainage where it applies and never on youth classes.",
    actions: [
      "Placings and tie handling compute from verified scores.",
      "Fill payouts from the NRHA Payback Schedule, or set your own percentages.",
      "The pool balances to the penny; publish to the public results page.",
    ],
    screen: <ResultsScreen />,
  },
  {
    title: "Export the submission package",
    path: "Show → Exports",
    minutes: 4,
    intro:
      "The readiness checklist tells you exactly what's missing until it reads Ready. Then download the ReinerSuite CSV, PDF results, per-class score sheets, and the full ZIP submission package — validated before it ever reaches the association.",
    actions: [
      "Clear every checklist item until NRHA submission reads Ready.",
      "Download the CSV, PDFs, or the complete ZIP package.",
      "Blocking issues stop the export before the association sees it.",
    ],
    screen: <ExportScreen />,
  },
];

export function GuideWalkthrough() {
  const [active, setActive] = useState(0);
  const step = STEPS[active];
  const total = STEPS.length;

  return (
    <div className="grid gap-8 lg:grid-cols-[16rem_1fr] lg:items-start">
      {/* ------------------------------------------------------- step rail */}
      <nav aria-label="Tutorial steps" className="lg:sticky lg:top-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-400">
          {total} steps · start to finish
        </p>
        <ol className="space-y-1">
          {STEPS.map((s, i) => {
            const done = i < active;
            const current = i === active;
            return (
              <li key={s.title}>
                <button
                  onClick={() => setActive(i)}
                  aria-current={current ? "step" : undefined}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
                    current
                      ? "bg-brand-50 font-semibold text-brand-800 dark:bg-brand-950/50 dark:text-brand-300"
                      : "text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800/60"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                      current
                        ? "bg-brand-600 text-white"
                        : done
                          ? "bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
                          : "bg-stone-200 text-stone-500 dark:bg-stone-800 dark:text-stone-400"
                    }`}
                  >
                    {done ? "✓" : i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{s.title}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* ---------------------------------------------------- active step */}
      <div>
        <div className="mb-4 flex items-center gap-3">
          <span className="font-mono text-sm text-stone-400">
            {String(active + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
          <span className="rounded-full bg-stone-100 px-2.5 py-0.5 font-mono text-[11px] text-stone-500 dark:bg-stone-800 dark:text-stone-400">
            {step.path}
          </span>
          <span className="ml-auto text-xs text-stone-400">~{step.minutes} min</span>
        </div>

        <h2 className="font-grotesk text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
          {step.title}
        </h2>
        <p className="mt-3 max-w-2xl leading-relaxed text-stone-600 dark:text-stone-300">
          {step.intro}
        </p>

        <ul className="mt-4 space-y-1.5">
          {step.actions.map((a) => (
            <li key={a} className="flex gap-2.5 text-sm text-stone-700 dark:text-stone-200">
              <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
              <span className="leading-relaxed">{a}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6">{step.screen}</div>

        {/* --------------------------------------------------- prev / next */}
        <div className="mt-6 flex items-center justify-between border-t border-stone-200 pt-4 dark:border-stone-800">
          <button
            onClick={() => setActive((i) => Math.max(0, i - 1))}
            disabled={active === 0}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800"
          >
            ← Previous
          </button>
          <span className="hidden gap-1.5 sm:flex" aria-hidden>
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === active ? "w-6 bg-brand-600" : "w-1.5 bg-stone-300 dark:bg-stone-700"
                }`}
              />
            ))}
          </span>
          {active < total - 1 ? (
            <button
              onClick={() => setActive((i) => Math.min(total - 1, i + 1))}
              className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-800"
            >
              Next →
            </button>
          ) : (
            <Link
              href="/signup"
              className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-800"
            >
              Get started →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
