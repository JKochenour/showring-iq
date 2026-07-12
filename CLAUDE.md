# CLAUDE.md — ShowRing IQ

Cloud-based horse show management platform ("horse show operating system"). Manages entries, class codes, eligibility, scoring, payouts, live results, documents, and official association submission packages from one place.

**Promise:** Run the show. Validate everything. Submit clean results.

The system doesn't just print results — it protects the show from mistakes all weekend. Legacy competitors (Horse Show for Windows, HSS, ShowPro) are Windows-era; modern ones (Pegasus, Horse Spot) lack deep association compliance. We win on: official-ready export packages, rule engines, permissions, live validation, and offline show-day reliability.

---

## Tech Stack

- **Frontend:** Next.js (App Router), TypeScript, Tailwind, React Hook Form, Zod
- **Backend:** Next.js server actions / API routes, Supabase (Postgres, Auth, Storage, Realtime), Row Level Security
- **Payments:** processor-agnostic ledger — the app records payments (cash/check/card), it never processes cards; orgs run their own terminal (EPRHA uses Clover). Online checkout, if ever built, plugs into the same ledger via the org's processor (Clover Ecommerce API for EPRHA — not Stripe) · **Email:** Resend · **SMS:** Twilio (deferred)
- **AI:** OCR/document parsing first, LLM API for interpretation (deferred — never required for core function)
- **Offline:** PWA + IndexedDB + background sync queue (deferred until core is proven)
- **Exports:** CSV, PDF, ZIP generators
- **Monitoring:** Sentry, PostHog

---

## Non-Negotiable Architecture Principles

1. **Organization-first, not show-first.** Everything hangs off an organization (e.g., EPRHA): members, roles, shows, exhibitors, horses, judges, sponsors, templates, historical data. Orgs create new shows each year without re-entering anything.

2. **Association rules are DATA, not code.** Never hard-code NRHA/AQHA/APHA/NSBA logic. Everything flows through versioned **rule packages** (e.g., "NRHA 2026") containing: class code catalogs, eligibility rules (JSON condition objects), required ID fields, fee/payout formulas, export schemas, submission checklists, deadlines. Lifecycle: draft → review → tested → published → deprecated → archived.

3. **Validate early, continuously.** Run validation at: show creation, class add, entry submit, back-number assign, check-in, pre-draw, pre-scoring, pre-results, pre-export, show close. Severity levels: `info` / `warning` / `blocking` / `critical`. The secretary must never discover a dirty results file after the show (APHA returns files with >5% error rate and assesses late fees).

4. **Granular permissions, roles as presets.** Permissions are individual grants (`show.edit`, `score.correct_official`, `payout.approve`, …) grouped into role presets. Never check roles directly in business logic — check permissions.

5. **Official-ready exports, not generic CSVs.** An export is a complete association submission package (CSV + PDFs + checklists + ZIP), validated before generation.

6. **Audit everything.** Every override, score correction, re-draw, unlock, and publish writes an audit log: actor, role, action, entity, old/new values, reason, IP, device, timestamp.

7. **Money logic demands extreme accuracy.** Store money as integer cents. Payout pool must balance to the penny. Write exhaustive tests for payouts (retainage, added money, jackpot, ties, no-scores, youth/category exceptions) before shipping any of it.

---

## Roles (permission presets)

| Role | Can | Cannot |
|---|---|---|
| Platform Owner | All orgs, billing plans, rule packages, templates, system logs | — |
| Organization Owner | Everything in org: staff, roles, billing, shows, transfer ownership | — |
| Show Manager | Create/edit show, affiliations, staff, classes, fees, publish, lock/unlock, approve final results, generate submission package | — |
| Show Secretary | Entries, exhibitors, horses, back numbers, membership checks, scores, corrections, reports, draft exports, check-in | Delete show, billing, change affiliation after lock, remove managers, publish official results or change payout rules without grant |
| Assistant Secretary | Entries, documents, check-in, packets, reports | Financial exports, official submissions, setup changes, finalizing results |
| Judge | View assigned classes + patterns, enter scores/penalties, sign digital cards, submit for verification | Financials, entries, class list, payouts, other judges' scores pre-submission |
| Gate / Paddock | Order of go, check-in, hold/scratch/no-show, drag breaks, conflicts | Edit scores, fees, official results |
| Announcer | Read-only: current class, back #, rider/horse/owner/trainer, sponsor notes, released results | Any edits |
| Treasurer | Invoices, record cash/check, refunds, reconcile payouts, financial reports | Class rules, scores, publishing results |
| Score Verifier | Review scores, mark official | — |
| Exhibitor | Own profile/horses/documents, enter shows, pay, add/scratch requests, view own invoices | Anyone else's data |
| Public | Published show page, schedule, live class status, posted results, rider/horse search | Everything else |

