# ShowRing IQ — Session Handoff (updated 2026-07-10)

This is a plain-text snapshot of where this project stands. Claude's
persistent memory has the same content and loads automatically in a
fresh conversation — this file is just a visible copy you can open
yourself.

## Status: MVP + follow-on features + 4 post-MVP features, all committed. Exhibitor flow live-verified; the 4 newest features are NOT yet browser-tested.

40 commits on `main`, working tree clean:

| Commit | What |
|---|---|
| 4235a04 | Initial `create-next-app` scaffold |
| ea964bd–23fe49d | Sprints 1–10: foundation through NRHA CSV export v1 |
| 26337d4–8960213 | PDF results, full NRHA ZIP, payout engine v1, Help/AI chat, CSV/XLSX import, sidebar nav, rule packages wired live, document management, exhibitor self-service entry + profile/horses |
| e4275c7, 4acc1bb | **Bugfixes found via live browser testing of the exhibitor flow** (see below) |
| 13bc7f5, 969d872 | **class_judges assignment** — judges bound to specific classes, scoring RPCs + UI enforce it |
| c0c8e0f | **Audit log show_id tagging** — 26 RPCs now populate it; NRHA ZIP includes a real per-show `audit_log.txt` |
| 0e4874c, 01eb262 | **Class patterns + judge digital sign-off** — judges see the pattern on their scoring screen; submitting a card requires a typed signature |
| d04d197, 3085fac, 1c8a070 | **Multi-affiliation classes** — one class can count for multiple associations (e.g. NRHA + EPRHA) with per-affiliation eligibility; NRHA export correctly filters to the NRHA-affiliation's code only |

Build (`npm run build`) and lint (`npx eslint src`) passed after every
commit. Only known noise: 2 benign react-compiler warnings about RHF's
`watch()` in `entry-form.tsx`/`staff-manager.tsx`.

**Gotcha:** `npm run lint` (not `npx eslint src`) will pick up
`.claude/worktrees/` if any stale agent worktree directories exist
with `.next` build output inside them — those are gitignored now but
ESLint's own ignore list doesn't know that. Prefer `npx eslint src`
for a clean signal, or `git worktree list` / `git worktree remove` any
leftover worktrees first.

## Database

All 19 migrations (`supabase/migrations/00001`–`00019`) are believed
current in the repo. **Not yet confirmed applied to the live Supabase
project** (`dmyejohfauijbuizboos.supabase.co`) — migrations
00001–00015 were confirmed live in an earlier session; 00016–00019
(class_judges, audit log show_id, class patterns/signoff,
class_affiliations) were written and build/lint-verified this session
but never run against the real database or exercised in a browser.
**This is the actual next step — see below.**

## What's built

Everything from the original 10-sprint MVP, plus rule packages wired
live, document management, exhibitor self-service (entry, profile,
horses — verified live in browser, including fixing 2 real bugs found
that way: a broken invite-accept redirect missing the org id, and a
crashing horse-add form from a Zod schema exported out of a `"use
server"` file), and four new post-MVP features:

- **class_judges assignment**: a Show Manager/Secretary can assign
  judges to specific classes from the class detail page. Judge-only
  actors (holding `score.enter` without the office-level
  `score.edit_unofficial`) can now only enter/submit/reopen scores for
  classes they're assigned to — enforced both in the scoring RPCs
  (`enter_score`/`submit_score`/`reopen_score`) and in the UI (scoring
  list filters to assigned classes; direct-URL access to an unassigned
  class 404s).
- **Audit log show_id tagging**: `log_audit()` takes an optional
  `p_show` param now; every show-scoped RPC and TS server action
  passes it. The NRHA export ZIP includes `audit_log.txt`, a
  chronological per-show excerpt (actor, action, entity, reason,
  before/after).
- **Class patterns + judge digital sign-off**: office staff can set a
  class's pattern (free text and/or a linked already-uploaded
  document); judges see it on their scoring screen. Submitting a score
  card now requires typing a signature name, stored with a timestamp
  on the score row; reopening a submitted card clears the stale
  signature since it must be re-signed.
- **Multi-affiliation classes**: a `class_affiliations` table lets one
  class count for several associations at once, each with its own
  code and counts-for-money/points/year-end flags. Eligibility
  evaluates per affiliation (an entry can be eligible under NRHA but
  flagged under EPRHA for the same class). `classes.class_code_id`
  stays as a legacy pointer, kept in sync with whichever affiliation
  is marked primary, so nothing already built broke. NRHA CSV export
  resolves each class's code via its NRHA-named affiliation
  specifically — an EPRHA-only affiliation no longer leaks into the
  NRHA package.

## What's explicitly NOT done (deliberate, not oversight)

- Real payment processing (Stripe) — informational fees only
  everywhere. Deliberately deferred per CLAUDE.md MVP scope.
