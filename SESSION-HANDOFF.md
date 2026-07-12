# ShowRing IQ — Session Handoff (updated 2026-07-12)

This is a plain-text snapshot of where this project stands. Claude's
persistent memory has the same content and loads automatically in a
fresh conversation — this file is just a visible copy you can open
yourself.

## Status: five more NRHA-rulebook features shipped this session — tie run-off/co-champion resolution (00026), youth class fee/retainage exemptions (00027), scribe role + official pattern picker + printable scribe score sheet (00028), Single Purse tiered aged-show payouts (00029), and fee-cap validation warnings (00030). All five migrations applied and fully browser-verified live, all committed. That closes out every item on the NRHA rulebook punch list except two small ones (Payback Schedule A/B auto-fill, event-classification compliance checklist) plus two low-priority process items (results/scores timing reminders, payout distribution deadline tracking) — see `nrha-rulebook-punch-list.md` in memory for current status of each. Stripe/online payments and exhibitor email notifications remain explicitly deferred. See "2026-07-12 (7th session)" for the newest work; older sections below are prior-session history.

## 2026-07-12 (7th session): tie resolution, youth exemptions, scribe/pattern tooling, Single Purse payouts, fee-cap validation

Picked up from the punch list recorded at the end of the 6th session.
User's instruction was "tackle everything but stripe" — worked through
it one well-scoped feature at a time, each with its own migration,
lint/build check, live verification, and commit, rather than a shallow
pass across everything at once. Five features shipped.

**1. Tie run-off / co-champion resolution** — migration
`00026_tie_resolution.sql`. NRHA rule O: only a 1st-place tie may be
worked off; other ties stand. `calculate_payouts` already split tied
placings' money evenly (pre-existing logic from 00011) — the real gap
was recording *how* a tie was resolved. Added
`results.tie_resolution`/`tie_resolution_note`, a `resolve_tie` RPC,
and `TieResolutionCard` (declare co-champions / mark run-off completed,
both surfaced on the class results page whenever more than one entry
is tied for 1st). `calculate_results` redefined to clear a stale
tie_resolution when a recompute changes the standings (e.g. after a
run-off score correction via the pre-existing `correct_score` RPC).

**Real gotcha hit during verification — not a code bug, a Supabase
schema-cache trap worth remembering**: after the user applied 00026,
the app got `Could not find the function public.resolve_tie(...) in
the schema cache` on every attempt. `NOTIFY pgrst, 'reload schema'`
did NOT fix it after several retries. Turned out the function itself
never actually landed in the database — confirmed by having the user
run `select proname from pg_proc where proname = 'resolve_tie'`, which
came back empty, meaning it was lost somewhere in copy/paste of the
full migration file. Fix was re-running just the `create or replace
function public.resolve_tie(...)` block in isolation. **Lesson: when
"function not found in schema cache" persists after a reload attempt,
verify the function actually exists in `pg_proc` before burning more
retries on cache-refresh theories.**

**2. Youth class fee/retainage exemptions** — migration
`00027_youth_classes.sql`. Show Rules P(7): youth classes never pay
NRHA's 5% retainage or any office fee. Added `classes.is_youth`;
`calculate_payouts` forces retainage to 0% for youth classes;
`assign_back_number` skips the show's `standard_entry_charges`
auto-apply (00023) only when **all** of an entry's classes are
youth — confirmed with the user first: "if a youth shows in only
youth no office fee. that's correct. if they show in anything else
they get an office fee," exactly matching the `bool_and(is_youth)`
implementation.

**3. Scribe role + official pattern library + printable scribe score
sheet** — migration `00028_pattern_library_and_scribe.sql`, built from
four NRHA PDFs the user uploaded (2024 Handbook, patterns-1.pdf,
Score_Sheet.pdf, 2025 Membership Application). Three pieces:
- `'scribe'` added to `show_staff.staff_role` — a free-text per-show
  label like judge/gate/announcer, not a login permission (matches
  steward/vet/farrier/photographer, none of which have an
  `organization_roles` entry either). Per the Handbook's Judges'
  Guide: "management's responsibility to supply a scribe at every
  official NRHA event" — the scribe hand-writes the judge's called
  scores on the paper card during a run.