---

## Data Model (core tables)

**Tenancy/auth:** `users`, `profiles`, `organizations`, `organization_members`, `organization_roles`, `organization_permissions`, `organization_role_permissions`

**Shows:** `shows`, `show_settings`, `show_staff`, `show_affiliations`, `show_venues`, `show_arenas`, `show_days`

**Rules:** `associations`, `association_rule_packages`, `association_class_codes`, `association_fee_rules`, `association_eligibility_rules`, `association_export_schemas`, `association_document_requirements`

**Classes:** `classes`, `class_affiliations`, `class_affiliation_codes`, `class_judges`, `class_patterns`, `class_schedule`, `class_draws`

**People/horses:** `people`, `person_memberships`, `person_relationships`, `horses`, `horse_registrations`, `horse_ownerships`, `horse_leases`

**Entries:** `entries`, `entry_classes`, `entry_fees`, `entry_documents`, `entry_validations`, `back_numbers`

**Scoring/results:** `scores`, `score_details`, `score_penalties`, `score_verifications`, `judge_cards`, `results`, `result_exports`, `result_export_files`, `submission_packages`

**Financial:** `invoices`, `invoice_items`, `payments`, `refunds`, `payouts`, `payout_items`

**Support:** `documents`, `document_extractions`, `document_verifications`, `notifications`, `messages`, `audit_logs`, `support_tickets`

Key relationships: org → shows/people/horses/documents; show → affiliations/classes/entries/back_numbers/invoices/packages; entry → entry_classes/fees/documents/scores/results; class → affiliations/draws/scores/results.

**Multi-affiliation classes:** one class can count for several affiliations with different codes and eligibility (e.g., Class 12 "Green Reiner Level 1" → NRHA code 5300 counts for money+points; EPRHA code counts for year-end). Keep display name, local class number, per-affiliation codes/rules/results strictly separated.

**People/horses:** person has roles (rider/owner/trainer/agent/guardian/judge) and `association_memberships[]` (number, type, status, dates, verified_at, source, card doc). Horse has `association_registrations[]` (registration + competition license numbers), ownership/lease records with percentages, dates, and lease documents. Build duplicate detection (similar names, same numbers/emails) — AI-assisted matching, human approval required.

**Back numbers:** configurable ownership (show + horse + rider + owner + entry group) because shows differ. Auto/manual assign, reserved ranges, no duplicates, transfer with audit.

---

## Security / RLS

- Every table tenant-scoped by `organization_id`; access requires active org membership, then permission checks narrow further.
- Judges see only assigned classes; exhibitors see only their own entries/invoices/documents; public sees only published data.
- Sensitive data (birthdates, addresses, youth info, payment info, W-9s, health documents): RLS + file access policies + signed URLs + encryption at rest + minimal exposure.

---

## Key Workflows

**Score lifecycle:** judge enters → reviews → signs/submits → secretary verifies → pending official → class complete → results calculated → manager approves → posted. Corrections require: reason, corrected-by, timestamp, before/after values, audit log. Correction types (`judge_sheet_correction`, `data_entry_correction`, `payout_correction`, `placing_correction`) carry different permissions.

**Class statuses:** Draft → Open → Entry closed → Draw posted → In progress → Scoring → Pending verification → Official → Results posted → Exported → Archived.

**Result statuses:** Unscored → Partially scored → Pending verification → Verified → Official → Posted → Exported → Submitted (→ Corrected). Entry statuses: shown / scratch / no_score / zero / dq / excused.

**Entry flow (exhibitor):** select show → select rider/horse (existing or new) → select classes (show eligible by default; reveal ineligible WITH reasons, e.g., "✕ Non Pro Derby — missing ownership relationship") → upload documents → fees/checkout → confirmation with missing-items list. Office flow adds: walk-up entries, spreadsheet import, eligibility override with mandatory reason + audit.

**Draws/gate:** auto-generate with settings (random seed, rider/trainer spacing, drag every N runs, late-entry rules); re-draw requires audit. Gate screen = current class, Now / On Deck / 2 Away / 3 Away, one-tap actions (checked in, at gate, in arena, completed, hold, scratch, no-show, drag now).

**Scheduling:** conflict detection (horse/rider overlap, trainer spacing, judge double-booking, arena conflicts, missing drags, youth-classes-too-late). Estimated start times = entries × avg run time + drags + breaks + setup, updated live.

**Tie handling (per rule package):** ties stand, split money, run-off, co-champions, tiebreakers, duplicate trophies, youth placement rules, multi-go finals.