- AI extraction, offline mode, public live results, other
  associations, analytics, SMS — all deliberately deferred per
  CLAUDE.md ("Do NOT start with AI, offline, or every association.
  Build the show core first").
- Full scheduling conflict detection (horse/rider double-booked across
  classes, judge double-booked across arenas, missing drags,
  youth-classes-too-late) — CLAUDE.md describes this as a Key
  Workflow but it needs arena/estimated-start-time infrastructure
  (`show_arenas`, computed schedule times) that was never built; only
  within-class draw spacing (rider/trainer) exists today
  (`src/lib/draw.ts`).

## The actual next step: apply migrations 00016–00019 live, then browser-verify all 4 new features

Migrations 00001–00015 were confirmed applied to the live Supabase
project in an earlier session. **00016–00019 have not been.** Before
any of the 4 new features (class_judges, audit show_id, class
patterns/signoff, multi-affiliation) can be tested for real:

1. Apply migrations 00016–00019 to the Supabase project (SQL Editor or
   CLI — check `SETUP.md`/`AGENTS.md` for how this project's migration
   workflow normally runs; there's no `supabase/config.toml` so it's
   not the local CLI stack, it's direct-to-hosted).
2. Sign in to ShowRing IQ in the preview browser yourself (Claude
   cannot sign in — hard boundary, even for dev/test accounts it
   creates itself; ask Claude to drive everything else).
3. **class_judges**: on a class detail page, assign a judge (a
   `people` row with role `judge` needs to exist as `show_staff` with
   `staff_role = 'judge'` first — check whether the org has one, or
   create one). Confirm a judge-only account only sees/can score their
   assigned class, and gets a 404 on an unassigned one.
4. **class patterns + signoff**: add a pattern to a class, confirm it
   shows on the scoring screen, submit a score card and confirm the
   signature prompt/display works, confirm reopening clears the
   signature.
5. **multi-affiliation**: add a second affiliation to an existing
   class (different rule package/code), confirm eligibility evaluates
   per-affiliation on the Issues tab and exhibitor entry screen, and
   confirm the NRHA CSV export only pulls the NRHA-affiliation's code.
6. **audit log**: trigger a few show-scoped actions, generate an NRHA
   export ZIP, confirm `audit_log.txt` is present and populated.

The exhibitor flow (invite → signup → accept → profile → horses →
enter show → scratch) IS fully verified live from an earlier session
in this same day — no need to re-test that unless something regressed.

## Environment / secrets

- Supabase: connected, `.env.local` filled in. Migrations 00001–00015
  confirmed live; 00016–00019 not yet applied (see above).
- `ANTHROPIC_API_KEY`: check whether this was ever filled in — as of
  the last confirmed state it was still a placeholder, so the Help
  chat widget would report "not configured."
- Dev server: port 3000 may be occupied by another process (e.g.
  irDashies, or a concurrent Claude Code session's own `next dev`) —
  the preview tool auto-picks a different port, or connect to an
  existing server via `preview_start` with a literal
  `http://localhost:3000` URL instead of starting a new one.

## Gotchas to remember

- `placing` is a reserved Postgres keyword — quote it if ever reused raw.
- RHF + Zod: schemas with `z.coerce`/`z.preprocess` need
  `useForm<z.input<S>, unknown, z.output<S>>` or the build fails.
- Zod schemas that a client component needs (e.g. for `zodResolver`)
  must NOT be exported from a `"use server"` file — Next.js strips
  non-async-function exports from those files, so the client gets a
  broken reference. Keep shared schemas in `src/lib/validation/*.ts`
  and have both the server action file and the client form import
  from there. (This caused a real crash on the exhibitor horse-add
  form, fixed in e4275c7.)
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
  raw table RLS policies.
- Custom UI primitives aren't native form elements: the searchable
  `Combobox` component (`src/components/combobox.tsx`) selects options
  via `onMouseDown`, not `onClick`, and opens its listbox on focus/typing
  (React state), not a native `<select>`. Automation tooling that
  simulates clicks/focus via `.click()`/`.focus()` on the DOM may not
  trigger React's synthetic handlers reliably — dispatching a real
  `mousedown` MouseEvent on the option element is what actually works.
- Some `"use client"` buttons in this app are `type="button"` with an
  `onClick`-driven `startTransition(...)` server action call, not a
  real form submit — clicking via accessibility-tree refs can silently
  no-op in some automation contexts; falling back to a native
  `el.click()` (or dispatching the right raw event, per above) confirms
  whether the click actually reached the handler by checking server
  logs for the resulting RPC/action call.
- Table/column name traps: `classes.entry_fee_cents` is NOT the same
  column as `entry_classes.fee_cents` — a query for `classes.fee_cents`
  silently returns zero rows (Postgrest error swallowed by only
  destructuring `data`), which broke exhibitor entry submission until
  fixed in 4acc1bb. Always confirm exact column names per table when
  they're money/fee-adjacent, don't assume consistency across tables.
- When parallel agents work in isolated git worktrees on the same
  repo, they can independently touch the same file (e.g. a shared
  class detail page) — expect and manually resolve a merge conflict by
  combining both additions rather than picking one side. Worktree
  directories under `.claude/worktrees/` are now gitignored (added in
  d04d197) since leftover `.next` build output inside them was
  polluting `npm run lint` with thousands of false positives — use
  `npx eslint src` if you ever see a huge lint error count and suspect
  this.
- Project folder name "New Horse Show" isn't npm-safe; package is
  `showring-iq`.

## Full technical detail

Every sprint's per-file breakdown, architecture rationale, and design
decisions are also in Claude's persistent memory (`sprint-progress.md`,
`rule-packages-documents-exhibitor.md`, and newer memory files), which
loads automatically in any future conversation about this project.