- All 20 official NRHA patterns (1–18, plus A/B for Youth 10 & Under
  Short Stirrup/Para-Reining) transcribed into `src/lib/nrha-patterns.ts`
  as structured data — deliberately NOT a database table, reasoned as
  fixed association reference material (like the score-sheet layout
  itself) rather than an org-configurable rule package item.
  `class_patterns.pattern_key` (new column) records which library
  pattern a class's freeform `pattern_text` was built from; a new
  "Insert an official NRHA pattern" picker on the class Pattern editor
  auto-fills the existing freeform textarea, which stays fully
  editable afterward (NRHA Green/Ride & Slide/Category 11-13 classes
  can use modified patterns).
- New route `/shows/[id]/scoring/[classId]/score-sheet`: a print-ready
  page replicating the official NRHA Judges Score Sheet (header fields
  pre-filled from data, the maneuver-scoring legend, a numbered
  maneuver key for the linked pattern — an addition beyond the stock
  blank sheet, since the user explicitly wanted per-pattern maneuver
  auto-fill — then a blank Draw/Exh#/8-maneuver/Total/Score grid,
  paginated 10 entries per page). New `@media print` rules in
  `globals.css` hide the app chrome so it prints clean.

**4. Single Purse tiered payout structure for aged shows** — migration
`00029_single_purse_payouts.sql`, Show Rules I(7). One class, one
purse, one entry fee, riders of eligibility levels 1–4 compete
together, but a rider's own level caps which payout tier they can
actually cash a check in. Three scope decisions confirmed with the
user via AskUserQuestion before writing code (the rule text itself is
intentionally open on some edge cases — "show management may contact
NRHA for formulas to calculate payouts for different sizes of
events"):
1. No career-earnings tracking exists in the app, so rider level is
   office-declared per entry (`entry_classes.rider_level`, set via a
   new `set_rider_level` RPC, editable on the Results page — same
   "office declares it" pattern as eligibility overrides elsewhere).
2. When a paid placing has no eligible rider, money redistributes
   **proportionally** to the placings that DO qualify (scaled by their
   relative payout-schedule percentages) so the full pool always pays
   out.
3. Level-champion award naming (Section 3(c)) is genuinely ambiguous
   in the Handbook text — user asked for a best-effort interpretation
   anyway, clearly flagged as such in the migration and in the app.

Implements Section 1 (pay-spot count: entries/2, rounded up if odd,
capped at 60), Section 2 (tier allocation with the Level-4->25%-of-
entries and Level-1-<25%-of-entries exceptions, remainder distributed
starting from Tier 4 downward among whichever tiers aren't fixed by an
exception), the eligibility-gated proportional payout itself (a rider
of level L can cash in placing-zone rank Z iff L <= 5-Z), and Section
3(c) champion assignment.

**A real bug caught before shipping, not after**: built an 8-entry
hand-calculated test scenario (levels [2,4,1,1,1,4,2,3], scores 90.0
down to 83.0, 40/30/20/10% schedule, $80 pool) and worked out the
expected pay-spots (4), tiers (1-1-1-1), eligibility exclusions, and
champions *by hand* before running the RPC. Doing that surfaced a
real gap: Section 3(A) says "Level championships are only awarded to
placings within the payout of the class" — the first draft's champion
search queries had no `placing <= pay_spots` constraint, so an
out-of-the-money rider (placing 5, a Level 1 rider with no check)
would have been wrongly crowned Level 1 Champion. Fixed by adding the
constraint to all four champion search queries and re-applying the
corrected function (`create or replace`, no new migration file
needed) before ever running it against the live database. Once fixed,
every one of the 8 hand-calculated expected values (money down to the
penny, all four champion assignments including the *absence* of a
Level 1 champion) matched the app's actual output exactly. All 8 test
entries and the scratch class deleted afterward.

**5. Fee-cap validation warnings** — migration
`00030_fee_cap_validation.sql`, Show Rules H/I/J/K/L (Ancillary/Aged/
Jackpot Affiliate/Entry Level Ride & Slide/Green Level fee-cap
tables — e.g. "Limited Open: max $500 added money, max entry fee 10%
of added money or $50 jackpot"). Per CLAUDE.md's "rules are data, not
code" principle, the actual dollar caps are NOT hardcoded — four new
optional columns on `association_class_codes`
(`max_added_money_cents`, `max_entry_fee_cents`,
`max_entry_fee_percent_of_added_money`, `max_entry_fee_jackpot_cents`)
that an org fills in per class code, covering both cap shapes seen in
the Handbook (flat dollar, or percent-of-added-money with a separate
jackpot-specific cap). `computeFeeCapIssues()`
(`src/lib/fee-cap.ts`) is a pure function producing a soft (warning,
not blocking) `ValidationIssue[]`, reusing the existing `IssueList`
component from the entry-validation Issues page for visual
consistency; it's rendered on the class detail page, above both the
read-only summary and (more importantly) the edit form, so it's
visible while actively editing a class's fees. `AddClassCodeForm`
gained the four optional cap input fields (there's still no *edit*
action for existing class codes — a pre-existing gap this feature
didn't introduce or fix).

**Verification methodology this session**: every feature was verified
against real or deliberately-scoped scratch data on the live EPRHA
Summer Slide 2026 show, with all test data (scratch classes, test
entries, test people/horses, test class codes, test staff rows)
created, exercised, and then fully deleted/reverted afterward — real
show configuration (Stall/Office/Drug charges, schedule settings,
etc.) was never touched. Reused the same rider ("Jamie Tester") and
horse ("Chex My Spook") across multiple synthetic entries in test
classes where possible, since entries aren't unique per rider+horse
pair — this avoided creating throwaway people/horse records for the
Single Purse 8-entry test. Two dev-server restarts happened mid-
session (browser preview died and had to be reopened + the user had
to re-sign in each time — Claude cannot sign in itself, a standing
hard boundary).

Build (`npm run build`) and lint (`npx eslint src`) both clean after
every feature (only the 2 pre-existing benign RHF `watch()` warnings).
Five commits: `a11cef5` (tie resolution + youth exemptions + scribe/
pattern/score-sheet, bundled since git doesn't support clean partial-
file staging without `-i` which is disallowed), `9d80763` (Single
Purse payouts), `2ac459f` (fee-cap validation).

Memory updated: new files `tie-resolution-and-youth-classes.md`,
`scribe-pattern-library-score-sheet.md`, `single-purse-payouts.md`,
`fee-cap-validation.md`; `nrha-rulebook-punch-list.md` updated to mark
items A.1/A.2/A.3/A.4 done, leaving only A.5 (event-classification
checklist), A.6 (results/scores timing reminders), A.7 (payout
distribution deadline tracking), and the B-section rule-package data-
entry items (which don't need app code).

## 2026-07-11 (6th session): concurrent classes (NRHA Show Rules)

The user uploaded the NRHA Show Rules & Regulations PDF (Membership
through Payback Schedules, ~40 pages) and asked to build support for
classes that run concurrently — how EPRHA actually runs shows — and
separately, for a punch list of everything else in the rulebook worth
building later.

**What "concurrent" means per NRHA rules** (cited, not assumed):
several class pairings — Rookie Professional + Category 1 Open,
Rookie Level 1 + Level 2 + Prime Time Rookie, Prime Time Open +
Category 2 levels — run as one physical go. Rule F(10): "When classes
run concurrently... a horse may be shown only once." Ancillary/Jackpot
rules add: only the highest judge's fee is charged, not one per class.
Confirmed scope with the user first (3 questions, all recommended):
grouping via a simple field on the class edit page (not a separate
manager screen), and draw + gate status + score entry/corrections all
auto-propagate (not just score entry).

**What was built** — migration `00025_concurrent_classes.sql`:
- `classes.concurrent_group_id` (shared uuid across grouped classes)
  and `class_draws.shared_run_id` (ties together the class_draws rows
  across different classes that represent the *same physical run*).
- New `mirror_score_to_concurrent_siblings(entry_class_id)` helper,
  called from the tail of `enter_score`, `submit_score`, `verify_score`,
  `reopen_score`, and `correct_score` — whatever one class's score
  becomes, every sibling class's score for the same run becomes too
  (judge assignment, signature, timestamps, everything).
- `set_run_status` (gate actions) now propagates status and scratches
  across every class_draws row sharing a `shared_run_id`, and the
  "marking in-arena auto-completes the previous in-arena run" check
  now looks across the whole concurrent group, not just one class.
- `src/app/(app)/shows/[id]/draws/actions.ts` — `generateDraw`
  rewritten to draw once across every class in a group (one entry
  entered in two grouped classes gets one shared run, appearing in
  both classes' draws at the same position); `appendToDraw` (late
  entries) joins an existing sibling run if one already exists for
  that entry, rather than creating a duplicate.
- New "Runs concurrent with" checkbox section on the class edit page
  (`src/components/show/class-concurrency-manager.tsx`, action
  `updateClassConcurrency` in `classes/actions.ts`) — correctly merges
  pre-existing groups when classes from two different groups get
  linked together, so nobody's silently orphaned.
- **Deliberately generic, not hard-coded to any NRHA pairing** — a
  secretary links whichever classes they want; the specific NRHA rules
  about which categories *may* run concurrent stay a judgment call for
  the secretary/rule package, per CLAUDE.md's "rules are data, not
  code." `calculate_results` needed zero changes — it already computes
  independently per class from that class's own entry_classes/scores,
  which now just happen to be correctly kept in sync.
- **Known limitation, not solved**: `moveDrawRow` (manual reordering)
  isn't group-aware — reordering a run within one class's draw list
  doesn't reposition it in a sibling class's list. Display-order only;
  doesn't affect correctness of gate/scoring propagation, which is
  driven by `shared_run_id`, not position number.

**Verified live**, against the real EPRHA Summer Slide 2026 show:
grouped Class 1 (Green Reiner Level 1) and Class 2 (Green Reiner Level
2) — a realistic concurrent pairing, left grouped afterward rather
than un-done. Reinstated a scratched entry so it was actively entered
in both classes. One "Generate draw" click on Class 1 produced a
matching one-entry draw in Class 2 automatically. Marking the run
"in arena" from Class 1's gate screen instantly showed in arena on
Class 2's gate screen with no action taken there. Entering a draft
score (68.0) on Class 1 instantly appeared on Class 2's scoring
screen; submitting/signing it on Class 1 mirrored the exact signature
and timestamp to Class 2; verifying on Class 1 mirrored verified
status to Class 2 too. Marked both classes official and calculated
results independently — each correctly showed placing 1 / score 68.0
computed from its own (now-synced) data, confirming `calculate_results`
needed no changes. Hit one real UI-interaction snag during
verification (not a bug): "Mark official" opens a confirm dialog
before calling its RPC — an accessibility-tree-ref click opened the
dialog but didn't submit it, so nothing changed until the dialog's own
confirm button was clicked; a `document.querySelector` + `.click()`
plus screenshotting the resulting dialog resolved it. Build and lint
clean throughout (only the 2 pre-existing benign RHF `watch()`
warnings).

**Rulebook punch list, not started** — the rest of the NRHA Show
Rules document (tie run-off/co-champion workflow, single-purse
tiered aged-show payouts, youth class results/retainage exemption,
event-classification staffing requirements, fee-cap validation, the
two Payback Schedule tables) is written up in memory
(`nrha-rulebook-punch-list.md`) as agreed with the user, split into
genuine app-code gaps vs. items that just need rule-package data entry
the user can do themselves. Nothing from it has been built — next
session should ask the user which item(s) to prioritize before
starting any of it.

## 2026-07-11 (5th session): schedule with estimated start times

Next roadmap item after standard entry charges — the user picked this
over exhibitor email notifications (which needs a Resend account/API
key first) and revisiting Stripe.

- `supabase/migrations/00024_schedule.sql` — three new show-level
  settings (`schedule_start_time` time, `schedule_break_minutes`,
  `schedule_drag_minutes`) and one new class-level field
  (`avg_run_minutes numeric(5,1)`, default 3.0).
- `src/lib/schedule.ts` — the actual estimate: for each scheduled day
  independently, walk classes in `display_order`, cumulative minutes
  starting from the show's daily start time. Each class's duration =
  entered-entry-count × its `avg_run_minutes`, plus
  `floor(entryCount / drag_every_n) × schedule_drag_minutes` if the
  class has a drag interval set, plus a break before the next class.
  Classes with no `scheduled_date` are listed separately as "Not yet
  scheduled" rather than guessed at. **Deliberately does NOT track
  actual per-run elapsed time** (no `started_at`/`completed_at` exist
  on `class_draws` rows) — this is a static formula recomputed fresh
  from current entries/scratches/settings on every page load, not a
  live pace-tracker. Matches the roadmap's own framing: "a simple
  day-sheet... without full arena/scheduling infrastructure."
- New `/shows/[id]/schedule` tab (matches CLAUDE.md's named route,
  positioned right after Classes in both the route and the nav tabs
  to match CLAUDE.md's own ordering), auto-refreshes every 30s.
  "Schedule settings" section added to `/shows/[id]/settings`, and an
  "Avg run time (minutes)" field added next to "Drag every N runs" on
  the class create/edit form.
- Deliberately simplified: **one daily start time for the whole show**,
  not per-day — CLAUDE.md notes real per-day/arena scheduling
  infrastructure (`show_days`, ring assignment) was never built, and
  building that now would be much bigger than what was asked. Also
  did not extend the *public* live-results page to show estimated
  times — this pass is the internal `/shows/[id]/schedule` tab only;
  extending to the public page is a natural, small follow-up if wanted.
- Hit the exact same `z.coerce.number()` + React Hook Form type-error
  gotcha already documented below (schedule-settings-form.tsx) — fixed
  the same way, `useForm<FormValues, unknown, Input>` with a
  `z.input<>`-derived form-values type. Also fixed the same
  destructure-only-`data`-ignore-`error` bug pattern in
  `createClass`/`updateClass` (`src/app/(app)/shows/[id]/classes/actions.ts`)
  while touching those functions to add `avg_run_minutes` — third time
  this exact bug class has been caught in this app now.
- Full verification, live against the real EPRHA Summer Slide 2026
  show: confirmed the "No classes yet" empty state was actually the
  known missing-migration symptom (not a real bug) before 00024 was
  applied; after applying, put classes 1 and 2 on the same scheduled
  day with entries/avg-run-time set — class 2 correctly started
  exactly `class 1's duration (0, since it had 0 entries) + the
  10-minute break` = 8:10 AM after class 1's 8:00 AM slot; changing
  the show's daily start time to 9:00 AM shifted every class on every
  day correctly; class 2 with no scheduled date correctly appeared
  under "Not yet scheduled" until a day was set. Reverted all test
  values (scheduled date, avg run time, daily start time) back to
  defaults afterward — the real Stall/Office/Drug standard-charges
  config from the 4th session was left in place since that's real
  setup, not test data. Build and lint both clean throughout (only the
  2 pre-existing benign RHF `watch()` warnings).

## 2026-07-11 (4th session): standard per-entry charges (stall/office/drug fee, auto-applied)

Built on top of the billing feature from the 3rd session. The user
wanted EPRHA's per-back-number stall/office/drug fee to stop being
manual — configure the amount once at show setup, then every back
number gets it automatically.

- `supabase/migrations/00023_standard_entry_charges.sql` — new
  `shows.standard_entry_charges` jsonb column (array of
  `{label, amount_cents}`), and `assign_back_number` (existing RPC,
  same signature, `create or replace`) now loops over the show's
  configured charges and inserts a `misc_charges` row for each one
  the *first* time a back number is assigned to an entry — not on
  renumbering/reassignment (verified: renumbering entry 2 from #2 to
  #99 did not add a second set of charges). Billed party is the same
  owner-or-rider rule the billing feature already uses. **Deliberately
  generic, not hard-coded to EPRHA or any association** — the field
  is a free-form label+amount list per show; an empty list (the
  default) means no behavior change for any other show. This directly
  reuses `misc_charges`/the billing feature from the 3rd session, so
  an auto-applied charge shows up and can be removed exactly like a
  manually-added one.
- UI: new "Standard per-entry charges" section on `/shows/[id]/settings`
  (`src/components/show/standard-charges-editor.tsx`), a dynamic
  label+$ row editor mirroring the existing `PayoutScheduleEditor`
  pattern, with a "Load stall / office / drug fee starter set"
  one-click button (fully renameable/removable after loading, not a
  fixed enum).
- Left the existing `shows.medication_fee_cents` field (used only for
  the NRHA export tally-sheet estimate) untouched — deliberately did
  not consolidate it with this new feature, since that's a
  "must be perfect" export code path per CLAUDE.md and the user didn't
  ask for that change. Worth reconciling later if it becomes
  confusing to have two "medication fee" concepts.
- **A real bug caught during verification**: first attempt to save
  standard charges failed with a misleading "Show not found" error —
  actually caused by migration 00023 not being applied yet (the
  `standard_entry_charges` column didn't exist, so the `before` select
  errored and only `data` was destructured, masking the real Postgrest
  error — the same known bug class as the earlier `profiles`-embed FK
  bugs). Fixed the error handling in `updateStandardCharges`
  (`src/app/(app)/shows/actions.ts`) to surface the real Supabase error
  instead of assuming "not found" — worth doing this defensively in
  new actions generally, not just after hitting it.
- Full verification, live against the real EPRHA Summer Slide 2026
  show: configured Stall $50 / Office fee $25 / Drug fee $35, saved
  and confirmed it persisted across a page reload; created a second
  entry for Jamie Tester (new horse pairing, class 2 only, back number
  auto-assigned as #2) — her bill correctly showed both back numbers
  (#1, #2), $30 entry fees (2× class 2, one from each entry), and
  exactly one new set of the three standard charges ($110), NOT
  applied retroactively to the pre-existing back number #1 — total
  $140. Confirmed all 5 actions (`entry.created`, `back_number.assigned`,
  3× `misc_charge.added` tagged `"source":"standard_entry_charge"`)
  landed in the audit log correctly. Confirmed renumbering an existing
  back number (Set # → 99) does not add a second set of charges.
  Cleaned up all test entries/charges afterward, leaving the real
  Stall/Office/Drug configuration in place on the show (that part is
  real setup, not test data). Build and lint both clean throughout
  (only the 2 pre-existing benign RHF `watch()` warnings).

## 2026-07-11 (3rd session): guest-access share link/QR + per-show billing

Two features, both built after confirming scope with the user first
(same pattern as the live-results page), both applied and
browser-verified live against the real EPRHA Summer Slide 2026 show.

**1. Guest-access share link + QR.** The live-results page from the
2nd session had no discoverable entry point — you'd have to already
know the `/[org]/[show]` URL. Added a "Public page" card to
`/shows/[id]/settings` (`src/components/show/public-link-card.tsx`,
`src/lib/site-url.ts`) showing the full public URL as copyable text
plus a QR code (new `qrcode` npm dependency, generated server-side as
inline SVG — no external QR API call). Verified live: correct URL,
correct QR, nav tab present. The copy-to-clipboard button itself
couldn't be verified in this sandboxed browser (clipboard-write is
denied there, confirmed via a direct `navigator.clipboard.writeText()`
call returning `NotAllowedError`) — the button fails silently by
design in that case (link text stays visible/selectable), and this is
a sandbox limitation, not an app bug; a real browser tab has no such
restriction. A platform-wide "find a show" directory was explicitly
scoped OUT of this pass per the user's choice — flagged as a future
follow-up, not started.

**2. Per-show billing.** New `/shows/[id]/financials` tab: search
every entered rider/owner by name or back number, pull up an itemized
bill (`src/lib/billing.ts`, `src/app/(app)/shows/[id]/financials/`).
Auto entry-fee line items are read live from `entry_classes.fee_cents`
(not duplicated anywhere), plus manual misc charges (ice, sponsorship,
apparel, etc. — free-text category with quick-pick buttons) that
office staff can add and remove, gated by the `invoice.edit`
permission that already existed but had never been used. Every
removal requires a typed reason, audit-logged like every other
money-affecting action in this app. New migration 00022
(`misc_charges` table + `add_misc_charge`/`remove_misc_charge` RPCs) —
reuses the existing `invoice.view`/`invoice.edit` permissions, no new
role grants needed.

Key product decisions, confirmed with the user before building:
billing party per entry is **the owner if one is set, otherwise the
rider** (not always the rider — an owner who isn't riding gets the
bill); scope is **charges only, no payment recording** (Stripe/online
payments stay deferred; there's no way yet to mark a bill "paid" —
that's future work alongside real payment processing).

**A real bug caught during verification, not before:** the first pass
summed *every* `entry_classes.fee_cents` for a person's entries,
including scratched classes — $30.00 instead of the correct $20.00 for
the test entry (1 scratched class + 2 active, $10 each). The existing
Entries list page (`src/app/(app)/shows/[id]/entries/page.tsx`)
already excludes scratched fees from its total; the financials
feature now matches that convention exactly — scratched line items
still display (struck through, with a "Scratched" badge) so staff has
full visibility, but don't count toward the subtotal. Worth
remembering: any *new* money-total computation in this app should
cross-check against how the Entries page already handles scratches
before assuming a naive sum is correct.

Full verification pass, live against the real EPRHA Summer Slide 2026
show: public link/QR card renders with the correct URL; financials
roster shows Jamie Tester (back #1) at the correct $20.00 (matching
the Entries page); search resolves by both name and back number
correctly, and shows "No match" for a bogus number; the person detail
page shows the scratched Class 1 fee struck through and excluded from
the subtotal; added a $5.00 "Ice" misc charge (quick-pick category
button confirmed setting the field), total correctly became $25.00 on
both the detail page and the roster; removed it with a required reason
via the same `useConfirmDialog` reason-field pattern used elsewhere
(override placing, reopen score), total correctly reverted to $20.00;
confirmed both `misc_charge.added` and `misc_charge.removed` appear in
the org audit log with the reason attached. Build and lint both clean
throughout (only the 2 pre-existing benign RHF `watch()` warnings).

Committed in two commits: `c10d23b` (public live-results, prior
session) and `8633ede` (this session's share-link/QR + billing).

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

**Migrations 00026 through 00030 are applied** — 00026
(`00026_tie_resolution.sql`, tie run-off/co-champion resolution),
00027 (`00027_youth_classes.sql`, youth class fee/retainage
exemptions), 00028 (`00028_pattern_library_and_scribe.sql`, scribe
staff role + pattern-key column), 00029
(`00029_single_purse_payouts.sql`, Single Purse tiered payout
structure), and 00030 (`00030_fee_cap_validation.sql`, fee-cap warning
columns), all confirmed live and browser-verified (2026-07-12, 7th
session).

**Migrations 00021 through 00025 are applied** — 00021
(`00021_public_live_results.sql`, public live-results RPCs), 00022
(`00022_show_billing.sql`, misc_charges table + billing RPCs), 00023
(`00023_standard_entry_charges.sql`, standard per-entry charges
auto-applied via `assign_back_number`), 00024
(`00024_schedule.sql`, schedule settings + avg_run_minutes), and 00025
(`00025_concurrent_classes.sql`, concurrent class grouping + draw/gate/
score propagation), all confirmed live and browser-verified
(2026-07-11, 3rd–6th sessions).
All 30 migrations are now live. Details below are from earlier
sessions and still
accurate for 00001–00020:

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

**Gaps, in priority order (status as of 2026-07-11, 3rd session)**:
(1) no online payments — **partially addressed**: there's now an
itemized per-person bill (entry fees + misc charges) at
`/shows/[id]/financials`, but it's charges-only, no payment recording
and no Stripe — the user explicitly chose to skip Stripe Connect for
now, so real pay-at-entry and marking a bill "paid" are still
unbuilt. (2) no public/unauthenticated live results — **done**, see
the 2nd and 3rd session sections above (live-results page + share
link/QR for discoverability). (3) no scheduling/estimated start times
across a full day — still open. (4) no offline resilience — still
deferred per CLAUDE.md. (5) no exhibitor SMS/email notifications —
still open (Resend is already in the stack). (6) no stabling/shavings/
RV orders — the misc-charges feature could carry ad hoc versions of
these today (add a "Stabling" charge manually) but there's no
dedicated order/inventory flow. (7) `DEFAULT_REQUIRED_ASSOCIATIONS`
hard-coding — still open, unchanged.

**Sequence, updated 2026-07-11 (3rd session)**: public live results
→ guest-access discoverability + per-show billing (this session,
Stripe explicitly skipped) → next up is user's call: SMS/email,
schedule with time estimates, offline-tolerant scoring/gate PWA,
second association, stabling orders, or coming back to Stripe Connect
payments once ready.

**No longer "immediate next step"** — the public live-results page and
guest-access discoverability are both done and verified (see the 2nd
and 3rd session sections above).

**Also still open**: judge-role permission *enforcement* (a judge
account only seeing their assigned class) hasn't been verified
end-to-end — needs the user to sign in as a real second, judge-role
account; Claude can't do that itself.

## Full technical detail

Every sprint's per-file breakdown, architecture rationale, and design
decisions are also in Claude's persistent memory (`sprint-progress.md`,
`rule-packages-documents-exhibitor.md`, and newer memory files), which
loads automatically in any future conversation about this project.
