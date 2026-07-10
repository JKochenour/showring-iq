# ShowRing IQ — Session Handoff (2026-07-09/10)

This is a plain-text snapshot of where this project stood at the end of a
long build session. Claude's persistent memory has the same content and
will load automatically in a fresh conversation — this file is just a
visible copy you can open yourself.

## Status: full 10-sprint MVP + follow-ons, built, committed, DB-verified live

15 commits on `main`, working tree clean:

| Commit | What |
|---|---|
| 4235a04 | Initial `create-next-app` scaffold |
| ea964bd | Sprint 1 — Foundation: auth, organizations, members, roles/permissions |
| 4170634 | Sprint 2 — Shows: creation, dashboard, settings, staff |
| 619ef51 | Sprint 3 — Classes: CRUD, fees in cents, schedule order |
| 02e39a2 | Sprint 4 — People & horses: profiles, memberships, registrations, ownership |
| e0ea49b | Sprint 5 — Entries: creation, class selection, back numbers, scratches |
| 3ad17f9 | Sprint 6 — Check-in & validation: rule engine, issues dashboard, check-in |
| 03e8285 | Sprint 7 — Draws & gate: draw generation, gate screen, announcer view |
| cf488fa | Sprint 8 — Scoring: judge/secretary entry, verification, corrections |
| 6b56a7b | Sprint 9 — Results: placings, ties-stand, publish/unpublish, overrides |
| 23fe49d | Sprint 10 — NRHA export v1: ReinerSuite CSV, readiness checklist |
| 26337d4 | PDF results + informational fee/retainage tally |
| c33461b | Full NRHA ZIP package, payout engine v1, rule-package foundation |
| 86587a7 | Help & Support page + floating AI chat widget |
| a80c427 | Bugfix: migration 00009 used the reserved keyword `placing` unquoted |

Build (`npm run build`) and lint (`npm run lint`) passed after every commit.
Only known noise: 2 benign react-compiler warnings about RHF's `watch()`.

## Database

All 11 migrations (`supabase/migrations/00001`–`00011`) are applied and
verified live in the Supabase project `dmyejohfauijbuizboos.supabase.co`.

**Bug fixed along the way:** migration 00009 used `placing` as a bare column
name — `PLACING` is a reserved Postgres keyword (from `OVERLAY(...
PLACING ...)`). Fixed by quoting it (`"placing"`) everywhere in 00009 and
00011. No TypeScript changes were needed.

## What's built

Auth & multi-tenant RLS · Organizations & members · Shows (full lifecycle) ·
Classes (fees in cents, NRHA codes) · People & horses (memberships/
registrations) · Entries & back numbers · Validation/Issues engine ·
Draws & Gate/Announcer · Scoring (tenths-of-a-point) · Results (ties-stand
placings) · Payout engine v1 (configurable, labeled "confirm before use") ·
NRHA CSV + full ZIP export · Rule-package foundation (not yet wired into
Classes/Entries/Issues) · Help & Support page + AI chat widget (Anthropic API).

## What's explicitly NOT done (deliberate, not oversight)

- Rule packages exist as data but aren't consulted by Classes/Entries/Issues yet.
- No `class_judges` assignment table (any `score.enter` holder can act as any judge).
- No document management — NRHA ZIP is missing collected paperwork.
- No audit-log excerpt in the ZIP (`log_audit` isn't tagged with `show_id`).
- No confirmed real payout formula — the schedule ships as a labeled example.
- Everything CLAUDE.md's MVP section defers: AI extraction, offline mode,
  Stripe, public live results, other associations, analytics, SMS, API integrations.

## The actual next step: live browser end-to-end test

Every feature above has only ever been verified via `npm run build` /
`npm run lint` / raw REST probes — **never by actually clicking through the
app as a signed-in user.** Now that all migrations are live, that's the
highest-value next move.

This got blocked at end of session because:
1. The browser tooling (both the built-in preview and the Claude-in-Chrome
   extension) was unreachable in that session.
2. Claude cannot create a user account or enter a password itself, even a
   throwaway dev-database test account — a human has to sign up/log in first.

**To resume:** sign in to ShowRing IQ yourself in the preview browser, then
ask Claude to click through: create org → show → staff → classes (NRHA
code/pattern/fees) → people/horses (membership/registration numbers) →
entries → back numbers → Issues tab → check-in → generate a draw → Gate/
Announcer → score entry/submit/verify → mark class official → results →
payout schedule/calculate → Exports (CSV/PDF/ZIP) → Rule Packages → Help page/chat.

## Environment / secrets

- Supabase: connected, `.env.local` filled in.
- `ANTHROPIC_API_KEY`: placeholder only — **not yet filled in**. The Help
  chat widget will say "not configured" until a real key from
  console.anthropic.com is added.
- Dev server: port 3000 is occupied by irDashies (iRacing overlay) on this
  machine, so the preview tool auto-picks a different port each restart.

## Gotchas to remember

- `placing` is a reserved Postgres keyword — quote it if ever reused raw.
- RHF + Zod: schemas with `z.coerce`/`z.preprocess` need
  `useForm<z.input<S>, unknown, z.output<S>>` or the build fails.
- PowerShell: double quotes inside a `git commit -m @'...'@` here-string
  break argv passing to git.exe — avoid them in commit messages.
- Next.js 16 uses `src/proxy.ts` (default export), not `middleware.ts`.
- Route handlers returning JSX (e.g. `@react-pdf/renderer`) must be named
  `route.tsx`, not `route.ts`.
- `NextResponse` needs `new Uint8Array(buffer)`, not a raw Node `Buffer`.
- Project folder name "New Horse Show" isn't npm-safe; package is `showring-iq`.

## Full technical detail

Every sprint's per-file breakdown, architecture rationale, and design
decisions are also in Claude's persistent memory (`sprint-progress.md`),
which loads automatically in any future conversation about this project —
just pick up the conversation and it'll have full context.
