# ShowRing IQ — Session Handoff (updated 2026-07-11)

This is a plain-text snapshot of where this project stands. Claude's
persistent memory has the same content and loads automatically in a
fresh conversation — this file is just a visible copy you can open
yourself.

## Status: public live-results page is built, migration 00021 applied, and fully browser-verified live (all 3 states: not-started, running with live scores, results-posted). See "2026-07-11 (2nd session): public live results" section right below. Below that, "2026-07-11 update" and "Roadmap" sections are the prior session's history.

## 2026-07-11 (2nd session): public live results — code done, DB + verification pending

Per the Roadmap section's agreed next step, designed and built the
public live-results page (`/[org-slug]/[show-slug]`, matching CLAUDE.md's
Routes section exactly). Confirmed scope with the user first via 4
questions; all went with the recommended option:

- **Access mechanism**: 5 new `SECURITY DEFINER` RPCs in
  `supabase/migrations/00021_public_live_results.sql`
  (`public_show`, `public_show_classes`, `public_class_draw`,
  `public_class_scores`, `public_class_results`), granted to `anon`.
  Each returns an explicit hand-picked column list rather than opening
  raw anon RLS policies on `shows`/`classes`/`entries`/`scores`/`results`
  — a future column added to any of those tables can't silently become
  public. No existing table got new grants.
- **Scope**: only `shows.status = 'published'`; only
  `classes.status = 'results_posted'` classes show a results table;
  scores only appear once judge-signed (`scores.status in ('submitted',
  'verified')` and `signed_at is not null` — never a score still being
  drafted). Rider + horse name only, no owner/trainer, no fees, no
  contact info, no birthdates — matches CLAUDE.md's Public capability
  row exactly ("schedule, live class status, posted results,
  rider/horse search").
- **Route**: `src/app/(public)/[org]/[show]/page.tsx` +
  `src/app/(public)/layout.tsx` (unauthenticated, no sidebar). New
  `src/lib/public-results.ts` holds typed RPC wrappers and a
  `publicClassStage()` helper that collapses the 12 internal class
  statuses to 4 public-facing ones (not_started / running /
  results_posted / cancelled) — same simplification idea the roadmap
  proposed for the internal UI, applied here first since the public
  page needed it anyway. Page shows: class chips (schedule), "now in
  the arena" + "coming up" + live signed scores while a class is
  running, a results table once posted. Auto-refreshes every 15s like
  the gate/announcer screens.
- `npm run build` and `npx eslint src` both clean. Route shows up
  cleanly in the build's route list as `ƒ /[org]/[show]` with no
  conflicts against existing static routes (`/login`, `/dashboard`,
  etc. still win — only unmatched paths fall through to the dynamic
  org/show route, per normal Next.js routing precedence). Note: an
  organization can never use a slug that collides with a top-level app
  route (`login`, `dashboard`, `admin`, `exhibitor`, `help`, ...) — an
  inherent consequence of CLAUDE.md's own `/[org]/[show-slug]` route
  shape, not something new introduced here.

**Both blockers cleared and the page is fully verified live**, using
the EPRHA org's real "EPRHA Summer Slide 2026" show
(`/eprha/eprha-summer-slide-2026`) — the user stopped the conflicting
dev server, signed in, and published that show; Claude drove the rest
(closed a class's entries, generated a draw, moved a run to "in
arena," entered + signed a score, calculated + posted results for a
different class) to exercise all 3 public-facing states in one pass:

- **Not started** (class 1, still Draft): empty state renders, no
  draw/scores.
- **Running** (class 2): "now in the arena" shows back #1 / Jamie
  Tester / Chex My Spook; "coming up" correctly empty; live scores
  list shows the signed 72.5 score. Confirmed the *unsigned* score
  gate too — before signing, `public_class_scores` correctly returned
  nothing for that entry.
- **Results posted** (class 3): results table shows placing 1, back
  #1, score 70.0, money "—" (payout wasn't calculated, correctly shown
  as blank not $0.00).
- **Negative tests**, run directly against the RPCs with the bare anon
  key (no session) via a throwaway Node script: `public_class_results`
  on a non-posted class returns `[]`; `public_show` on a bogus show
  slug returns `[]`; the raw RPC responses for all 5 functions contain
  exactly the documented columns — no fee, contact, owner, trainer,
  birthdate, judge identity, or notes field anywhere in any response.
- Browser 404 confirmed for `/eprha/does-not-exist`. No console errors
  on the working page.

