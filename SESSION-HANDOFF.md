# ShowRing IQ — Session Handoff (updated 2026-07-17, 18th session)

## Latest (2026-07-17, 18th session — SIDEBAR NAV FIXES, committed + pushed)

Cleared the two sidebar to-dos flagged last session (commit `db00d8d`,
pushed to main → auto-deployed). Both live-verified on the dev server
against the real Fire Cracker Classic 2-slate weekend:

1. **Active-show indicator.** `src/components/show/show-sidebar-nav.tsx`:
   the current show's button now gets a brand background, semibold text,
   brand chevron, `aria-current="page"`, and a small **"Here"** badge —
   you can finally tell which show you're in from the desktop sidebar.
   Also fixed `isActiveShow` to match the bare `/shows/[id]` route, not
   just `/shows/[id]/*`.
2. **Slate 1 above Slate 2.** `src/app/(app)/layout.tsx` loaded shows
   `start_date` DESC, so Slate 2 (later start) sat above Slate 1. Now
   fetches `start_date` + `weekend_id` and sorts in JS: weekends
   newest-first (by each weekend's latest slate date) but slates WITHIN a
   weekend ascending — Classic I sits above Classic 2, recent weekends
   still on top. No migration; typecheck + lint clean.

Verify gotcha reconfirmed: the running dev server served a stale build on
first paint (highlight only appeared after a hard reload); browser-pane
screenshot timed out — verified via getComputedStyle/DOM instead.

---

# ShowRing IQ — Session Handoff (updated 2026-07-17, 17th session)

This is a plain-text snapshot of where this project stands. Claude's
persistent memory has the same content and loads automatically in a
fresh conversation — this file is just a visible copy you can open
yourself.

## CURRENT STATE (read this first in a new window)

- **Branch `main`, HEAD `f806f9d` (+ this handoff commit), working tree
  clean.** ⚠️ Gotcha this session: the checkout was in a **detached HEAD**
  at `b22dc33`; commits landed detached and had to be reconciled with
  `git branch -f main HEAD` (a clean fast-forward since main was an
  ancestor). Check `git status` for "HEAD detached" before committing.
  GitHub remote
  IS configured now: `origin` → `https://github.com/JKochenour/showring-iq`
  (private). **Push to main auto-deploys to Vercel.**
- **NEW public pages this session (17th):** `/guide` (interactive
  11-step show-setup walkthrough) and `/legal` (Terms, Privacy,
  Validation/Liability disclaimer, Data/Security — a DRAFT template with
  43 bracketed placeholders + a "not yet reviewed by counsel" banner).
  Plus an AI-generated cinematic reining clip on the homepage
  (`public/homepage-hero.mp4`). See the 17th-session section below.
- **AI Help assistant was ALREADY built** (16th session left it in
  place): chat bubble on every logged-in page, `/api/help-chat`
  streaming `claude-opus-4-8`. It only needs `ANTHROPIC_API_KEY` set in
  Vercel to run in prod — no code change. **Still not set as of this
  writing.**
- **AI HELP CHAT IS NOW LIVE (local + prod).** Resolved end of 17th
  session: the user set a real `ANTHROPIC_API_KEY`, rotated it (the
  first full key was exposed in a shared Vercel screenshot), added
  Anthropic credits, fixed the Vercel Key/Value (they'd been swapped),
  and redeployed. Verified: direct API test SUCCESS, local widget answers
  correctly, and the user confirmed the PRODUCTION chat on
  showringiq.com answers a real question. SETUP.md documents the local +
  Vercel setup. Current key ends `…jQAA` (108 chars).
- **Remaining user to-dos:** (1) fill the 43 `/legal` placeholders + get
  an attorney review before public launch; (2) homepage video was
  REVIEWED and kept (good/on-brand; only the rider's head is cropped) —
  a planted-sliding-stop regen is pending Higgsfield credits (workspace
  is out; user held off).
- **DEPLOYED AND LIVE (2026-07-17):** the app runs at **showringiq.com**
  (apex redirects to www) on Vercel, GitHub-connected. It talks to the
  SAME live Supabase DB as local dev — production is real, not a
  sandbox. See [[deployment-vercel]]. **The whole site is behind a
  password gate** (HTTP Basic Auth in middleware, active only when the
  Vercel env var `SITE_GATE_PASSWORD` is set) so the public can't reach
  it pre-launch — remove that env var (or the middleware block) to open
  it up. Vercel env vars set: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Anthropic key NOT set → in-app Help
  AI chat off in prod, harmless). Supabase Auth URL config points at
  showringiq.com + localhost.
- **DESIGN REBRANDED (2026-07-17):** dropped hunter-green + brass (the
  hunt-seat/country-club cliché, wrong for a reining product) for
  **"Silver & Turquoise"** — weathered turquoise (silver-mounted tack) is
  the brand color, aged silver the trim, oiled-leather dark + warm oat
  the surfaces. Applied GLOBALLY via tokens, so marketing homepage,
  auth, public pages, AND the whole logged-in app all recolored;
  interior swept clean. Marketing/auth use Space Grotesk display; app
  content keeps Fraunces. See [[design-language]]. **Do NOT reintroduce
  green or gold.**
- **User directive: reining only** — no new associations/disciplines
  until live testing is done. The 15th session RAN that testing
  (8 phases end-to-end): 2 real bugs found+fixed, 3 papercuts (now all
  fixed), all money penny-exact. See [[live-testing-reining-core]].
- **Migrations 00041–00052 all applied live.** DB matches main.
  (00050 is a one-off data cleanup — already run; never needs re-running.
  00051 = tie-payout fix, 00052 = empty-weekend cleanup, both applied.)
- **THE ENTIRE AGREED ROADMAP IS DONE** (live results → payments → SMS →
  scheduling → offline → second association ✅ AQHA). The 13th session
  shipped, in order, each live-verified: (1) payee/winning-checks +
  close-out-fee run-fee bugfix [00044/00045], (2) public discovery:
  /shows directory + /[org] pages + show-bill-style public schedule +
  full order of go [00046/00047], (3) per-class arena support
  [00048], (4) self-serve exhibitor join requests [00049], (5)
  tablet/arena mode for gate+scoring, (6) phone/tablet/desktop
  responsive pass, (7) AQHA 2026 rule package (zero migrations) +
  per-entry association derivation.
- **Open review items for the user:** the AQHA 2026 package sits
  PUBLISHED in the EPRHA org with mnemonic codes (REIN-AM etc.) —
  review and align codes with AQHA results software before real use.
  The APHA 2026 package (15th session) sits in DRAFT — review its 62
  codes + 5 rules, align codes with APHA Performance Department
  results-format codes, then publish when ready.
- **Known dev gotchas** (details in the session parts below): the PWA
  service worker serves stale CSS/JS during dev — unregister SWs +
  clear caches when edits seem ignored; `npm test`/eslint must not
  scan `.claude/worktrees` (vitest.config.ts + `npx eslint src`
  handle this); browser-pane viewport emulation misreports
  window.innerWidth — trust element clientWidth; agent worktrees
  don't inherit the gitignored `.env.local` — copy it from the main
  checkout before running the dev server in one.
- **Natural next candidates:** configure the real EPRHA Summer Slide
  2026 show (its 64 imported classes are draft — need NRHA codes,
  judges, payout schedules, concurrent groups); a 2nd live-testing
  round on the DEPLOYED site (exhibitor self-service entry, offline
  mode over real Wi-Fi, multi-judge through export, turn on Resend/
  Twilio keys); encode more AQHA rules; public estimated start times.
- **Known dev gotchas:** PWA service worker serves stale CSS/JS during
  dev — unregister SWs + clear caches when edits seem ignored (this
  also logs you out of the dev server; Claude can't sign back in);
  the browser-pane screenshot capture times out with infinite CSS
  animations (marquee) or a flaky renderer — pause via
  `document.getAnimations().forEach(a=>a.pause())` or verify with
  getComputedStyle/DOM checks; PowerShell `git commit -m` mangles
  here-strings with double quotes — use `git commit -F <file>`; the
  local dev server dies intermittently — `preview_list` then restart.

## PRE-LAUNCH CHECKLIST (before removing the password gate)

Non-code go-live to-dos, tracked here so they don't get lost:

- [ ] **Form the business entity.** User resides in **PA** → form a PA LLC.
  File the Certificate of Organization at **file.dos.pa.gov** (~$125, DIY —
  skip LegalZoom-style upsells). Get a **free EIN** at irs.gov (never pay for
  one). PA annual report ~$7/yr (due Sep 30). A single-member operating
  agreement TEMPLATE was drafted and saved to
  `C:\Users\jkoch\Documents\ShowRing-IQ-LLC-Operating-Agreement-TEMPLATE.md`
  (fill the [BRACKETS]; not filed with the state). Consider a CPA later re:
  default-LLC vs S-corp tax election.
- [ ] **Legal page** (`/legal`): fill the **43 [BRACKET] placeholders**
  (entity name, contact email, governing state = PA, effective date) and get
  it reviewed. Claude offered a substantive DRAFTING review (not legal
  sign-off — not a licensed attorney); a human PA attorney should bless the
  disclaimer + youth-data + payments sections before launch. Automated
  option: Termly/iubenda for the Privacy/Terms baseline.
- [ ] **Homepage video** (`public/homepage-hero.mp4`): the current AI clip is
  **NOT a real reining sliding stop** (reads as a gallop/rundown) — user can't
  use it. Replace with real reining footage (drop in at the same path, zero
  code change) OR regenerate a planted-stop clip once Higgsfield credits are
  topped up. Until then, consider removing the "The ring" video band from
  `src/app/page.tsx`.
- [ ] **Set the real NRHA show/approval number** on each slate (Show →
  Settings → `nrhaShowNumber`). The ReinerSuite CSV export is **blocked**
  without it — confirmed by the 2026-07-18 export-readiness test. Both
  slates currently have it empty.
- [x] Test-show cleanup — DONE 2026-07-18 (plus the follow-up reset of
  classes 3/4 left `Draw posted` by concurrent-group propagation).
- [ ] **Remove the password gate**: delete the Vercel env var
  `SITE_GATE_PASSWORD` (or the block in `src/proxy.ts`).
- [x] AI help chat live (ANTHROPIC_API_KEY set in Vercel) — DONE.

## END-TO-END SHOW-CYCLE TEST (2026-07-18) — config validated, tail blocked by tooling

Ran the run-the-show cycle against the real configured **Slate 1 (Fire Cracker
Classic I)**. Note: the Fire Cracker Classic is **NOT live on ShowRing IQ** —
it runs on Horse Show for Windows — so the ShowRing copy is dogfood data and
safe to test against.

**Verified live on the real config:**
- ✅ **Config is NRHA-export-clean.** With a show number set, export readiness
  went from 2 blockers to 1, and the remaining one is the expected "no classes
  are official yet". The validator flagged **no** missing/invalid class codes,
  patterns, or counts — the 60 configured classes pass export validation.
- ✅ **Entry creation** — created an entry (Chex My Spook / Tester Jamie) in the
  Open + Intermediate Open concurrent pair.
- ✅ **Draw generation** — drew class 1 Open (Pattern 17), 1 in draw.
- ✅ **Scoring** — entered 72.5 with judge **Naike Bell**, confirming the 3
  judges configured on the slate are selectable on the score sheet.

**Where it stalled (NOT product defects):**
1. **Submitting a score requires a judge digital signature** (the patterns +
   sign-off feature from an earlier session). The score sat at status `Draft`;
   `Submit` needs the signature step, which blocks class → official → results →
   payout → CSV. Worth knowing for whoever runs scoring.
2. **The browser pane was badly degraded** — tab drifting to /dashboard between
   clicks, screenshot timeouts, denied navigations, ConfirmDialogs not
   rendering, and the dev server dying repeatedly. This blocked the last mile
   and even the UI cleanup.

**Already proven in prior sessions (not re-run):** the full draw → gate → score
→ verify → official → results → payout → ReinerSuite CSV cycle, penny-exact,
incl. concurrent-run score mirroring and the −1/−2 scratch codes.

**CLEANUP — RUN + VERIFIED 2026-07-18.** `cleanup_test_show.sql` deleted the
test entry, reset classes 1 Open + 2 Int Open to draft, and cleared the test
`nrha_show_number`. Verified live: Slate 1 has **0 entries**, no Chex/Tester.

**…but the first cleanup was INCOMPLETE — real lesson:** generating a draw on a
concurrent block advances **every class in that run**, including ones with **no
entries**. Open (1) is grouped with 2/3/4 (Thursday Pattern 17), so drawing
Open left **3 Limited Open** and **4 Rookie Professional** stuck at
`Draw posted` with 0 entered. The cleanup only reset the 2 classes the entry
was actually in. Fixed with:
`update public.classes set status='draft' where id in
('2a5827f6-b9d6-45ce-880b-82c039e952d7','fe2b6b6f-ddc3-486b-8097-108e740334bf');`
**Takeaway: when cleaning up test draws/scores, reset the WHOLE concurrent
group, not just the entered classes.**

**Automation lesson worth keeping:** the `Combobox` typeahead does NOT register
a selection from a JS `.click()` — only a real pointer click does. The reliable
recipe is: JS-focus the input → `computer{type}` → `read_page` (filter=all,
`ref_id` the form, `depth:4`) to get the option's **ref** → `computer{left_click,
ref}`. Class checkboxes DO register via JS `.click()`.

## Latest (2026-07-17, 17th session pt 2 — REAL SHOW CONFIGURED + WEEKEND TESTING + 2 NEW FEATURES)

Same session continued into real-data work on the LIVE DB. Details in memory:
[[fire-cracker-classic-config]], [[back-number-entry-editor]],
[[sidebar-improvements-todo]].

**1. Configured the real EPRHA Fire Cracker Classic 2026 as a 2-slate
weekend.** The prior "Summer Slide 2026" (61 classes) was a mislabeled
show-bill import; the user provided the authoritative PDFs (NRHA approved
class list, Slate 1/2 schedules, entry form, color flyer). Discovered the
real event is **two 30-class slates run as two go's**. Built it right:
weekend "EPRHA Fire Cracker Classic 2026" with **Slate 1 = Classic I
(`938c2d4e…`, Thu–Sat)** and **Slate 2 = Classic 2 (`6ea26648…`, Fri–Sun)**,
60 classes with exact NRHA codes/names/days/patterns/entry+judge fees/added
money, 3 judges (Naike Bell, Matt Lantz, Herm Sherwin), NJ venue (Dreampark
of Gloucester County), concurrent-run groups (same pattern + same day = one
run). **Summer Slide deleted.** All via SQL scripts the USER ran in the
Supabase SQL editor (Claude has only the RLS-limited anon key locally). PDF
extraction: pdfjs-dist for text PDFs (run from project dir), `pdf-to-img` +
`ffmpeg-static` (`transpose=1`) in scratchpad for scanned/image PDFs.

**2. Cross-slate weekend testing — penny-exact.** Entered one horse across
both slates: ONE shared back number, per-run judge fee via concurrent groups
(charged once at highest, not per class), consolidated bill $650 exact. QA
data cleaned up after.

**3. NEW FEATURE — back-number weekend entry editor (commit `5ad0221`).**
The HSW-parity gap the user flagged: the weekend grid was create-only; editing
an entered horse meant going in/out of each show. New **"Manage entries by
back number"** screen (`/organizations/[id]/weekends/[weekendId]/manage`):
search by back number / horse name / rider name → shows the horse + ALL
exhibitors → per exhibitor an editable class grid across both slates,
pre-checked; check to add / uncheck to drop; one Save. New
`saveWeekendRiderClasses` action reconciles adds/removes, creates a slate's
entry (+ shared back number) on first sign-up, deletes emptied entries,
leaves scratched classes. **Live-verified** end to end (add across both slates
incl. new Slate-2 entry, remove, empty-entry deletion; bill recomputed exact).

**4. NEW FEATURE — run fees named with their classes on bills (commit
`f806f9d`).** `computeEntryRunFees` now attaches a `detail` to each run-fee
line ("Open + Intermediate Open · Novice Horse Level 2") shown next to Judge
fee / Video / Photo on the consolidated bill, per-slate bill, and printable
statement. Unit test pins it (28 tests green).

**Still open (user: fix NEXT session):** the sidebar — (a) add an
active-show indicator (can't tell which show you're in), (b) order Slate 1
above Slate 2 (app layout sorts shows by `start_date` DESC). See
[[sidebar-improvements-todo]].

## Latest (2026-07-17, 17th session — AI SUPPORT (already built) + /guide TUTORIAL + /legal + HOMEPAGE VIDEO)

User asked to "build in the AI support, a tutorial page, custom step-by-step
show-setup videos, and a legal page with everything needed." Confirmed three
forks via AskUserQuestion first: tutorial format = **Both** (interactive
real-app walkthrough + a short AI-generated cinematic clip for marketing);
legal specifics = **clear bracketed placeholders** + a pending-counsel banner;
legal scope = **all four** docs. Committed + pushed as `223e725` (auto-deployed).

**1. AI support — was ALREADY fully built; surfaced + documented, no rebuild.**
`src/lib/ai/help-assistant.ts` (Opus 4.8, low effort, ShowRing-IQ system
prompt) + `src/app/api/help-chat/route.ts` (auth, rate limits, streaming) +
`src/components/help/help-chat-widget.tsx` (bottom-right bubble), mounted in
the (app) layout. Dormant in prod ONLY because `ANTHROPIC_API_KEY` isn't set in
Vercel — one env var, no code change. Widget is logged-in-only by design (could
be added to public /guide,/help later if wanted).

**2. `/guide` (public) — interactive 11-step show-setup walkthrough.**
`src/app/(public)/guide/page.tsx` + `guide-walkthrough.tsx` (client). Left step
rail (clickable, progress checks) → per-step narrative + key actions + a
component-accurate UI "frame" for each stage: org → people/horses → show →
staff → classes → entries → validation/check-in → draw/gate → scoring →
results/payouts → NRHA export. Prev/Next + progress dots; ends on a Get-started
CTA. **Design decision worth remembering:** the frames are rendered from the
app's real design tokens with SAMPLE data — deliberately NOT live screenshots —
because (a) every real in-app screen shows the live EPRHA org's actual
people/horses, which must not appear on a PUBLIC page, and (b) the browser-pane
screenshot capture is too flaky/duplicating to build a clean consistent set.
Flow, nav paths, and screen shapes are all accurate. Linked from the in-app
Help page (new turquoise CTA card), marketing footer, and public layout nav.

**3. `/legal` (public) — Terms, Privacy, Disclaimer, Data/Security.**
`src/app/(public)/legal/page.tsx` renders from `legal-content.tsx` (structured
data: LEGAL_DOCS[] with per-section ReactNode bodies + exported placeholder
constants ENTITY/CONTACT_EMAIL/GOVERNING_STATE/EFFECTIVE_DATE). Includes the
CLAUDE.md-required verbatim disclaimer ("Validation assistance based on the
configured rule package. Final responsibility remains with show management and
the applicable association."), a TOC, and a prominent amber "Draft template —
not yet reviewed by counsel" banner. **43 bracketed placeholders** — search the
codebase for `[` in legal-content.tsx. Payments language matches reality
(records payments, never processes cards; Clover terminal). NOT legal advice;
attorney review required before public launch.

**4. Homepage cinematic clip — AI-generated placeholder.**
Higgsfield `kling3_0_turbo`, 5s, 16:9, 7.5 credits: a reining sliding-stop in a
sunlit arena, warm leather + turquoise accent. Saved to
`public/homepage-hero.mp4` (8.3 MB, 1280×720), embedded as a muted autoplay
loop in a new "The ring" band on the marketing homepage (`src/app/page.tsx`).
Verified served (200) and a sampled 2s frame has real tonal range (not
black/broken) — but I could NOT visually review the footage from here (no
ffmpeg; browser pane wouldn't load the raw mp4), so **the user should review it
and I'll regenerate if the horse looks off.** The `/guide` page has a separate
"overview" video slot (`VIDEO_AVAILABLE=false` placeholder) left for a real
app-screen-recording the user can drop in later — NOT the cinematic clip.

**5. Footer/nav wiring.** Guide + Legal links added to the marketing homepage
header + footer (added a © line and a real link row) and the public layout
(which previously had no footer at all).

Lint (`npx eslint src`) + `tsc --noEmit` clean (only the 2 pre-existing benign
RHF `watch()` warnings). Verified live on the local dev server: /guide renders,
11 steps, stepper swaps screens (step 8 → gate board), no console errors;
/legal renders all four docs + banner + 43 placeholders; homepage video element
present + file served + non-black frame + nav/footer links correct. Files:
8 changed, +1666. **Gotcha reconfirmed:** browser-pane screenshots time out /
duplicate the render and misreport viewport width — trust DOM/clientWidth and
verify via javascript_tool, not screenshots.

**Follow-ons after the main commit (same 17th session):**
- **SETUP.md now documents `ANTHROPIC_API_KEY`** (commit `e6ea1c1`): an
  "Optional — AI help chat" env block (local `.env.local`) plus a
  dedicated "Enabling the AI help chat in production (Vercel)" subsection
  (add the env var under the project's Settings → Environment Variables
  for Production, then redeploy). **KEY FINDING: `ANTHROPIC_API_KEY`
  exists in `.env.local` but is EMPTY** (`ANTHROPIC_API_KEY=` with no
  value), so the AI chat is currently OFF in BOTH local dev and prod —
  not just prod. Setting a real `sk-ant-...` key is a credential action
  the USER must do (in the Anthropic console + Vercel); Claude can't and
  shouldn't enter it.
- **Homepage video — REVIEWED, it's good, keeping it.** Could not view
  frames via the browser pane (renderer hangs the moment the video
  plays; seeking a paused video draws black), so extracted frames with
  **`ffmpeg-static` installed into the session scratchpad** (no ffmpeg on
  the system; Node 24 is). A 10-frame contact sheet + two full-res frames
  showed a realistic, on-brand chestnut reining horse doing a
  rundown/slide in a sunlit arena with dust — and it correctly rendered
  **silver-mounted western reining tack** (conchos, headstall + curb
  chain). No AI deformities (4 legs, coherent motion). Only caveats: the
  rider's HEAD is cropped out the top (tight framing), and it reads as a
  galloping rundown more than a planted sliding stop. Verdict: keep as
  the decorative background band (behind object-cover + gradient +
  caption).
- **Planted-sliding-stop regen requested but BLOCKED — Higgsfield
  workspace is OUT OF CREDITS.** The first clip spent the balance.
  **User chose to HOLD OFF.** To redo later: top up credits (the
  `show_plans_and_credits` tool opens the top-up widget) then regenerate
  a "planted sliding stop, hind legs planted, sand rooster-tail, full
  horse AND rider in frame" clip (~7.5 credits/take). OR — best option —
  swap real reining footage into `public/homepage-hero.mp4` (same
  filename → zero code change; the homepage `<video>` points at it).

## Latest (2026-07-17, 16th session — DEPLOYMENT + PASSWORD GATE + DESIGN REBRAND)

Four things this session, all committed + pushed (auto-deployed):

**1. Papercuts + payout tests (commit `ed7c14b`).** Fixed the 3 papercuts
from the live-testing round: weekend-grid reset now returns Bill-to to
Rider; the grid counts physical runs ("N classes (M runs)") instead of
calling class-cells runs; reconciliation per-run fee counts count runs
not entries. Added **`src/lib/payouts.ts`** — a TS mirror of migration
00051's payout formula — with 12 vitest cases pinning the tie-split bug
class down (27/27 tests green). The migration remains the authority;
change both together.

**2. DEPLOYED to Vercel + custom domain (see [[deployment-vercel]]).**
Created private GitHub repo JKochenour/showring-iq, pushed, imported to
Vercel (GitHub-connected, auto-deploy on push). Live at **showringiq.com**.
The domain-attach was the whole saga: it had been added to the Vercel
ACCOUNT but never to the PROJECT, so no TLS cert issued (looked like slow
issuance for ~2h; it wasn't). Fixed by adding it under the project's
Settings → Domains — cert issued in ~10s. Full-stack verified: /login on
prod redirected to /dashboard "Welcome, Jason" from the live DB.

**3. Pre-launch password gate (commit `a9f0748`).** HTTP Basic Auth added
to `src/proxy.ts` middleware, active only when Vercel env var
`SITE_GATE_PASSWORD` is set (local dev stays open). Every route returns
401 until the shared password is entered. Verified locked from outside
(homepage, /shows, published show page all 401). **To launch publicly:
delete that env var, or strip the middleware block.**

**4. DESIGN REBRAND — "Silver & Turquoise" (see [[design-language]]).**
User pushed hard on the homepage looking AI-generated. After 3 marketing
passes (show-program serif → premium pass → mission-control dark grotesk),
the real fix was the PALETTE: hunter-green + brass is the hunt-seat/
country-club cliché and wrong for a reining product. Rebuilt from western-
performance materials — **turquoise (silver-mounted tack) brand, aged
silver trim, oiled-leather + warm-oat surfaces.** Done at the TOKEN level
(`--color-brand-*` → turquoise, `--color-accent-*` → silver, paper→oat,
bg→leather in globals.css) so it flows through shared components into
marketing homepage, auth (login/signup), public pages, AND the whole
logged-in app. Space Grotesk (new `next/font`, `.font-grotesk`) is the
marketing/auth/wordmark display face; app content keeps Fraunces
(`.font-display`). Interior swept clean (commit `6ff6c7d`): semantic
colors intact (danger=red, Official=amber seal, severity blue/amber/red);
only brand/highlight moved to turquoise. **No green or gold anywhere now
— don't reintroduce them.** Commits `25c7169`, `e839575`, `a445b66`,
`dd6374f`, `6ff6c7d`.

## Earlier (2026-07-16, 15th session part 2 — EXTENSIVE LIVE TESTING OF THE REINING CORE: 2 real bugs found+fixed, migrations 00051+00052 applied)

The user directed: reining only until extensive live testing. An 8-phase
end-to-end dress rehearsal ran on a throwaway QA weekend (2 slates, 4
classes each incl. a concurrent pair + youth class), every number
hand-computed BEFORE the UI produced it. All QA data deleted after.

**Two real bugs found and FIXED (both applied live):**
1. **💰 Tie payout split — broken since 00011 (migration `00051`,
   commit `5a5d205`).** calculate_payouts gave each tied entry its own
   placing's FULL percentage instead of splitting placings p..p+n-1 —
   a 2-way tie for 1st on 60/40 paid 120% of the pool ($48+$48 on an
   $80 pool; correct $40+$40, verified live post-fix; non-tied classes
   unchanged). Never caught: the tie machinery was verified in the 7th
   session but no one hand-checked a tied dollar amount.
2. **Orphaned weekends (migration `00052`, commit `d628178`).**
   Deleting a weekend's shows left the invisible show_weekends row
   whose weekend_back_numbers blocked horse deletion with a misleading
   "has show entries" error. AFTER DELETE trigger on shows now drops
   empty weekends + one-off cleanup ran.

**Papercuts logged, not yet fixed:** weekend-grid reset keeps
billTo=owner but clears ownerId (next entry errors); grid success
message counts class-cells as "runs"; reconciliation "N×" counts are
per-entry not per-line (amounts correct).

**Everything else passed, all money penny-exact on first try:**
consolidated weekend billing ($943/$351/$514 = hand predictions);
scratch self-correction ($943→$781); youth $0 office line; validation
fallback; draws/gate/scores mirroring both directions across
concurrent classes; corrections w/ audit; co-champions; payouts incl.
5% retainage + youth exemption; publish → public page; payments;
close-out (2 debtors exactly, idempotent); reconciliation balances
($1,382−$1,014=$368); EPRHA weekend statement; **NRHA CSV field-exact
incl. -1.0 no-score and -2.0 scratch codes**; ZIP package (6 files);
readiness checklist blockers fired and cleared. Note: a fully-scratched
class stays Draft and can't export (deliberate-looking; flagged).

## Earlier (2026-07-16, 15th session — APHA 2026 STARTER RULE PACKAGE, zero migrations, live-verified, committed `a12dc3d`)

The user dropped five rulebook PDFs into `C:\Users\jkoch\Documents\Rulebooks\`
(APHA 2026, USEF 2026 full book, USEF Chapter DR Dressage, USDF Dressage
Protocol, NCHA 2026 — all cataloged in memory) and asked to start the APHA
package. Same playbook as AQHA: pdfjs-dist extraction of all 423 pages →
subagent digest with exact citations → starter button seeding pure data.

- **"Create APHA <year> starter package"** button on Rule Packages
  (`apha-starter-button.tsx` + `createAphaStarterPackage` in actions.ts):
  **62 class codes** (SC-190.A approved events + SC-175.M halter slate)
  across Open / Amateur / **Masters (45+ — APHA's Select-equivalent,
  AM-080.A.2.b)** / Novice Amateur / Youth 18&U / Youth 13&U (the two
  youth divisions OVERLAP — not 13&U/14-18) / Novice Youth / Walk-Trot /
  Green (horse-eligibility, SC-246.D). Leadline seeded no-points
  (YP-105.D). SPB competes with Regular Registry since 2025 (SC-325.A.1).
- **5 cited eligibility rules** (all warnings — family-ownership checks are
  beyond the engine): youth age YP-010.A, amateur age AM-010.A.1, Masters
  45+ (scoped to WP-MAS), amateur ownership AM-020.A (required AT ENTRY),
  youth ownership YP-015.A (points-only).
- **Source notes** carry the operational constants: results postmarked in
  10 CALENDAR days / $29-day late fee (SC-125.A); $3/entry/judge
  processing fee (SC-125.B); 90-day show approval (SC-090.C-D); the
  SC-060.A.1 point chart is entries-dependent so it deliberately does NOT
  fill the flat points_schedule; placings through 7th (SC-155.A);
  exhibitor AND owner memberships inspected at show (SC-160.A).
- **Two findings:** (1) the ">5% error-rate" policy CLAUDE.md attributes
  to APHA is **NOT in the 2026 rulebook** — it's Performance Department
  practice; never cite it to a rule number. (2) APHA publishes class
  NAMES only — no codes in the rulebook; all codes are internal
  mnemonics to align with the Performance Department's results format.
- **Live-verified** in the EPRHA org: package created, all 62 codes
  rendered (LEAD-Y correctly shows Money without Points), all 5 rules +
  full source notes. **Left in DRAFT for the user's review** (the AQHA
  package sits published; this one intentionally doesn't).
- Build + lint clean, 15/15 tests green. Not encoded (future): cross-entry
  limits (SC-185.D), horses-per-exhibitor caps, Novice point caps with the
  cross-breed revaluation table, judge-conflict rules (JU-000.D), class
  date windows.

## Earlier (2026-07-16, 14th session — HTML-ENTITY DECODE IN IMPORTS + DATA CLEANUP, live-verified, merged `3f0bec1`)

Closed the item flagged in passing at the end of 13th-session part 1:
some imported names carried literal HTML entities (e.g.
horses.registered_name = "3Jets&apos; Winterhawk", visible in the
entry-form horse combobox). Ran as a background-task session in a
worktree (branch `claude/clever-kepler-598007`, since merged + deleted).

- **Root cause:** NOT the show-bill PDF parser — the spreadsheet
  import parsers (src/lib/import/csv.ts, xlsx.ts) pass cell text
  through verbatim, so a CSV/XLSX exported from a web system (HSW
  reports / HTML copy-paste) with a literal `&apos;` went into the DB
  as-is. No decode step existed anywhere.
- **Fix (`a43b416`):** `decodeHtmlEntities()` in
  src/lib/import/normalize.ts — single-pass decode of named
  (&amp; &apos; &quot; &lt; &gt; &nbsp;) and numeric/hex (&#39;
  &#x27;) entities; plain ampersands ("Youth 13 & U") and unknown
  sequences untouched; double-encoded input decodes one level per
  pass. Applied in spreadsheet-import.tsx right after parse (headers +
  cells — covers the people/horses/class-code imports AND the preview)
  and on parseShowBill's input. 6 vitest tests.
- **Data cleanup (migration 00050, renamed from 00046 since
  00046-00049 were already taken on main):** one-off SQL-editor script
  — pg_temp decode fn, updates horses (registered_name, barn_name,
  sire, dam, notes) / people (first/last/preferred name, notes) /
  classes.name, touching only rows with entity sequences; ends with
  verification SELECTs that must return zero rows. **User ran it;
  both verification queries came back EMPTY — live DB is clean.**
  Idempotent if ever re-run.
- **Live-verified** in the horses-import preview: a CSV with all four
  entity forms rendered fully decoded (didn't click Import — same
  decoded rows feed the insert; avoided QA data in the real org).
- **vitest.config.ts now does two jobs** (add/add merge conflict,
  combined): the 13th session's `.claude/**` test exclusion + this
  session's `@/*` path alias mirror of tsconfig — before the alias,
  tests could only import alias-free modules (why billing.test.ts was
  the only test). 15/15 tests + build green on main post-merge.
- **New dev gotcha:** agent worktrees don't inherit the gitignored
  `.env.local` — copy it from the main checkout before starting the
  dev server in one.

## Earlier (2026-07-16, 13th session part 7 — AQHA 2026 RULE PACKAGE from the user's official rulebook, live-verified — LAST ROADMAP ITEM DONE)

**Zero migrations — the whole package is data**, proving CLAUDE.md's
"rules are data, not code" with a second association. Source: the user's
official AQHA 2026 rulebook PDF (376 pages, pdfjs-dist extraction in the
session scratchpad; a subagent digest with SHW citations).

- **"Create AQHA <year> starter package"** button on Rule Packages
  (mirrors the NRHA starter): seeds the AQHA association + a draft
  package with **52 class codes** (the SHW805 Achievement Awards catalog
  across Open/Amateur/Select/Youth incl. Level 1 variants; codes are
  internal mnemonics — align with AQHA results-software codes) and **4
  eligibility rules citing their SHW numbers** (youth age SHW118.4,
  amateur age SHW225.1, Select 50+ SHW225.2, youth/amateur ownership
  SHW220 as a warning since immediate-family is beyond the engine).
  Source notes carry the operational constants (points chart SHW261,
  results due 10 business days SHW126.5 + fines, $10/horse fee, rookie
  and Level 1 point/money caps).
- **Fixed the hardcoded NRHA membership check**: validate-entries now
  derives required associations PER ENTRY from the entered classes'
  affiliations (NRHA only as fallback for unaffiliated classes) —
  memberships AND horse registrations, since the validation engine is
  name-generic.
- **Live-verified**: package created + published; class 4 linked to
  AQHA REIN-AM; Jamie's real entry then showed EPRHA+NRHA+AQHA
  membership/registration warnings plus the SHW225.1 amateur rule
  tagged AQHA; ownership rule correctly silent. All test wiring
  reverted. **The AQHA 2026 package remains PUBLISHED in the EPRHA org**
  (harmless, no classes affiliated) — review its codes/rules; not yet
  encoded: cross-enter prohibitions, Level 1 point caps, the
  points-per-entries chart. The extracted rulebook text lives only in
  the session scratchpad (temp) — re-extract from the user's PDF with
  pdfjs-dist if more rules are wanted later.

## Earlier (2026-07-16, 13th session part 6 — RESPONSIVE PASS: phone/tablet/desktop auto-adapt, live-verified)

No migration. The app now adapts by viewport ("autodetects"):
- **MobileNav** (src/components/mobile-nav.tsx): <640px the top header
  gains a hamburger that slides the FULL sidebar nav tree (orgs → shows
  → all show tabs, user + sign out) over the page; any link tap closes
  it. Header is sticky. ≥640px the real sidebar shows as before.
- **ShowTabs** (src/components/show/show-tabs.tsx): the 18-tab show nav
  was plain `flex` with no wrap/scroll — it forced WHOLE-PAGE horizontal
  scroll on phones. Now one horizontally-scrollable row (`.scrollbar-thin`
  utility in globals.css) with an ACTIVE-tab highlight (never existed
  before) that scrolls itself into view.
- main padding tightens on phones (py-5 px-4).
- Wide tables were already in overflow-x-auto wrappers; the remaining
  unwrapped ones are narrow 3-4-column money tables whose text wraps —
  deliberately left alone.

Live-verified: 375px (drawer open/navigate/auto-close; no page overflow
on show dashboard, entries, financials roster, person bill,
reconciliation, 64-row classes list, public show page; entries table
scrolls inside its wrapper), 768px (sidebar back, hamburger gone),
desktop (active tab highlight). Not yet committed as of this writing
(includes the tablet/arena-mode changes from part 5 below).

## Earlier (2026-07-16, 13th session part 5 — TABLET / ARENA MODE for gate + scoring, live-verified)

No migration. "Tablet mode" (KioskToggle) on the gate and scoring class
pages: html.kiosk + Fullscreen API hides the sidebar/chrome (globals.css
mirrors the print-CSS pattern; unmount cleanup restores chrome).
Button/ButtonLink gained size="lg" (44px) and touch-manipulation; gate
one-tap buttons upsized to 44px, class pills bigger, Now-card back
number text-5xl. Scoring class page: AutoRefresh(15) + the in-arena run
highlights with an "In arena" chip (the judge's tablet follows the
gate); score/penalty inputs are 44px font-mono inputMode="decimal"
(numeric keypad), Save/Submit lg; multi-judge inputs same.

Live-verified at 768×1024: kiosk toggle on/off/unmount; a real gate
"In arena" tap (44px measured) showed up highlighted on the scoring
page; run restored to pending; inputs measured 44px/decimal via a
throwaway class-4 entry (deleted after). **Dev-verification gotcha
discovered: the PWA service worker serves STALE CSS/chunks — if edits
seem ignored, unregister SWs + clear caches in the tab.** Not yet
committed as of this writing.

## Earlier (2026-07-16, 13th session part 4 — SELF-SERVE EXHIBITOR JOIN REQUESTS, committed 0bb35b1, LIVE-VERIFIED)

Migration **00049 applied**: `exhibitor_join_requests` (one pending per
user+org; requester sees own, office sees org's via org.members.invite)
+ RPCs `request_exhibitor_access` / `approve_join_request` (link an
existing unclaimed person OR create new, then exhibitor membership —
accept_invite without the email round-trip) / `decline_join_request`
(reason required, shown to requester) / `public_orgs_directory`.
Requester UI on /exhibitor (org picker + message + "Your requests"
status list); office queue on the org People page (link-existing
combobox of unclaimed people, or create-new with names pre-split from
the request). Dashboard new-user card points at the flow.

**Live-verified end-to-end with the owner's own login** (staff but not
exhibitor-linked, so it can legitimately request): request w/ message →
office queue → decline w/ reason → requester sees "Declined + reason" →
re-request → approve as new person ("Kochenour, Jason" created,
Rider/Owner, email carried; member insert correctly SKIPPED since
already an org member) → /exhibitor showed the live account. All four
audit rows exact (access_requested ×2, request_declined w/ reason,
request_approved w/ person_id + linked_existing:false). QA person
record deleted after; the request rows stay as history.

## Earlier (2026-07-16, 13th session part 3 — ARENA SUPPORT, committed 6f30c05)

Migration **00048 applied**: `classes.arena` (free text, e.g. INDOOR/
COVERED) + public_show_classes recreated to expose it. Class create/edit
forms gained an Arena field; the show-bill importer's preview now has an
editable **Arena column** (the parser always extracted arena from
session headers like "Friday, July 17th INDOOR - 7:30 AM Start" but
threw it away). The public schedule splits sections by **day + arena**
("Thursday, July 16, 2026 — INDOOR"); the internal day-sheet gives each
(day, arena) its own parallel time cursor from the day's start.
Live-verified: Thursday split base/COVERED/INDOOR publicly; both arena
sections estimated from 8:00 AM in parallel; importer auto-filled
INDOOR/COVERED from pasted text. Test arenas reverted (real Summer
Slide classes have no arena set yet — set from the real bill when
known). NOTE: no git remote exists yet — the user wants the repo on
Vercel; next step is create a GitHub repo, push, import to Vercel with
NEXT_PUBLIC_SUPABASE_URL/ANON_KEY env vars.

## Earlier (2026-07-16, 13th session part 2 — PUBLIC DISCOVERY: find-shows directory, org pages, show-bill-style public schedule, full order of go)

Guest experience built out (after payee/close-out below, same session).
Migrations **00046 + 00047 applied**, everything live-verified including
bare-anon-key RPC tests. Scope decisions (user: "go with your
recommendations"): exhibitor linking stays INVITE-ONLY (funnel improved
only — self-serve join requests are a possible future item); both the
cross-org directory AND org landing pages built.

- **00046**: anon RPCs `public_shows_directory` / `public_org` /
  `public_org_shows` (00021 style — explicit columns, published only,
  org row only returned if it has a published show, no contact_email).
- **`/shows`** public find-shows directory (search, Live badge,
  upcoming/past). **proxy.ts change:** PROTECTED_PREFIXES "/shows" →
  "/shows/" so the exact index is public, staff pages stay gated.
- **`/[org]`** public org landing page (/eprha works now).
- **Public show page**: full **Order of go** card (whole draw; scratches
  struck through, in-arena highlighted, completed dimmed) in both
  not-started-with-draw and running states. And the flat 65-chip class
  cloud (user: "extremely clustered... like our show bill") replaced by
  **ScheduleByDay**: day headers ("Thursday, July 16, 2026") with ONE
  CHIP per RUN — a concurrent group lists only its lead class (user:
  "for 1100 Open you only need to show Open"); the siblings appear as an
  "Also in this go:" row in the detail area once the run is selected.
  Powered by **00047** (public_show_classes dropped+recreated to add
  scheduled_date + concurrent_group_id).
  Arena ("Thu Indoor") is NOT modeled on classes — flagged as follow-up.
- Funnel: "Find shows" on marketing nav + public header + exhibitor
  picker; dashboard zero-org state explains the exhibitor-invite path.
- `vitest.config.ts` added excluding `.claude/**` (background-task
  worktrees made `npm test` flaky — same class as the eslint gotcha).
- Real-data notes: set class 2's scheduled_date=2026-07-16 on Summer
  Slide (correct; concurrent with class 1, left in place). The leftover
  "99 — QA Multi-Judge Test" class was DELETED from the real show.
- **Committed to main**: `1fdc97e` (discovery batch) + `267fccb` — two
  dead ends fixed while deleting class 99: cancelled classes couldn't
  be deleted (Danger zone hid entirely), and removeEntryClass had no UI
  (entry rows now have Remove beside Scratch for entered rows; the
  cleanup sequence is reinstate → Remove → delete).

## Earlier (2026-07-16, 13th session — PAYEE / WINNING CHECKS + CLOSE-OUT FEE FIX, both live-verified)

The two open items from the 12th session, both on `feature/show-weekends`,
migrations **00044 + 00045 applied**, live-verified with a throwaway QA
show (deleted after). Build/lint/9 tests green.

**1. Payee / winning-checks (00044).** The paper form's "party to receive
winning checks" — separate from the bill-payer. `entries.payee_person_id`
+ `payee_name`; NULL = default (owner of record → rider, the convention
the payee report always used), so existing entries are untouched. Captured
on the office entry form and the weekend entry grid ("Winning checks to",
any org person); editable on the entry detail **"Billing & payee"** card
(entry.edit-gated `setEntryPayee`, audited `entry.payee_set`/`_cleared`
with old/new). **Live W-9 badge** beside the effective payee (verified
`w9` documents, no stored flag per 00039). Copy-entry carries the payee;
exhibitor self-service defaults. `loadPayeeReport` resolves explicit
payee → owner → rider. Verified: create-with-payee, clear ("Use default"),
re-set via the control, audit rows exact.

**2. Close-out fee — the "timing" open item was a REAL BUG (00045).** The
$50-after-deadline fee existed since 00036, but its `apply_close_out_fee`
RPC summed only MATERIALIZED rows (class fees + misc − payments) — since
00042 the judge/video/photo run fees are computed live and never
materialized, so someone owing only run fees looked settled and was
SKIPPED. Debtor detection now happens app-side in `applyCloseOutFee`
using `loadShowBillingRoster` (the exact math staff see), charging each
debtor via `add_misc_charge` (audited, idempotent via the 'Close-out fee'
category check); **00045 drops the stale RPC.** Plus the deadline is now
actually surfaced: a **Close-out card on Financials** (deadline label,
amber once passed with open balances, bulk apply). Verified: a person
with $0 entry fees + $60 judge-only run fee GOT the $50 (old RPC would
have missed them, balance $110 exact; Jamie $225 exact); re-apply →
"Applied to 0 bills".

**Timezone gotcha (fixed):** `close_out_deadline` is stored from a naive
datetime-local string — the office's wall clock sits in the UTC fields.
`closeOutDeadlineInfo` formats the label with timeZone:"UTC" (shows what
was typed) and computes "passed" by interpreting that wall clock in
`shows.timezone`. Any future formatting of 00036-style naive timestamps
must do the same.

**Committed as `788c328`, then the whole `feature/show-weekends` branch
was merged to `main` as `b29c335`** (weekends/circuits, run-level fees,
EPRHA statement, payee, close-out fix — migrations 00041-00045). Also
noted in passing: some imported horse names carry a literal "&apos;"
from the show-bill import — spun off as a background task session
(**resolved in the 14th session**, see the Latest section at the top;
root cause was the spreadsheet import, not the show-bill parser).

## Previous (2026-07-15, 12th session — SHOW WEEKENDS live-verified, then RUN-LEVEL FEES + EPRHA-STYLE STATEMENT + YOUTH $0 built)

Three things this session, all on branch `feature/show-weekends`, all
live-verified to the penny and committed. The user drove the direction by
sharing real EPRHA reference material: a Horse Show for Windows (HSW) entry
walkthrough video, the paper entry form, and — critically — a **real live
statement** (Matt Murphy, $3,898) that the run-fee model was validated
against exactly.

**1. Show weekends — finally LIVE-VERIFIED (commit `118b02a`, migration 00041,
from the 11th session).** Grouped the two pre-staged QA slates into a weekend,
entered ONE horse under TWO riders across BOTH slates via the class×day grid,
and confirmed to the penny: ONE shared back number on the horse; Office $25
charged ONCE (to the first signer); Video $17 + class $50 per run (4 runs);
the 2nd rider added per-run fees but NOT another Office. Consolidated weekend
bill: Jamie $159 / QAJudge One $134. Each slate still exports its own NRHA
readiness independently. No product bugs. QA slates + weekend deleted after.

**2. Run-level fees (commit `d45c7c9`, migration 00042, applied + verified).**
Reworked how judge/video/photo bill. The rule (confirmed against the live
statement): **entry fee per class; judge/video/photo once per RUN** (a set of
classes that run concurrent — the app's existing `concurrent_group_id`), where
the judge fee is the **highest** among the run's classes; office/stall/drug
stay once per horse per weekend. Previously per-run charges were materialized
once per CLASS (over-charging) and there was no judge-fee concept.
- Migration 00042: `classes.judge_fee_cents`; `entry_run_fee_overrides` +
  `set/clear_run_fee_override` RPCs; `update_misc_charge_amount` (edit a
  charge to $0 while keeping the row); `misc_charges.amount_cents >= 0`;
  `apply_per_run_charges` retired to a no-op + its stale rows cleaned up.
- Run fees are **computed live** in `src/lib/billing.ts` (`computeEntryRunFees`,
  unit-tested), self-correcting when a class is scratched/regrouped — not
  materialized. Judge fee $ field on the class form. Bill page: Run fees card
  with per-line **Edit price / Reset** (override a run fee, $0 comps it while
  the line stays); misc charges gained **Edit price** beside Remove (the
  camper case: keep the line for the head count, comp the price).
- **Vitest added** (`npm test`) — 9 tests on the run-fee math.
- Live-verified: 1100(J$75)+1200(J$55, concurrent)+1400(J$55, separate) + Video
  $17 + Office $25, one horse in all three → entry $250, judge $130, video ×2
  $34, office $25 = **$439**. Override video→$0 = $405 (line kept), reset =
  $439, edit office→$0 = $414, scratch 1400 → auto-recompute = $267. All exact.

**3. EPRHA-style itemized statement + youth office $0 line (commit `1bb3762`,
migration 00043, applied + verified).**
- **Statement** rebuilt to match how EPRHA hands bills to exhibitors: grouped
  by **Back # (horse) → slate → itemized rows** (Qty · Description ·
  [Exhibitor] · Amount), per-horse subtotals, **Total Fees / Total amount due**
  footer. Shared `StatementDocument` component; `loadPersonStatement` /
  `loadWeekendPersonStatement`; new **weekend statement** route linked from the
  weekend bill. To itemize office/stall/drug under the right horse, added a
  nullable **`misc_charges.entry_id`** (set by `assign_back_number`;
  legacy/manual charges stay null → shown under an "Other charges" block).
- **Youth office fee** is now a kept **$0 line** ("Office fee - youth entry
  only"), not an omission. `assign_back_number` charges stall/drug to
  youth-only horses and zeroes any charge flagged **youth_exempt**; per-charge
  flag + a **"Youth $0"** settings checkbox; starter-set + a backfill pre-flag
  the office fee. **Behavior change:** youth-only horses now pay stall/drug
  (this matches the live bill; previously the app skipped ALL standard charges
  for youth-only).
- Live-verified: Jamie billed for two horses — Chex (QA Open + QA Int Open
  concurrent → entry $175, judge $75, video $17, office+stall+drug $220 = $487)
  + A Little Chrome (youth-only QA Youth → entry $0, video $17, stall $185 +
  drug $10 + **office $0 "youth entry only"** = $212) = **$699**. The itemized
  statement grouped both horses correctly to the penny.

**Both migrations 00042 + 00043 are applied live.** Build, lint, and 9 tests
green throughout. STILL OPEN (noted, not built): the **payee / winning-checks**
concept (separate from bill-payer, needs a W-9 — both are on the paper entry
form) and the **$50 Sunday close-out** timing.

## Latest (2026-07-13, 11th session — Horse Show for Windows deep dive → SHOW WEEKENDS / CIRCUITS): Did a full feature audit of the legacy competitor HSW (read its entire 131-page manual + changelog) against ShowRing IQ. Published a gap-analysis artifact. The user confirmed EPRHA **never runs multi-go classes and never prints checks** (dropping the two scariest gaps), but **runs every class as two "slates" per weekend** — the same class list offered as two separately-placed, separately-paid, separately-submitted NRHA shows, where a horse makes **two separate runs (one per slate)**. Terminology confirmed by the user: **"a circuit is an event weekend," and one circuit holds multiple slates** — which is exactly the model built here (I labeled it "Weekend" in the UI; rename to "Circuit" is trivial if wanted).

**What "two separate runs" means for the architecture:** two separate shows is the CORRECT model, not a workaround — scoring/results/payouts/NRHA-export are already right per slate and are UNTOUCHED. What was missing is the "circuit" layer that ties the slates so the office enters things once.

**Built (branch `feature/show-weekends`, commit `118b02a`, build+lint clean):**
- **Migration 00041**: `show_weekends` grouping (every show belongs to one; auto weekend-of-one on insert via a before-insert trigger, backfilled for existing shows). **Back number belongs to the HORSE for the whole weekend** — `weekend_back_numbers(weekend_id,horse_id)→number` is the source of truth; the per-entry `back_numbers` table stays a read PROJECTION (26 read sites unchanged) kept in sync by `assign_back_number`. Dropped `unique(show_id,number)` because one horse shown by 3 riders in a class is 3 entries carrying ONE number. **Office/stall/drug charged once per horse per weekend** (when the horse first gets its number, to whoever signs it up); **class/video/photo per run**. RPCs: `group_shows_into_weekend`, `add_show_to_weekend`, `rename_weekend`; `assign_back_number`/`release_back_number` redefined horse-per-weekend.
- **App**: Org "Weekends" tab → list, create (group entry-free shows), hub, and the **class × day entry grid** (pick horse + rider + who's billed [Owner or Rider], check classes per slate; shared back number auto-applies; "add a day later" reuses the same flow). **Consolidated per-person weekend bill** (billing.ts loaders now take a slate SET; read-only total, payments/charge edits stay on each slate and roll up).

**MIGRATION STATUS — IMPORTANT:** 00041 was applied in TWO parts. The user first ran only the SCHEMA half (tables/trigger/backfill) that was pasted, so the RPC half was missing and `group_shows_into_weekend` errored "not found in schema cache" mid-dogfood. The user then ran the **RPC half** (assign_back_number/release_back_number/group/add/rename) — as of end of session, **both halves are applied.**

**LIVE VERIFICATION — NOT YET COMPLETE (picks up next session):** Two entry-free QA slates were created and configured, ready to finish the dogfood:
- `QA Weekend Slate 1` = show id `eac82807-6d4e-4c1f-9354-232501b94918`
- `QA Weekend Slate 2` = show id `d470dd2a-e086-4ce2-9ff2-5e6ab55220ee`
- Each has class **"Green Reiner Level 1" #1, $50 entry fee**, and standard charges **Office fee $25 (per_run OFF) + Video $17 (per_run ON)** — a deliberately minimal, identical set so the once-per-weekend-vs-per-run math is clean. (Med fee $0.)
- **Remaining steps:** group the two slates into a weekend (now unblocked); enter ONE horse under TWO different riders across BOTH slates via the class×day grid; verify to the penny — ONE shared back number on the horse, Office $25 charged ONCE (to the first signer), Video $17 + class $50 per run (so 4 runs = 4× each, and the 2nd rider adds per-run fees but NOT another Office); check the consolidated bill; confirm each slate still exports its own NRHA file; then **delete the two QA slate shows** (and any QA people/horses) to clean up.
- **Dogfood gotchas learned:** driving the StandardChargesEditor and GroupShowsForm via synthetic JS events was flaky (native value-setter + a too-broad `region` selector that grabbed "0.00" inputs from the medication-fee and late-fee cards, mis-targeting amounts). Fixes: scope amount inputs per-row (`labelInput.closest('div')`), and use **real clicks (computer tool) for checkboxes/buttons**. No confirmed product bug in either component — the earlier "vanishing row" scares were automation/selector artifacts. The create-weekend button "not submitting" was purely the missing RPC, not a form bug.

## Latest (2026-07-12, 10th session): live-verified the entire gap-closure batch (all 11 features, migrations 00034-00040 applied by the user) using the same "record → interact → check DB → clean up" discipline as every earlier feature. All 11 confirmed working, several with exact math: per-run charges (QA Video Fee $17 fired once when a class was added), trainer/barn billing (class fee dynamically follows `bill_to_trainer` — moved off the rider's bill onto the trainer's live; misc charges from before the toggle correctly stay put, since they're one-time snapshots, not recomputed), multi-judge scoring ((140.0+150.0)/2 = 145.0 averaged correctly), dual-show entry copy (rider/horse/both same-named target classes matched correctly), reservations (request → confirm → $15 charge, exact). Standings/payee-report/reports-center/gate-sheet verified via correct empty-state + real-data rendering; announcements verified by code review only (did not trigger a live send — that's a "message on someone's behalf" action requiring explicit user go-ahead, not something to fire during unattended QA). One real bug from the debugging session **turned out not to be a bug**: the "4th row vanishes" symptom in Standard Charges was a browser-automation artifact (clicking Remove then Save in the same synchronous script, before React committed the removal) — the component code itself was already correct. **One genuine gap found and fixed**: once a class has a draw, its status becomes workflow-locked and the manual status dropdown disappears — but `deleteClass`'s own error message still said "cancel the class instead," which was no longer reachable from the UI. Added a dedicated `cancelClass` action + "Cancel class" button in the class detail page's Danger Zone, working at any workflow stage (build+lint clean, verified live — class dropped out of the Draws list once cancelled). Not yet committed as of this writing.

## Latest (2026-07-12, end of 8th session): three roadmap features shipped in one stretch — **SMS notifications** (commit `677df32`: src/lib/sms.ts hits Twilio's Messages REST API via fetch, no SDK; skips-with-a-log without TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM; results-posted texts to riders with a phone on file, E.164-normalized from the free-text people.phone; verified live via the skip log with a temp phone, then reverted), **show-bill import** (commit `668047f`: Classes → "Import from show bill" — upload the bill PDF (pdfjs-dist server extraction) or paste text; deterministic parser finds day/arena/start-time headers and class fee rows even with sidebar text merged in; editable preview bulk-creates classes with dates/fees/patterns/youth flags; calibrated on the real EPRHA Fire Cracker Classic bill the user uploaded — 61/61 rows across 8 sessions parsed correctly; verified live with a 4-class create-then-delete, **then run for real at the user's request: all 61 Fire Cracker classes now exist on the show as class numbers 4-64 (64 classes total), scheduled across July 16-19, patterns/fees/youth flags set, one hand-fix applied in the preview (Sat Youth 14-18 pattern 1→14 from a PDF text-split); still to configure on them: class-code links, judges, payout schedules, Single Purse flags, statuses (all draft)**), and **offline show-day mode v1** (commit `bdcea5f`: PWA manifest/icon/service worker — visited pages stay viewable offline via network-first page caching, static assets cache-first, auth never cached, writes deliberately fail visibly (no sync queue yet), amber offline banner; SW/cache/banner all verified live). **Offline v2 followed (commit `224f303`): an IndexedDB write queue for an explicit allowlist of replay-safe actions — gate status changes and first-time score entry — queued when offline or when a call dies mid-flight, replayed FIFO on reconnect (and app load), pending count in the offline banner, syncing banner during replay, server-rejected replays surfaced in a dismissible failure banner; corrections/money/publishing stay online-only by design. Verified live: two gate writes queued offline, both synced in order on reconnect, state then restored.** Note: the DB show "EPRHA Summer Slide 2026" shares dates AND venue with the Fire Cracker Classic bill — it is almost certainly the same real show under a test name.

## Update, later on 2026-07-12 (still 8th session): the user corrected the payments assumption — **EPRHA uses Clover, not Stripe** — so the deferred "Stripe/online payments" item was reframed and its first half built: migration `00033_payments.sql`, a processor-agnostic payment LEDGER (cash / check / card-on-the-org's-own-terminal / other) mirroring the misc_charges architecture (invoice.view reads, security-definer record_payment/remove_payment RPCs on invoice.edit, full audit, reason-required removal, integer cents). Person bill page gained a Payments card and balance-aware bottom line (Balance due / Paid in full / Overpaid); the Financials roster gained Paid and Balance columns. Applied and verified live end-to-end (recorded a $123.45 check on the real bill — $910.00 − $123.45 = $786.55 exact everywhere — then removed it with a reason; data restored). Commit `a961e61`. The platform records payments, it never processes cards; if online self-service checkout is ever wanted, the EPRHA path is Clover's Ecommerce API creating rows in this same ledger — do not redesign around a processor. CLAUDE.md's "Payments: Stripe" tech-stack line is stale for this org. Follow-on commit `3ba992c`: printable end-of-show reconciliation report at `/shows/[id]/financials/reconciliation` — charges (entry fees + misc by category), collections by method, open balances (outstanding vs overpaid), a charged−collected check line, and purse/distribution status; derived live from the same loader as the roster (buildRoster extraction, no migration); verified with a $500 test card payment ($910 charged − $500 = $410 outstanding, exact) then reverted. Commit `05dbed6` added the printable per-person statement (`/shows/[id]/financials/[personId]/statement`, linked from the bill page) and replaced CLAUDE.md's stale "Payments: Stripe" tech-stack line with the processor-agnostic-ledger description.

## Status: the entire remaining punch list except Stripe is now DONE. 8th session shipped six features — NRHA Payback Schedule A/B auto-fill, event-classification compliance checklist (00031), results/scores timing reminders (P(9)/(10)), payout distribution deadline tracking (00032), the first real Resend email wiring (entry confirmations + results-posted notifications, graceful no-key fallback), and inline editing for rule-package class codes. Both migrations applied, all six features browser-verified live, all committed. **Stripe/online payments is the only deferred build item left.** Email sends are currently skipped-with-a-log because RESEND_API_KEY isn't set — add RESEND_API_KEY + RESEND_FROM to .env.local (see SETUP.md) to turn them on. See "2026-07-12 (8th session)" below; older sections are prior-session history.

## 2026-07-12 (8th session): punch-list closeout — payback schedules, classification checklist, timing reminders, payout deadline, Resend email, class-code edit

User resumed with "everything but option 1" (Stripe). Six features, five
commits (8d37289, 64127dd, 25b2061, 142aedf, fdaac19, 7de1956 — class-code
edit and email were separate), migrations 00031-00032, same
one-feature-at-a-time build/lint/verify/commit rhythm.

**1. Payback Schedule A/B auto-fill** — `src/lib/nrha-payback-schedules.ts`
(no migration). Both handbook tables transcribed from the 2024 Handbook
PDF (extracted with pdfjs-dist in the scratchpad; the rotated table pages
needed hand-reconstruction, every row cross-checked to sum to exactly
100%). Key structural insight: A and B share identical percentage rows
per number-of-places-paid; only the entries→places thresholds differ
(B escalates faster, 15 places at 30+ entries vs 61+ for A). The class
results page payout editor gained a "Fill from NRHA Payback Schedule"
control (schedule picker + horse count defaulting to entered entries +
live "pays N places" preview). Verified live: A/20 → 32/22/19/10/9/8;
B/20 → 25/18/13/10/8.5/7/6/5/4/3.5 (both exactly the published rows).

**2. Event-classification compliance checklist (G(10))** — migration
`00031_event_classification.sql`: `shows.event_classification` (declared
D/C/B/BB/A/AA) + 'videographer' added to show_staff roles. Reference
matrix in `src/lib/nrha-event-classification.ts`. Card on the Staff page
(chosen over a 16th nav tab — G(10) is mostly staffing requirements):
declared-vs-money-implied comparison, auto-checked items (secretary/
manager/steward assigned and genuinely separate individuals, videographer
warning at BB / fail at A/AA, five judges on $50k+ classes at AA,
secretary-vs-rider name cross-check), manual-confirm items (NRHA
certification, judges-list/immediate-family, 12-hour judging). Verified
live: declared C, saved, checklist recomputed to pass; the no-secretary
fail correctly fired on real staff data.

**3. Results/scores timing reminders (P(9)/(10))** — no migration, soft
only. Scoring page flags classes fully scored >1h ago with results still
unposted (P(9)); static timing notes on Scoring and Results; the
score-correction dialog now states the P(10) lock (judge-sheet
corrections end when the judge leaves the grounds; inputting-error
corrections any time). "Class completion" is approximated by the last
score's updated_at since status transitions aren't timestamped. Verified
live: both Official classes showed the amber hint, the Results-posted
class didn't, and the dialog text rendered.

**4. Payout distribution deadline (P(5))** — migration
`00032_payout_distribution.sql`: `shows.payouts_distributed_at` + a
security-definer `mark_payouts_distributed(p_show, p_distributed)` RPC
gated on payout.approve. RPC rather than a column grant because the shows
UPDATE policy only allows draft/published rows and distribution happens
after a show locks. Financials card: end_date+30-days deadline
(amber ≤7 days, red overdue), total money won, P(4) 10-business-day
results note, audited mark/unmark toggle. Verified live round-trip
(marked July 12 → unmarked → "due by August 18, 2026 (37 days left)").
**Reviewer catch worth noting:** first draft passed p_show as log_audit's
7th positional arg — that slot is p_reason; the signature is (org,
action, entity_type, entity_id, old, new, reason, show).

**5. Resend email notifications** — first Resend footprint (package
installed, `src/lib/email.ts` + `src/lib/email-templates.ts`).
`sendEmail` skips with a console log when RESEND_API_KEY is unset and
never throws — email must never break the triggering flow. Two
notifications: entry confirmation to the signed-in exhibitor on
self-service entry (fee table, idempotency key
`entry-confirmation/<entryId>`), and results-posted fan-out on publish
(recipients resolved entry→rider_person→people.email, sequential single
sends, `results-posted/<entryClassId>` keys so re-publishing within 24h
can't double-send). Verified live with no key: publishing class 1 logged
`[email skipped — RESEND_API_KEY not set] to=jamie.tester+exhibitor@...
subject="Results posted — Class 1, ..."` and the publish itself was
unaffected; class 1 was then unposted to restore its real Official state.
SETUP.md documents RESEND_API_KEY/RESEND_FROM (set both together — the
sandbox sender only delivers to the Resend account owner's inbox).

**6. Class-code edit** — no migration (the rules.edit UPDATE RLS policy
has existed since 00011; only UI/action were missing). AddClassCodeForm
gained an `existing` mode (pre-filled, "Save changes" + Cancel, submits
a new updateClassCode server action); new ClassCodeRow client component
renders each row with an Edit button expanding an inline full-width
editor row. Covers the 00030 fee-cap fields too. Verified live:
pre-fill correct, edit persisted across a full reload, reverted, editor
closes on save. Known cosmetic quirk: the add-form and edit-form share
element ids (cc-code etc.) — functional but not ideal a11y.

**Environment notes:** dev-mode Next server-action logging prints action
arguments to the server console INCLUDING the login password — dev-only
Next.js behavior, not app code, but worth knowing when sharing logs.
Two react-compiler lint errors ("Cannot call impure function during
render") were hit for Date.now() — fixed both times by moving time math
into `src/lib/results-timing.ts` and passing computed values as props.

Build and lint clean after every feature (only the 2 pre-existing benign
RHF watch() warnings). All verification used the live EPRHA Summer Slide
2026 show; every state change made during verification (classification
C stayed declared — harmless and accurate; everything else reverted:
payout schedule not saved, distribution unmarked, class code reverted,
class 1 unposted).

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

**Migrations 00031 and 00032 are applied** — 00031
(`00031_event_classification.sql`, shows.event_classification +
videographer staff role) and 00032 (`00032_payout_distribution.sql`,
payouts_distributed_at + mark_payouts_distributed RPC), both confirmed
live and browser-verified (2026-07-12, 8th session).

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
All 33 migrations are now live. Details below are from earlier
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