**Documents:** uploaded → OCR/AI extract → human verifies → attached to person/horse/show/class → used in validation → included in export package. Track expiration (Coggins, memberships, licenses).

---

## NRHA Export (first export target — must be perfect)

**ReinerSuite CSV:** semicolon delimiter, all fields quoted, required header, no blank fields, money as `0.00`, exact class codes and show number, numeric pattern numbers. Field order (exact):
`ShowNum; ShowName; ClassName; ClassCode; PatternNum; EntryCount; ShownCount; GoType; GoNum; Horse; HorseNrha; Member; MemberNrha; BackNum; PlaceNum; TotalScore; MoneyWon`

Score codes: `-2` = scratched, `-1` = no score. Entries included in payout must still appear in the CSV.

**Package (ZIP):** CSV + full PDF results + per-class score sheets + tally sheet + retainage summary (5%) + medication fee summary + collected paperwork (memberships, licenses, transfers, non-pro declarations) + submission summary + validation report + audit log.

**Pre-export validation (all must pass):** show/approval numbers, class codes, pattern numbers, entry/shown counts, horse licenses, rider numbers, placings, scores, money won, scratch handling, all PDFs present, retainage, medication total, representative report status. Surface as a readiness checklist screen ("NRHA Submission: Ready" / "APHA: 3 issues").

Later exports: APHA (memberships, show cards, ownership/lease, error-rate pre-check), AQHA, NSBA (approval forms, medication report, purse worksheets — approval docs due 90 days out).

---

## MVP Scope (EPRHA + NRHA reining shows)

**Build:** login, organizations, roles/permissions, create show, staff, NRHA affiliation info, classes, exhibitors, horses, entries, back numbers, draw, score entry, placings, money won, results, NRHA CSV, PDF results, submission checklist, audit log.

**Defer:** AI extraction, offline mode, Stripe, public live results, other associations, analytics, SMS, API integrations.

---

## Sprint Plan

1. **Foundation** — auth, app shell, organizations, members, basic permissions
2. **Show creation** — create show, dashboard, settings, staff
3. **Classes** — CRUD, class list/detail, fees, schedule order
4. **People & horses** — riders, owners, trainers, horses, membership/license fields
5. **Entries** — create entry, horse/rider + class selection, back numbers, list/detail
6. **Check-in & validation** — missing-info flags, basic eligibility, check-in screen, missing paperwork/payment dashboard
7. **Draws & gate** — draw generation, manual reorder, gate screen, announcer screen
8. **Scoring** — judge-style screen, secretary entry, verification, score-change audit
9. **Results** — placings, tie handling v1, publish, public results page, PDF class results
10. **NRHA export v1** — fields, CSV generation, export validation, checklist, downloadable package

Do NOT start with AI, offline, or every association. Build the show core first; architect generically so affiliations plug in as rule packages.

---

## Routes

**Public:** `/`, pricing, features, find shows, org page, show page (`/[org]/[show-slug]`), enter show, results, schedule
**App:** `/dashboard`, `/organizations/:id/{members,settings,shows}`, `/shows/:id/{dashboard,setup,affiliations,classes,schedule,entries,check-in,back-numbers,draws,gate,judging,scores,results,financials,documents,reports,exports,audit,settings}`
**Exhibitor:** `/exhibitor/{dashboard,profile,horses,people,documents,entries,invoices,messages}`
**Admin:** `/admin/{organizations,users,rule-packages,associations,class-codes,export-schemas,support,system-logs}`

**Show dashboard cards:** entries, scratches, payments, missing docs, eligibility issues, classes running, results pending, export readiness (% per affiliation), messages, staff activity.

---

## Engineering Conventions

- TypeScript strict; Zod schemas shared between client and server validation
- All mutations via server actions with permission checks; never trust client role claims
- Money = integer cents; never floats
- Every state-changing action considers: permission? validation? audit log entry?
- Eligibility rules stored as JSON condition objects (`field` / `operator` / `value` / `severity` / `message`), evaluated by a generic engine
- Export schemas are data (delimiter, quoting, ordered field list) interpreted by a generic CSV generator
- Migrations: additive where possible; RLS policy on every new table before it ships

---

## Legal / Positioning Constraints

- Never claim the system "guarantees" eligibility. Standard disclaimer: "Validation assistance based on configured rule package. Final responsibility remains with show management and the applicable association."
- Association data: use public rules where permitted, support manual upload of official class code lists and approvals, store source/version metadata, pursue partnerships later. Do not copy protected association materials.
- Support reality: shows run on weekends — design for self-service diagnostics and clear error messages.