Nothing left to do on this feature. Migration 00021 is applied and
live; the route is done and verified end-to-end. **Not yet
committed** — still sitting as uncommitted changes in the working
tree as of end of session.

42 commits on `main`, working tree clean:

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

## 2026-07-11 update: full visual redesign + all 4 features live-verified + 4 more real bugs fixed

Two commits: `1798660` (design system overhaul + landing/auth redesign
+ two silent-query bug fixes) and `5fa63a2` (native-dialog replacement
+ two more bug fixes). Full detail in memory
(`design-overhaul-and-bugfixes.md`); summary:

**Design:** replaced the generic Tailwind emerald/zinc palette with a
custom hunter-green `brand` + brass `accent` theme, paired Fraunces
(headings) with the existing Geist (body/UI), rebuilt the landing page,
auth screens, and app shell sidebar — all through the shared
`src/components/ui.tsx` primitives so it cascades everywhere with
minimal per-page edits. Replaced every `window.confirm()`/
`window.prompt()` in the app (33 call sites, 20 files) with a single
shared, styled, promise-based modal (`src/components/confirm-dialog.tsx`)
— native dialogs don't theme and, it turns out, aren't reliably
scriptable by browser automation either.

**All 4 post-MVP features live-verified** (class_judges assignment,
class patterns + judge signoff including reopen-clears-signature,
multi-affiliation classes exactly matching CLAUDE.md's NRHA+EPRHA
example, and the audit-log-in-NRHA-export). One gap remains: judge-role
*permission enforcement* (a judge account only seeing their assigned
class) still needs a real second login to verify — Claude can't sign
in as another user itself.

**4 more real bugs found and fixed:**
1. `show_staff` and `organization_members` list pages always showed
   zero rows — both embedded `profiles` via a `user_id` column that
   only FKs to `auth.users`, not directly to `profiles`, so every
   query errored (silently, since only `{ data }` was destructured).
2. The org Audit Log page had the exact same bug (via an explicit-but-
   wrong FK-name hint), found while verifying feature #4 — a repo-wide
   grep for `profiles(`/`profiles!` embeds is worth running any time
   this bug class is suspected.
3. `log_audit()` has been ambiguous since migration 00017 added an 8th
   param via `create or replace function` without dropping the old
   7-arg overload — broke every org-level audit-logged action (rule
   package publish, member invites, org/person/horse CRUD) with
   "function log_audit(...) is not unique". **Fixed by migration
   `00020_fix_log_audit_overload.sql`, which the user has already
   applied via the Supabase SQL Editor.**
4. Editing ANY field on a class that's progressed past Draft/Open/
   Entry-closed/Cancelled (i.e. anything in scoring or later) silently
   failed on every save — the update form's Zod schema only accepted
   those 4 statuses, so the hidden current-status default always
   failed validation. Widened the schema to the full 12-status set and
   made the Status field read-only once a class is past the early,
   user-settable stages.

Build and lint both clean throughout (only the 2 pre-existing benign
RHF `watch()` warnings).

## Database

**Migration 00020 (`00020_fix_log_audit_overload.sql`) is applied** —
confirmed by the user via the Supabase SQL Editor on 2026-07-11. All 20
migrations are now live. Details below are from the prior session and
still accurate for 00001–00019:

All 19 migrations (`supabase/migrations/00001`–`00019`) are confirmed
applied to the live Supabase project (`dmyejohfauijbuizboos.supabase.co`)
— 00001–00015 confirmed in an earlier session, 00016–00019 confirmed
by the user this session (applied via the SQL Editor in run order;
one paste of 00016 initially got truncated mid-file by the editor/
copy step, causing an "unterminated dollar-quoted string" error — not
a bad migration — re-pasting the full file fixed it). **Nothing DB-side
is blocking anymore.**

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

## The actual next step: browser-verify all 4 new features

Migrations 00001–00019 are all confirmed applied live — nothing DB-side
is blocking anymore. None of the 4 newest features have been clicked
through in a browser yet:

1. Sign in to ShowRing IQ in the preview browser yourself (Claude
   cannot sign in — hard boundary, even for dev/test accounts it
   creates itself; ask Claude to drive everything else).
2. **class_judges**: on a class detail page, assign a judge (a
   `people` row with role `judge` needs to exist as `show_staff` with
   `staff_role = 'judge'` first — check whether the org has one, or
   create one). Confirm a judge-only account only sees/can score their
   assigned class, and gets a 404 on an unassigned one.
