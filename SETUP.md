# ShowRing IQ — Setup (Sprint 1)

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New project (any name, e.g. `showring-iq`).
2. Wait for the project to provision.

## 2. Run the database migrations

Open your project's **SQL Editor** in the Supabase dashboard and run each file
in `supabase/migrations/` **in order**:

1. [`00001_foundation.sql`](supabase/migrations/00001_foundation.sql)
2. [`00002_shows.sql`](supabase/migrations/00002_shows.sql) — shows with a
   draft → published → locked → archived lifecycle, show staff assignment,
   RLS, and audited `create_show` / `set_show_status` RPCs
3. [`00003_classes.sql`](supabase/migrations/00003_classes.sql) — classes
   with fees in integer cents, schedule order, full class-status enum, RLS
4. [`00004_people_horses.sql`](supabase/migrations/00004_people_horses.sql) —
   people (multi-role), association memberships, horses, registrations /
   competition licenses, ownership records, RLS
5. [`00005_entries.sql`](supabase/migrations/00005_entries.sql) — entries
   (per-show entry numbers, name snapshots), entry_classes (fee snapshots,
   scratch status), back_numbers (unique per show, RPC-only writes), audited
   scratch/reinstate/back-number RPCs
6. [`00006_checkin_validation.sql`](supabase/migrations/00006_checkin_validation.sql) —
   check-in state on entries with audited check-in/undo RPCs (overrides
   require a reason)
7. [`00007_draws.sql`](supabase/migrations/00007_draws.sql) — class_draws
   (order of go + gate run status), drag frequency on classes, audited
   move_draw_row / set_run_status RPCs
8. [`00008_scoring.sql`](supabase/migrations/00008_scoring.sql) — scores
   (tenths-of-a-point, never floats) with a pending → submitted → verified
   lifecycle; audited enter/submit/verify/reopen/correct RPCs; class scoring
   completion / official RPCs
9. [`00009_results.sql`](supabase/migrations/00009_results.sql) — results
   (placings, tie status, manual-override flag); audited calculate/publish/
   unpublish/override-placing RPCs
10. [`00010_nrha_export.sql`](supabase/migrations/00010_nrha_export.sql) —
    `nrha_show_number` on shows, `nrha_class_code` on classes (plain
    columns — not a rule-package engine yet)

`00001_foundation.sql` creates:

- `profiles` (auto-created for every new signup via trigger)
- `organizations`, `organization_members`, `organization_invites`
- `organization_permissions` (seeded catalog of ~70 granular permissions)
- `organization_roles` + `organization_role_permissions` (role presets seeded per org)
- `audit_logs`
- RLS policies on every table, plus security-definer RPCs
  (`create_organization`, `invite_member`, `accept_invite`, `set_member_role`,
  `remove_member`, `log_audit`, …)

(Alternatively, with the Supabase CLI: `supabase link --project-ref <ref>` then `supabase db push`.)

## 3. Configure environment variables

Copy your project's URL and anon key from **Project Settings → API** into
`.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY
```

## 4. (Optional, recommended for local dev) Disable email confirmation

Supabase requires email confirmation by default. For faster local testing:
**Authentication → Sign In / Up → Email → turn off "Confirm email"**.

If you leave it on, the confirmation links will work — the app handles them at
`/auth/confirm`. Set **Authentication → URL Configuration → Site URL** to
`http://localhost:3000` so links point at your dev server.

## 5. Run the app

```
npm run dev
```

Then:

1. Sign up at `/signup` (this creates your `profiles` row automatically).
2. Create an organization — you become **Organization Owner** and the nine
   default staff roles are seeded.
3. Invite a member by email + role. Invites don't send email yet (Resend comes
   later); the invitee sees the pending invite on their dashboard when they
   sign in with that email address.
4. Check the **Audit log** tab — org creation, invites, role changes, and
   removals are all recorded.

## What's in Sprint 1

