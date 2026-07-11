# ShowRing IQ — Session Handoff (updated 2026-07-10)

This is a plain-text snapshot of where this project stands. Claude's
persistent memory has the same content and loads automatically in a
fresh conversation — this file is just a visible copy you can open
yourself.

## Status: MVP sprints + four major follow-on features, all committed, DB-verified live

30 commits on `main`, working tree clean:

| Commit | What |
|---|---|
| 4235a04 | Initial `create-next-app` scaffold |
| ea964bd–23fe49d | Sprints 1–10: foundation through NRHA CSV export v1 (see prior handoff detail in memory) |
| 26337d4 | PDF results + informational fee/retainage tally |
| c33461b | Full NRHA ZIP package, payout engine v1, rule-package foundation |
| 86587a7 | Help & Support page + floating AI chat widget |
| a80c427 | Bugfix: migration 00009 used the reserved keyword `placing` unquoted |
| 7ea89ab | CSV import for People and Horses |
| b49b76c | Fix CSV import column-mapping for real-world spreadsheet headers |
| 18e9fac | Support co-owned horses in CSV import |
| e9fb064 | Bulk-select and delete on People and Horses lists |
| 27e71b0 | XLSX import support + searchable typeahead comboboxes (site-wide) |
| f205502 | Collapsible per-org shortcuts in the sidebar |
| 92f2533 | Nested shows + their tabs into the sidebar |
| ce4f04c | **Wired rule packages into Classes, Entries, and Issues** |
| 69bc1e3 | Delete for class codes, eligibility rules, draft rule packages |
| 2e4bc89 | **Document management**: upload, verify, NRHA export inclusion |
| 540d2ba | **Exhibitor-facing self-service entry** |
| 3e187ff, 93c3ede | Handoff doc (added, then refreshed) |
| 8960213 | **Exhibitor self-service profile/horses + staff "missing paperwork" widget** |

Build (`npm run build`) and lint (`npm run lint`) passed after every
commit. Only known noise: 2 benign react-compiler warnings about RHF's
`watch()`.

## Database

All 15 migrations (`supabase/migrations/00001`–`00015`) are applied and
verified live in the Supabase project `dmyejohfauijbuizboos.supabase.co`,
confirmed by the user directly in the SQL Editor.

## What's built

Everything from the original 10-sprint MVP (auth, orgs, shows, classes,
people/horses, entries/back numbers, check-in/validation, draws/gate,
scoring, results, NRHA CSV export), plus:

- **PDF results, full NRHA ZIP package, payout engine v1, Help/AI chat.**
- **CSV/XLSX spreadsheet import** for People, Horses (with co-owner
  support — one row per owner, matched by name/registration number),
  and rule-package class codes (upsert-by-code, the safe path for
  updating a rule package for a new year). CSV-only was the original
  scope; XLSX support was added via `read-excel-file` (the alternative
  `xlsx` npm package was deliberately avoided — unpatched CVEs).
- **Searchable typeahead comboboxes** site-wide on every dropdown that
  picks a person/horse from a growing list (entry creation, horse
  ownership, show staff) — type to filter, arrow keys + Enter to pick.
- **Collapsible sidebar**: each org expands into Overview/Shows/People/
  Horses/Rule Packages/Members/Settings/Audit log; each show under it
  further expands into its own full tab set. Two clicks from anywhere
  to any page.
- **Rule packages are now live wiring, not inert data.** A class links
  to a specific `association_class_codes` row (searchable combobox);
  published rule packages' eligibility rules evaluate on every entry
  via a generic condition engine (`src/lib/rule-package-engine.ts`),
  merged into the Issues tab. A "Start from NRHA's public class list"
  action seeds a draft package from NRHA's public category taxonomy
  (names/flags only — never scraped/copied NRHA's copyrighted numeric
  codes or Handbook text). The org's real 89-class NRHA list is loaded
  into "NRHA 2026 v1" via the CSV importer.
- **Document management**: upload/verify/reject/delete for membership
  cards, Coggins, health certs, etc., attached to a person and/or
  horse. Private Supabase Storage bucket, signed URLs only. Verified
  documents auto-include in the NRHA ZIP export's `paperwork/` folder.
  Staff show dashboard has a "Missing paperwork" card summarizing
  riders/horses with no verified docs, docs awaiting verification, and
  expired documents.