3. **class patterns + signoff**: add a pattern to a class, confirm it
   shows on the scoring screen, submit a score card and confirm the
   signature prompt/display works, confirm reopening clears the
   signature.
4. **multi-affiliation**: add a second affiliation to an existing
   class (different rule package/code), confirm eligibility evaluates
   per-affiliation on the Issues tab and exhibitor entry screen, and
   confirm the NRHA CSV export only pulls the NRHA-affiliation's code.
5. **audit log**: trigger a few show-scoped actions, generate an NRHA
   export ZIP, confirm `audit_log.txt` is present and populated with a
   `show_id` on every row (including score.submitted/score.signed/
   score.reopened — the thing fixed in the 00019 regression, worth
   specifically double-checking).

The exhibitor flow (invite → signup → accept → profile → horses →
enter show → scratch) IS fully verified live from an earlier session
in this same day — no need to re-test that unless something regressed.

## Environment / secrets

- Supabase: connected, `.env.local` filled in. All 19 migrations
  (00001–00019) confirmed applied live.
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

## Roadmap: competitive assessment + agreed next step (2026-07-11)

After the redesign/bugfix pass above, the user did their own deep read
of the blueprint, this file, all 20 migrations, and the source, and
delivered a full competitive assessment against Pegasus, Horse Spot,
and legacy tools (Horse Show for Windows, HSS, ShowPro). Full detail in
memory (`roadmap-competitive-assessment.md`) — summary:

**Verdict: the core bet is right, don't dumb it down.** The
validation/rule-package/audit engine is genuinely ahead of the market
— multi-affiliation classes, judge digital sign-off with
reopen-clears-signature, granular permissions + audit log, and correct
money-as-cents financial engineering are all things no competitor has.
Spreadsheet import for people/horses was specifically called out as
"quietly one of the best adoption features" (removes the Excel
migration friction that keeps secretaries on legacy tools).

**On usability**: restructure the language, don't remove power.
Concrete, not-yet-started asks: rename developer vocabulary in the UI
("rule packages" → "Association setup", "affiliations" → "This class
counts for...", "eligibility rules" → "Entry requirements") without
touching the underlying data model; collapse the 12 internal class
statuses down to ~4 displayed states (Open/Closed/Running/Done) driven
by a single contextual "next step" button — note this traces directly
to the class-status Zod bug fixed above, which was a symptom of the
status field being too exposed/load-bearing in the raw UI; add a
guided show-setup wizard (template → classes → fees → open entries);
test gate/scoring screens on actual phones in sunlight (not yet
audited for this).

**Gaps, in priority order**: (1) no online payments — no Stripe, no
pay-at-entry, no exhibitor settlement statement; Stripe Connect
(org-per-connected-account) is the natural fit for this app's org-first
architecture and matches CLAUDE.md's already-deferred "Payments:
Stripe" line. (2) no public/unauthenticated live results — gate page
already has the right auto-refreshing data shape, just not reachable
without login. (3) no scheduling/estimated start times across a full
day. (4) no offline resilience (PWA/IndexedDB was deferred in CLAUDE.md
and still is). (5) no exhibitor SMS/email notifications (Resend is
already in the stack). (6) no stabling/shavings/RV orders. (7)
`DEFAULT_REQUIRED_ASSOCIATIONS` in `validate-entries.ts` is still a
hard-coded `["NRHA"]` fallback rather than derived from the show's real
affiliations — worth fixing before a second association.

**Agreed sequence**: public live results (fast, self-contained, also a
marketing surface) → Stripe Connect payments + settlement (removes the
biggest competitive objection) → SMS/email → schedule with time
estimates → offline-tolerant scoring/gate PWA → second association
(likely AQHA) → stabling orders.

**Immediate next step, nothing coded yet**: build the public live
results page (route TBD, e.g. `/live/[showId]`) — current class, draw
order, at-gate status, live scores, posted results. Explicitly agreed
to design the RLS policy first (new anonymous read access — scope to
current class/draw/posted results only, never fees/contact
info/birthdates) and confirm scope with the user before writing any UI
code.

**Also still open**: judge-role permission *enforcement* (a judge
account only seeing their assigned class) hasn't been verified
end-to-end — needs the user to sign in as a real second, judge-role
account; Claude can't do that itself.

## Full technical detail

Every sprint's per-file breakdown, architecture rationale, and design
decisions are also in Claude's persistent memory (`sprint-progress.md`,
`rule-packages-documents-exhibitor.md`, and newer memory files), which
loads automatically in any future conversation about this project.