- Email/password auth (Supabase Auth, SSR cookies, Next 16 `proxy.ts` session refresh)
- Organizations (create, edit profile, tenant-scoped by RLS)
- Members: invite → accept flow, role assignment, removal (last-owner protected)
- Granular permission catalog + role presets (Owner, Show Manager, Show
  Secretary, Assistant Secretary, Judge, Gate, Announcer, Treasurer, Score Verifier)
- Audit log (viewable with `audit.view` permission)

## What's in Sprint 2

- Shows: create (org → Shows tab), dashboard, settings
- Status lifecycle: draft ↔ published → locked (unlock requires a reason,
  audited) → archived; drafts can be deleted with `show.delete`
- Staff assignment: link organization members or add outside people (judges,
  vets, farriers) by name, with per-show roles
- Locked/archived shows are read-only, enforced by RLS — not just the UI

## What's in Sprint 3

- Classes tab on each show: add/edit/delete classes with local class number,
  name, discipline, division, pattern number
- Fees as integer cents (entry fee, added money) — never floats
- Schedule order with move up/down, auto-appended on create
- Class statuses (draft / open / entry closed / cancelled now; the rest of the
  lifecycle — draws, scoring, official, exported — activates in later sprints)
- Writes blocked by RLS when the show is locked or archived

## What's in Sprint 4

- People tab: riders, owners, trainers, agents, guardians, judges — one
  profile, multiple roles, saved at the organization level and reused across
  shows
- Association memberships per person (NRHA/AQHA/APHA/… number, type, status,
  expiration) — the numbers exports will need
- Horses tab: registered/barn name, breed, sex, color, foal year, sire/dam
- Horse registrations & competition licenses per association
- Ownership records linking horses to people (with percentages) — feeds Non
  Pro/amateur eligibility checks later
- Reads require `org.view` (judges/gate/announcer can't browse people's
  contact info or birthdates); writes require the person/horse/membership/
  ownership permissions

## What's in Sprint 5

- Entries tab on each show: rider + horse + owner/trainer + class selection
  with a live fee total (fees snapshotted per class at entry time)
- Sequential entry numbers per show; rider/horse names snapshotted so
  gate/announcer views and printed programs stay stable
- Back numbers: auto-assign next, set a specific number, transfer, release —
  unique per show, all moves audited
- Scratch/reinstate per class or for the whole entry (with reasons, audited);
  scratched classes are kept for results — NRHA CSVs must include them
- People/horses/classes with entries can't be deleted (friendly errors point
  to scratching/cancelling instead)

## What's in Sprint 6

- Validation engine: rules as data (code/severity/predicate) with the
  info/warning/blocking/critical severity ladder; NRHA is the default
  required association until rule packages arrive
- Checks: missing/expired rider memberships, missing/expired horse
  registrations, no back number (blocking), no entered classes, no owner,
  missing birthdate, no ownership records
- Issues tab: severity counts and a per-entry breakdown across the show
- Check-in tab: one-tap check-in/undo; blocking issues require an override
  reason, recorded in the audit log
- Validation surfaces on the entry detail page and the show dashboard
  (issue count and checked-in count cards)

## What's in Sprint 7

- Draws tab: per-class draw generation with a seeded shuffle (reproducible —
  the seed lands in the audit log) and best-effort back-to-back rider
  spacing; re-draws confirmed and audited; manual reorder; late entries
  append to the end
- Gate tab: class picker, Now / On deck / 2 away / 3 away cards, one-tap run
  actions (at gate, in arena, done, hold, no show, scratch with reason),
  drag markers from the class's drag frequency, not-checked-in badges,
  auto-refresh every 10s
- Announcer tab: read-only current horse/rider/owner/trainer plus the next
  three, auto-refreshing
- Gate scratches also scratch the class entry (permission-checked);
  in-arena auto-completes the previous run

## What's in Sprint 8

- Scores stored as integer tenths of a point (never floats), same
  convention as money-as-cents; result status (shown/zero/no score/DQ/
  excused) with DB-level consistency checks