- **Exhibitor-facing self-service entry** — the biggest architectural
  addition. A `people` row can now link to a login (`people.user_id`).
  A zero-permission "Exhibitor" org role gets access entirely through
  dedicated self-scoped RLS policies (own person/horses/entries/
  documents only, never the broad office-role permission grants) — one
  exhibitor architecturally cannot see another's data. Staff invites a
  person as an exhibitor from their Person detail page (reuses the
  existing invite/accept-invite system, extended to pre-link a
  `person_id`). Full `/exhibitor/[orgId]/...` route set: dashboard,
  published-shows list, self-entry flow with live eligibility feedback
  (✕ reasons shown inline, reusing the rule-package engine), self-
  scratch while a show is published, **self-service profile editing**
  (contact info only — name/roles stay staff-managed), and **self-
  service horse management** (add/edit their own horses; registered
  name locked after creation, via dedicated RPCs rather than raw table
  grants — see Gotchas). No payment processing — Stripe is still
  deliberately deferred; fees shown are informational only.

## What's explicitly NOT done (deliberate, not oversight)

- Real payment processing (Stripe) — informational fees only everywhere.
- No `class_judges` assignment table (any `score.enter` holder can act
  as any judge).
- No audit-log excerpt in the NRHA ZIP (`log_audit` isn't tagged with
  `show_id`, so a reliable per-show filter needs a schema change).
- Multi-affiliation classes (one class counting for two associations
  at once) — current wiring is single-code-per-class.
- Everything CLAUDE.md's MVP section defers: AI extraction, offline
  mode, public live results, other associations, analytics, SMS.

## The actual next step: live browser verification of the exhibitor flow

Rule packages and document management were both verified live in the
browser (created a real rule package, imported real NRHA codes,
uploaded a test document, confirmed graceful error handling). **The
entire exhibitor flow (invite, profile, horses, entry, scratch) was
built and passed lint/build cleanly but has never been verified live
in a browser.** All the SQL migrations behind it (00012–00015) are now
confirmed applied, so nothing should be blocking a real end-to-end
test anymore except actually clicking through it.

**To resume:** sign in to ShowRing IQ in the preview browser yourself
(Claude cannot sign in — that's a hard boundary, even for its own dev/
test accounts), then ask Claude to: open a Person's detail page →
"Invite as exhibitor" with a test email → sign in as that exhibitor (or
accept the invite in the current session, if using the same email) →
confirm the person/horses claim correctly → visit
`/exhibitor/[orgId]/dashboard` → try "My profile" and "My horses" self-
edit → enter a published show, confirm eligible-by-default/ineligible-
with-reasons rendering → submit an entry → confirm it shows up in the
office's Entries tab and the "Missing paperwork" dashboard card reacts
correctly → self-scratch a class → confirm the office sees the scratch.

## Environment / secrets

- Supabase: connected, `.env.local` filled in, all 15 migrations live.
- `ANTHROPIC_API_KEY`: check whether this was ever filled in — as of
  the last confirmed state it was still a placeholder, so the Help
  chat widget would report "not configured."
- Dev server: port 3000 is occupied by irDashies (iRacing overlay) on
  this machine, so the preview tool auto-picks a different port each
  restart — but note a *second* concurrent Claude Code session has
  also been running its own `next dev` on port 3000 throughout this
  work, which is why "port already in use" errors are expected and
  harmless (connect to the existing server via `preview_start` with a
  literal `http://localhost:3000` URL instead of starting a new one).

## Gotchas to remember

- `placing` is a reserved Postgres keyword — quote it if ever reused raw.
- RHF + Zod: schemas with `z.coerce`/`z.preprocess` need
  `useForm<z.input<S>, unknown, z.output<S>>` or the build fails.
- PowerShell: double quotes inside a `git commit -m @'...'@` here-string
  break argv passing to git.exe — avoid them in commit messages.
- Next.js 16 uses `src/proxy.ts` (default export), not `middleware.ts`.
- Route handlers returning JSX (e.g. `@react-pdf/renderer`) must be
  named `route.tsx`, not `route.ts`.
- `NextResponse` needs `new Uint8Array(buffer)`, not a raw Node `Buffer`.
- The npm `xlsx` package has unpatched high-severity CVEs — use
  `read-excel-file` (subpath imports only: `read-excel-file/browser`,
  no root export) instead.
- RLS permission grants are dangerous to over-grant: `org.view` gates
  broad SELECT on people/horses/memberships/documents — the Exhibitor
  role deliberately has *zero* catalog permissions and relies entirely
  on row-ownership RLS policies instead, to avoid one exhibitor seeing
  another's data.
- Self-service UPDATE/INSERT for exhibitors (profile, horses) goes
  through security-definer RPCs with an explicit column whitelist, not
  raw table RLS policies — the default column grants on `people`/
  `horses` are broad (needed for staff), so a naive UPDATE policy would
  let an exhibitor set fields like `roles` that must stay staff-managed.
- Project folder name "New Horse Show" isn't npm-safe; package is
  `showring-iq`.

## Full technical detail

Every sprint's per-file breakdown, architecture rationale, and design
decisions are also in Claude's persistent memory (`sprint-progress.md`
and `rule-packages-documents-exhibitor.md`), which loads automatically
in any future conversation about this project.