- Lifecycle: judge enters (pending) → submits/signs → secretary verifies.
  After verification, changes require a correction (judge_sheet_correction
  or data_entry_correction) with a mandatory reason, gated by
  score.correct_official vs score.edit_unofficial depending on stage
- Reopen a submitted/verified score with a reason if it needs another look
  before going further
- Scoring tab: per-show class list with entered/scored/verified counts;
  per-class page scores in draw order (falls back to entry order pre-draw),
  with "mark scoring complete" (blocks until every entry is verified) and
  "mark official" actions
- Simplification (documented in the migration): no per-class judge
  assignment table yet, so any score.enter holder can pick which judge
  they're entering for; per-judge score visibility isn't restricted yet

## What's in Sprint 9

- Results tab: once a class is marked official (Scoring tab), calculate
  placings from verified scores — higher `total_score_tenths` wins,
  standard competition ranking (ties stand: 1, 2, 2, 4)
- Entries with no_score/DQ/excused/unscored get no placing; scratched
  entries are excluded (they're handled directly by entry status at
  export time, not through the results table)
- Manual placing override (`placing_correction`, reason required) that
  survives recalculation (`manual_override` flag)
- Post / unpost results — moves the class between `official` and
  `results_posted`, reusing the class-status lifecycle from Sprint 3
- **Scope note:** CLAUDE.md's MVP section explicitly defers "public live
  results," so this sprint skips the public results page and standalone
  PDF generation — the blueprint's fuller Sprint 9 description lists both,
  but the project's own Defer list overrides it. PDFs are built properly in
  Sprint 10 as part of the NRHA submission package, which needs them anyway.

## What's in Sprint 10

- Show setting: NRHA show/approval number. Class setting: NRHA class code
  (both plain fields for now — a full multi-affiliation rule-package
  engine, where one class carries several association codes at once, is
  future work per CLAUDE.md's architecture principles)
- Exports tab: NRHA ReinerSuite CSV generator matching the exact field
  order/delimiter/quoting spec (`ShowNum; ShowName; ClassName; ClassCode;
  PatternNum; EntryCount; ShownCount; GoType; GoNum; Horse; HorseNrha;
  Member; MemberNrha; BackNum; PlaceNum; TotalScore; MoneyWon`), semicolon
  delimiter, every field quoted, CRLF line endings
- Score codes: scratched entries → -2.0, no_score/excused → -1.0, zero →
  0.0, shown → the real score — scratches are always included in the CSV
  per spec, not dropped
- Pre-export readiness checklist ("NRHA Submission: Ready" / "N issues"),
  reusing the Sprint 6 validation-issue UI: blocking on missing show
  number, missing class code/pattern, missing back numbers, or missing
  scores; warning on missing NRHA membership/registration numbers. Export
  is refused (422) server-side if any blocking issue remains — the
  checklist can't be bypassed by hitting the download URL directly
- Every generated export is audited (`export.nrha_csv_generated`)

## PDF results + fee summary (post-Sprint-10 follow-up)

- Exports tab now also generates a full-show PDF (`@react-pdf/renderer`):
  every official+ class with its placings, back numbers, riders, horses,
  and scores, one continuous document
- An informational entry-fees-collected + 5% retainage tally. This is a
  **fee tally only** — it does not compute or drive any per-placing
  payout, doesn't include added money, and isn't wired into the CSV's
  MoneyWon field (which correctly stays "0.00" until a real payout engine
  exists). CLAUDE.md flags payout formulas as needing exhaustive tests
  before shipping; a full payout engine (splits by placement, category/
  youth exceptions, ties, add-back) is deliberately not attempted here.

## MVP status

This completes every item in CLAUDE.md's 10-sprint plan, plus PDF
results. What's left of the NRHA package: per-class score sheets, a
tally sheet, medication fee summary, collected-paperwork bundling, and
ZIP packaging. Also still deferred per CLAUDE.md's MVP section: AI
extraction, offline mode, Stripe, public live results, other
associations, analytics, SMS, API integrations, and a real payout engine.
