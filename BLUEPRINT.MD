Product Blueprint: Modern Web-Based Horse Show Management Platform

Working name ideas:
- ShowRing IQ
- EquiShow Cloud
- RingMaster IQ
- ShowOffice Pro
- HorseShow OS
- ReinerSuite Companion — maybe not usable because of naming conflict risk with NRHA/ReinerSuite
- EquiEvent IQ
- Show Secretary IQ

Recommended name:
ShowRing IQ

Tagline:
The modern horse show operating system for entries, scoring, eligibility, results, and association-ready reporting.


1. CORE PROBLEM

Horse show management is currently split between:

- Old Windows software
- Spreadsheets
- Paper forms
- Manual membership checks
- Manual class code verification
- Manual payout calculations
- Manual scorecards
- Manual results exports
- Manual association upload packages
- Facebook posts and PDFs for schedules/results
- Multiple people working from different files
- Unclear permissions
- Last-minute cleanup after the show

The goal is to build one platform where a show manager can run the entire event from setup through final submission.

The software cannot just “print results.” It needs to protect the show from mistakes all weekend long.


2. MARKET / COMPETITOR REALITY

Horse Show for Windows / FunnWare

Horse Show for Windows is established and designed for scoring, ranking, and managing competition events. Public listings describe it as supporting circuit awards, score distribution, and competition management. Other public listings indicate it has support for many associations, including AQHA, ABRA, AHA, APHA, ApHC, IBHA, NRHA, NRCHA, NSBA, POAC, PFHA, PHBA, PtHA, USEF, and open shows.

Opportunity:
Powerful, but legacy. Build a cloud-first alternative with modern UI, permissions, mobile scoring, automatic backups, offline support, and live public results.


HSS / HorseShowsOnline

HSS is highly established in hunter/jumper/dressage/eventing and says it is integrated with USEF, USHJA, Equine Canada, and FEI. Its features include online entries, credit card payments, SMS, validation/submission integrations, multi-user installs, over 200 reports, judge cards, exports, scoring, add-back money, invoices, check management, document scanning, and more.

Opportunity:
Very feature-rich, but still built around traditional show-office software patterns. A new product can compete with smoother setup, cleaner web UX, better mobile workflows, and stronger cross-discipline rule packaging.


ShowPro

ShowPro supports a wide range of breeds and disciplines, including USEF, hunter/jumper, eventing, reining, Arabian, Saddlebred, Morgan, Quarter Horse, NSBA, NRCHA, Paint, Pinto, Appaloosa, Buckskin, Palomino, Miniature Horse/Shetland, Welsh/Cob, Tennessee Walking Horse, and open shows. It is modular and can combine multiple breeds/disciplines into one show.

Opportunity:
Depth of discipline support is the bar. A superior product must eventually match that depth but make it easier to use, update, and validate.


Pegasus

Pegasus markets itself as modern horse show software for online entries, scheduling/scoring, results, and reports. It lists full show management features including entries, event paperwork, payments, conflict-aware scheduling, scoring/results, and reporting.

Opportunity:
Pegasus is probably one of the more modern competitors. To beat it, the product needs deeper rule engines, stronger association submission packages, better offline show-day operation, and more complete secretary/manager controls.


Horse Spot

Horse Spot markets itself as a cloud-based show management platform for local and rated shows across disciplines. It highlights easy entries, live scoring, rider/horse stats, ringside results, estimated start times, real-time schedule updates, digital checkouts, series points tracking, bulk actions, automated reporting, payments, analytics, and no annual fees.

Opportunity:
This is another serious modern competitor. A new product needs to win on association compliance, permissions, NRHA/AQHA/APHA-ready exports, rule package versioning, and real show secretary pain points.


APHA

APHA gives a clear example of where this product can shine. APHA tells show secretaries to validate entries before the show, checking memberships, show cards, ownership/lease relationships, names, horse numbers, and class codes. APHA also says results with more than a 5% error rate will be returned to the secretary for correction and resubmission, with late fees assessed.

Opportunity:
Build pre-show and live-show validation so the secretary does not find out after the show that the results file is dirty.


NSBA

NSBA has show manager documents, show approval forms, medication reports, show management handbooks, results forms, purse calculation worksheets, entry blanks, exhibitor reports, and judges cards. Its show approval documents are due 90 days before the event, with some late consideration rules.

Opportunity:
Build association-specific document checklists and reminders.


NRHA

NRHA has official ReinerSuite upload guides. The NRHA CSV guide lists required CSV columns including ShowNum, ShowName, ClassName, ClassCode, PatternNum, EntryCount, ShownCount, GoType, GoNum, Horse, HorseNrha, Member, MemberNrha, BackNum, PlaceNum, TotalScore, and MoneyWon.

Opportunity:
This gives us a perfect first export target.


3. PRODUCT POSITIONING

This should be positioned as:

A cloud-based horse show operating system that manages entries, class codes, eligibility, scoring, payouts, live results, documents, and official association submission packages from one place.

The selling promise:

Run the show. Validate everything. Submit clean results.

Secondary promise:

No installs. No Access database. No spreadsheet chaos. No permission confusion. No end-of-show panic.


4. CORE PRODUCT PRINCIPLES

Principle 1: Organization-first, not show-first

The app should be built around organizations.

Example:

EPRHA
  ├── Members / Staff
  ├── Roles / Permissions
  ├── Shows
  ├── Exhibitors
  ├── Horses
  ├── Sponsors
  ├── Judges
  ├── Reports
  └── Historical Data

Every year, EPRHA can create new shows while keeping historical data, staff permissions, saved horses, riders, sponsors, and class templates.


Principle 2: Association rules are data, not hard-coded logic

Do not hard-code NRHA, AQHA, APHA, NSBA, etc. directly into the app.

Instead, create a Rule Package Engine.

Example:

Association Rule Packages
  ├── NRHA 2026
  ├── NRHA 2027
  ├── APHA 2026
  ├── AQHA 2026
  ├── NSBA 2026
  ├── EPRHA Local Rules 2026
  └── Open Show Default

Each rule package controls:

- Class codes
- Class names
- Allowed divisions
- Eligibility rules
- Required memberships
- Required horse licenses/registrations
- Required owner data
- Required documents
- Required fees
- Required score fields
- Payout formulas
- Point formulas
- Report/export format
- Submission checklist
- Deadlines
- Warnings/errors


Principle 3: Validate early, not after the show

The system should constantly detect problems.

Examples:

- Missing NRHA rider number
- Missing horse competition license
- Wrong class code
- Horse/rider name does not match association record
- Owner membership missing
- Horse ownership mismatch
- Amateur eligibility issue
- Youth age issue
- Duplicate back number
- Missing judge signature
- Score missing
- Payout does not balance
- Required PDF not attached
- Submission deadline approaching


Principle 4: Role-based permissions from day one

A show should not be editable by everyone.

For EPRHA:

- Show managers can create/edit shows.
- Secretaries can manage entries and scores.
- Judges can only score assigned classes.
- Gate people can manage order of go.
- Announcers can view but not edit.
- Treasurers can handle financials.
- Spectators can only view public results.


Principle 5: Offline-first for show-day workflows

Horse show internet is unreliable.

The judge tablet, gate screen, and secretary scoring screen should work offline and sync when connection returns.


Principle 6: Export packages must be official-ready

The system should not merely export a generic CSV.

It should generate an association-specific package.

For NRHA:

- ReinerSuite CSV
- PDF results
- Summary sheet
- Tally sheet
- Score sheets
- Medication total
- Payment/fee summary
- Representative report status
- Applications/forms collected
- Submission checklist


5. MAIN USER TYPES

Platform Owner

That would be you or the SaaS company.

Can:

- Manage all organizations
- Manage billing plans
- Manage rule packages
- Review support tickets
- View system logs
- Publish association updates
- Manage templates
- Manage internal admins


Organization Owner

Example: EPRHA president or account owner.

Can:

- Create organization
- Invite staff
- Assign roles
- Manage billing
- Create shows
- Manage organization templates
- View all organization shows
- Transfer ownership
- Archive historical shows


Show Manager

Can:

- Create/edit show
- Select affiliations
- Set show dates
- Set venue
- Add judges
- Add show secretary
- Configure fees
- Configure class list
- Approve schedule
- Publish show
- Lock/unlock show
- Approve final results
- Generate submission package


Show Secretary

Can:

- Add/edit entries
- Add/edit exhibitors
- Add/edit horses
- Check memberships/documents
- Assign back numbers
- Add/scratch classes
- Enter results
- Correct data-entry errors
- Print reports
- Generate drafts of exports
- Manage check-in
- Upload score sheets

Should not be allowed to:

- Delete the show
- Change billing
- Change show affiliation after lock
- Remove managers
- Publish official results without approval unless granted
- Change payout rules after results are official unless granted


Assistant Secretary

Can:

- Help with entries
- Check documents
- Process check-ins
- Assign packets
- Print reports

Restricted from:

- Financial exports
- Official submissions
- Major show setup changes
- Finalizing results


Judge

Can:

- View assigned classes
- View pattern
- Enter scores
- Mark penalties
- Sign digital scorecards
- Submit class for verification

Cannot:

- See financials
- Change entries
- Change class list
- Change payouts
- See other judge scores before submission unless allowed


Gate Person / Paddock Manager

Can:

- View class order
- Mark rider checked in
- Mark hold/scratch/no-show
- Reorder drag breaks if allowed
- Communicate delays
- See conflicts

Cannot:

- Edit scores
- Edit fees
- Edit official results


Announcer

Can:

- View current class
- View back number, rider, horse, owner, trainer
- View sponsor notes
- View results after released
- View scripts

Cannot:

- Edit entries or scores


Treasurer

Can:

- View invoices
- Record cash/check payments
- Process refunds
- Reconcile payouts
- Export financial reports
- See outstanding balances

Cannot necessarily:

- Edit class rules
- Change scores
- Publish results


Association Reviewer

For future use.

Can:

- View submission package
- Review validation status
- Comment on errors
- Download files


Exhibitor

Can:

- Create profile
- Add riders/horses/owners/trainers
- Upload documents
- Enter shows
- Pay fees
- View invoices
- Request adds/scratches
- View schedule/results
- Receive alerts


Public Viewer / Spectator

Can:

- View public show page
- View schedule
- View live class status
- View posted results
- Search rider/horse
- Scan QR code


6. PERMISSION SYSTEM

Do not build permissions as simple roles only. Build roles as presets made of individual permissions.

Permission categories:

Organization
  org.view
  org.edit
  org.billing.manage
  org.members.invite
  org.members.remove
  org.roles.manage

Shows
  show.create
  show.view
  show.edit
  show.delete
  show.lock
  show.publish
  show.archive

Affiliations
  affiliation.add
  affiliation.remove
  affiliation.configure
  affiliation.lock

Classes
  class.create
  class.edit
  class.delete
  class.schedule
  class.lock
  class.combine
  class.split

Entries
  entry.create
  entry.edit
  entry.delete
  entry.scratch
  entry.reinstate
  entry.assign_back_number
  entry.check_in

People/Horses
  person.create
  person.edit
  horse.create
  horse.edit
  ownership.edit
  membership.edit

Documents
  document.upload
  document.verify
  document.reject
  document.delete

Scoring
  score.enter
  score.edit_unofficial
  score.correct_official
  score.verify
  score.finalize
  score.publish

Results
  result.view
  result.publish
  result.unpublish
  result.export
  result.submit_package

Financials
  invoice.view
  invoice.edit
  payment.record
  payment.refund
  payout.calculate
  payout.approve
  financial_reports.view

Reports
  report.view
  report.generate
  report.export

Audit
  audit.view

Rule Packages
  rules.view
  rules.create
  rules.edit
  rules.publish


Example EPRHA roles:

Organization Owner:
Everything

Show Manager:
Show setup, staff, class setup, affiliations, publish, finalize, exports

Show Secretary:
Entries, check-in, back numbers, scores, reports, draft exports

Assistant Secretary:
Entries, check-in, documents, reports

Judge:
Assigned class scoring only

Gate Person:
Order of go/check-in/scratch/hold

Announcer:
Read-only announcer screen

Treasurer:
Invoices/payments/payouts

Score Verifier:
Review scores and mark official

Public:
Published schedule/results only


7. CORE MODULES

Module A: Organization Management

Purpose:
Manage EPRHA or any show-producing entity.

Features:

- Create organization
- Organization profile
- Logo
- Colors
- Website
- Contact email
- Physical address
- Tax/payment info
- Association memberships
- Staff list
- Role templates
- Saved venues
- Saved judges
- Saved sponsors
- Saved show templates
- Historical shows
- Organization-level point system
- Organization-level year-end awards

Data needed:

organizations
organization_members
organization_roles
organization_permissions
organization_settings
organization_templates
organization_sponsors
organization_venues
organization_judges


Module B: Show Creation Wizard

Purpose:
Create a show correctly from the start.

Step 1: Basic Info

Fields:

- Show name
- Organization
- Start date
- End date
- Time zone
- Venue
- City/state
- Contact person
- Show manager
- Show secretary
- Show website/public URL
- Emergency contact
- Vet contact
- Farrier contact
- Office hours


Step 2: Show Type

Options:

- NRHA approved
- AQHA approved
- APHA approved
- NSBA approved
- NRCHA approved
- NCHA approved
- AHA approved
- USEF approved
- Open show
- 4-H
- Local club
- Custom

Allow multiple affiliations.

Example:

EPRHA Summer Slide
  ├── NRHA Approved
  ├── AQHA Special Event
  ├── NSBA Dual Approved
  └── EPRHA Year-End Points


Step 3: Association Details

For each selected affiliation:

- Approval number
- Show/slate number
- Association contact
- Submission deadline
- Required forms
- Required class code list
- Required judge credentials
- Fee rules
- Medication fee rules
- Retainage rules
- Required export format


Step 4: Show Staff

Assign:

- Manager
- Secretary
- Assistant secretaries
- Treasurer
- Judges
- Gate staff
- Announcer
- Show representative
- Steward
- Veterinarian
- Farrier
- Photographer
- Livestream contact


Step 5: Rings / Arenas

Fields:

- Arena name
- Discipline
- Start time
- Drag frequency
- Warmup restrictions
- Schooling times
- Estimated class length
- Gate person
- Announcer


Step 6: Fees

Fee types:

- Class entry fee
- Office fee
- NRHA fee
- Medication fee
- Stall fee
- Shavings
- RV/camping
- Late fee
- Grounds fee
- Drug fee
- Video fee
- Cattle fee
- Scratch fee
- Jackpot/add-back
- Trophy/plaque fee
- Association fee
- Credit card fee
- Refund rules


Step 7: Class List

Options:

- Import from prior show
- Import from association template
- Build manually
- Upload showbill
- AI extract class list from PDF
- Select approved classes from rule package

Fields per class:

- Class number
- Class name
- Association class code
- Discipline
- Division
- Pattern/test
- Go type
- Go number
- Entry fee
- Added money
- Jackpot
- Trophy cost
- Payout schedule
- Age eligibility
- Rider eligibility
- Horse eligibility
- Max entries
- Min entries
- Draw required?
- Open for online entry?
- Counts for year-end points?
- Counts for association?
- Concurrent with another class?
- Combined with another class?
- Split allowed?
- Drag settings
- Judge assignment


Step 8: Publish Show

Before publishing, system checks:

- Show dates valid
- Staff assigned
- Secretary assigned
- Judges assigned
- Affiliation requirements complete
- Required forms uploaded
- Classes have valid codes
- Fees configured
- Public entry deadline set
- Refund/scratch policy set


Module C: Association Rule Package Engine

This is the heart of the product.

Each association rule package should include:

rule_package
  id
  association_id
  year
  version
  effective_start_date
  effective_end_date
  status: draft / published / retired
  source_notes
  reviewed_by
  published_at


Rule package contents:

1. Class code catalog

Fields:

class_code
association
year
code
name
short_name
discipline
division
category
level
age_group
horse_type
rider_type
is_youth
is_amateur
is_open
is_non_pro
is_rookie
is_green
is_prime_time
is_masters
requires_pattern
requires_score
requires_time
requires_judge_card
counts_for_points
counts_for_money
eligible_for_year_end
active


2. Eligibility rules

Example rule object:

{
  "rule_id": "nrha_non_pro_owner_requirement",
  "applies_to": ["NRHA_NON_PRO"],
  "conditions": [
    {
      "field": "rider.nrha_non_pro_status",
      "operator": "equals",
      "value": "active"
    },
    {
      "field": "horse.owner_relationship_to_rider",
      "operator": "in",
      "value": ["self", "immediate_family", "approved_lease"]
    }
  ],
  "severity": "blocking",
  "message": "Rider must meet NRHA Non Pro ownership/relationship requirements."
}


3. Required identification fields

For NRHA:

- Show number
- Class code
- Horse name
- Horse NRHA competition license
- Rider/member name
- Rider NRHA number
- Back number
- Score
- Placing
- Money won


4. Fee formulas

Example NRHA:

- 5% retainage
- Trophy/plaque handling
- Medication fee
- Youth exceptions
- Category 10 exceptions


5. Export schema

Example:

NRHA_REINERSUITE_CSV_2026
  delimiter: semicolon
  quote_all_fields: true
  required_order:
    1 ShowNum
    2 ShowName
    3 ClassName
    4 ClassCode
    5 PatternNum
    6 EntryCount
    7 ShownCount
    8 GoType
    9 GoNum
    10 Horse
    11 HorseNrha
    12 Member
    13 MemberNrha
    14 BackNum
    15 PlaceNum
    16 TotalScore
    17 MoneyWon


6. Submission checklist

For NRHA:

- ReinerSuite CSV
- PDF results
- Score sheets
- Summary sheet
- Tally sheet
- Medication total
- Processing paperwork
- Representative report status
- Payment confirmation
- Applications collected
- Transfer/license/membership forms


8. ELIGIBILITY ENGINE

This is one of the biggest ways to beat the current market.

What the eligibility engine checks:

Rider/person checks:

- Association membership active
- Correct membership type
- Youth age
- Amateur status
- Non Pro status
- Rookie eligibility
- Lifetime earnings
- Professional status
- Suspension/censure flags
- Required declarations
- Required waivers
- Required SafeSport status where applicable
- Required relationship to horse owner
- Required owner/rider relationship


Horse checks:

- Association registration/license
- Correct registry
- Ownership current
- Lease current
- Age eligibility
- Sex eligibility
- Breed eligibility
- Incentive enrollment
- Competition license
- Medication fee required
- Duplicate horse issue
- Name spelling mismatch
- ID mismatch


Entry checks:

- Horse/rider eligible for class
- Class still open
- Fees paid or balance allowed
- Required documents uploaded
- Owner/rider relationship valid
- Horse not already entered with conflict
- Rider not double-booked
- Back number assigned
- Draw position assigned
- Membership data complete


Class checks:

- Class code valid
- Association approval includes class
- Required pattern/test selected
- Required judge assigned
- Min/max entries
- Combined/split legality
- Concurrent class rules
- Counts for correct affiliation


Error severity levels:

Info:
Example: Rider has unpaid balance.

Warning:
Example: Horse license not verified yet.

Blocking:
Example: Missing required association number.

Critical:
Example: Invalid class code for approved association.


Validation timing:

The system should run validation:

- When show is created
- When class is added
- When entry is submitted
- When back number is assigned
- At check-in
- Before draw/order of go
- Before scoring
- Before posting results
- Before closing class
- Before exporting association results
- Before closing show


9. PEOPLE, HORSES, OWNERS, TRAINERS

This app needs a strong master database.

Person profile fields:

first_name
middle_name
last_name
preferred_name
email
phone
address
birthdate
emergency_contact
association_memberships[]
roles: rider, owner, trainer, agent, parent_guardian, manager, judge


Association memberships:

person_id
association
membership_number
membership_type
status
effective_date
expiration_date
verified_at
verified_source
card_document_id
notes


Horse profile fields:

registered_name
barn_name
breed
sex
color
foal_year
foal_date
sire
dam
owner
lessee
trainer
association_registrations[]
health_documents[]


Horse association registrations:

horse_id
association
registration_number
competition_license_number
status
owner_of_record
effective_date
expiration_date
verified_at
verified_source
document_id


Ownership/lease relationships:

horse_id
owner_person_id
owner_entity_id
ownership_percentage
start_date
end_date
lease_type
lease_document_id
verified


Duplicate prevention:

The system needs duplicate detection:

- Similar horse names
- Same association number
- Same person name + state
- Same email
- Same membership number
- Same horse registration number

Use AI-assisted matching but require human approval.


10. ENTRY SYSTEM

Exhibitor entry flow:

Step 1: Select show

Public show page:

- Show name
- Venue
- Dates
- Entry deadline
- Stall deadline
- Class list
- Showbill PDF
- Office contact
- Rules
- Fees
- Documents required
- Enter now button


Step 2: Select rider / horse

Exhibitor chooses existing profile or creates new.


Step 3: Select classes

System shows only eligible classes by default, with ability to reveal ineligible classes and reasons.

Example:

Eligible:
✓ Green Reiner Level 1
✓ Rookie Level 1
✓ Limited Non Pro

Not eligible:
✕ Non Pro Derby — missing ownership relationship
✕ Youth 14-18 — rider age ineligible
✕ Open Futurity — horse age mismatch


Step 4: Upload documents

Possible docs:

- Coggins
- Health certificate
- Membership card
- Amateur card
- Non Pro declaration
- Horse papers
- Competition license
- Lease
- W-9
- Stall request
- RV request
- Liability waiver
- Minor release


Step 5: Fees / checkout

Show:

- Class fees
- Office fee
- Stall fees
- Shavings
- Camping
- Drug/medication fee
- Association fees
- Processing fee
- Discounts
- Credits
- Balance due


Step 6: Confirmation

After entry:

- Confirmation number
- Entry summary
- Missing items
- Balance due
- Ability to add/scratch before deadline
- Email/text confirmation


Show office entry flow:

Secretary can:

- Create walk-up entry
- Import from spreadsheet
- Import prior exhibitor
- Override eligibility with reason
- Mark pending paperwork
- Add temporary membership/license applications
- Assign back number
- Print packet

Every override must create an audit log.


11. BACK NUMBER SYSTEM

Features:

- Auto-assign back numbers
- Manual assign
- Reserve number range
- Prevent duplicates
- Print back number list
- Print exhibitor packets
- Search by number
- Merge duplicate numbers
- Transfer number if horse changed
- Associate number with horse/rider combo or exhibitor account depending show rules

Recommended logic:

Back number belongs to:
  Show
  Horse
  Rider
  Owner
  Entry group

Allow configuration because different shows handle back numbers differently.


12. CLASS MANAGEMENT

Each class should have:

class_id
show_id
class_number
display_order
class_name
association_class_code
association_id
rule_package_id
discipline
division
category
pattern_number
go_type
go_number
arena_id
scheduled_start
actual_start
actual_end
status
entry_fee
added_money
jackpot_amount
payout_schedule
judge_ids
counts_for_points
counts_for_money
public_visible


Class statuses:

Draft
Open for entries
Entry closed
Draw posted
In progress
Scoring
Pending verification
Official
Results posted
Exported
Archived


Class actions:

- Add class
- Duplicate class
- Combine classes
- Split class
- Cancel class
- Move class
- Change pattern
- Assign judge
- Assign arena
- Set drag frequency
- Lock class
- Unlock with reason
- Export class results
- Print judge cards
- Print gate sheet
- Print announcer sheet


13. SCHEDULING / CONFLICT DETECTION

Schedule builder views:

- Calendar view
- Arena timeline
- Class list
- Drag/break planner
- Judge schedule
- Horse/rider conflict view


Conflict detection:

Detect:

- Same horse in overlapping classes
- Same rider in overlapping classes
- Same trainer with multiple horses too close together
- Judge double-booked
- Arena conflict
- Drag break missing
- Warmup conflict
- Class projected past show limit
- Youth classes too late
- Multi-affiliation class conflicts


Estimated start times:

Calculate using:

estimated_class_duration =
  entries * average_time_per_run
  + drag_breaks
  + judge_breaks
  + setup_time

Update in real time as class progress changes.


Public updates:

Show public:

- “Currently running Class 12”
- “Class 14 estimated 2:35 PM”
- “Drag after every 8 horses”
- “Back #221 on deck”
- Text/email alerts


14. DRAW / ORDER OF GO

Features:

- Auto-generate draw
- Manual adjust
- Randomize by class
- Avoid same rider/horse too close
- Trainer conflict spacing
- Drag break insertion
- Mark scratches
- Mark holds
- Mark no-show
- Re-draw with audit log
- Print draw
- Publish draw
- Gate screen sync


Draw settings:

random_seed
avoid_same_rider_spacing
avoid_same_trainer_spacing
drag_every_n_runs
manual_drag_positions
allow_late_entries_after_draw
late_entry_position_rule


15. GATE / RING MANAGEMENT

Gate person screen should be simple and fast.

Gate screen layout:

Current class:

Class 12 — NRHA Green Reiner Level 1
Pattern 8
Judge: Smith
Entries: 22 / Shown: 17

Order:

Now: Back #214 — Horse / Rider
On Deck: Back #188
2 Away: Back #233
3 Away: Back #201

Actions:

- Checked in
- At gate
- In arena
- Completed
- Hold
- Scratch
- No show
- Drag now
- Add note
- Message office
- Message announcer


Announcer view:

Shows:

- Back number
- Horse
- Rider
- Owner
- Trainer
- Hometown
- Sponsor notes
- Class sponsor
- Previous score if allowed
- Next rider
- Results after posted


16. JUDGE SCORING

This must be discipline-specific.

For NRHA/reining, the scoring screen should support:

- Pattern number
- Maneuver scores
- Penalties
- Total score
- No score
- Zero score
- Scratch
- Multiple judges
- Judge signature
- Digital timestamp
- Scorecard PDF generation


Score workflow:

Judge enters score
  ↓
Judge reviews
  ↓
Judge signs/submits
  ↓
Secretary verifies
  ↓
Score becomes pending official
  ↓
Class complete
  ↓
Results calculated
  ↓
Manager/authorized secretary approves
  ↓
Results posted


Score correction rules:

Allow corrections, but require:

- Reason
- Corrected by
- Time
- Before/after values
- Optional judge confirmation
- Audit log

Build the system to respect score correction restrictions.

Score correction types:

judge_sheet_correction
data_entry_correction
payout_correction
placing_correction

Each type has different permissions.


17. RESULTS ENGINE

Result statuses:

Unscored
Partially scored
Pending verification
Verified
Official
Posted
Exported
Submitted
Corrected


Result data for each entry/class:

class_id
entry_id
back_number
horse_id
rider_id
owner_id
score
raw_score_data
penalties
placing
tie_status
money_won
points_earned
status: shown / scratch / no_score / zero / dq / excused
judge_card_id
verified_by
official_at
posted_at


Tie handling:

Support by rule package:

- Ties stand
- Split money
- Run-off
- Co-champions
- Tiebreaker
- Duplicate trophy purchase
- Youth placement rules
- Multi-go finals logic


Live results:

Public-facing results:

- Class placings
- Score
- Horse
- Rider
- Owner
- Money won if public
- Points if public
- Sponsor
- PDF download
- Share link

Admin-facing results:

- Validation status
- Export readiness
- Missing IDs
- Payout calculations
- Scorecard links
- Audit trail


18. PAYOUT / FINANCIAL ENGINE

Fee tracking:

Track:

- Entry fees
- Office fees
- Stalls
- Shavings
- RV
- Camping
- Late fees
- Association fees
- Medication fees
- Cattle fees
- Trophy fees
- Refunds
- Credits
- Online payments
- Cash/check
- Returned checks


Payout types:

- Fixed payout
- Percentage payout
- Jackpot
- Added money
- Add-back
- Association formula
- Custom formula
- Youth exception
- Category exception
- No payout
- Trophy only


Payout validation:

System checks:

- Payout pool equals expected amount
- Retainage calculated
- Trophy costs handled correctly
- Youth exceptions handled correctly
- Category exceptions handled correctly
- No scores/scratches handled correctly
- Money rounded to cents
- Payout recipients valid
- W-9 required if threshold met
- Check/ACH export ready


Financial reports:

- Balance due by exhibitor
- Paid/unpaid entries
- Revenue by class
- Revenue by fee type
- Stall revenue
- Payout summary
- Retainage summary
- Medication fee summary
- Check register
- Refund report
- Stripe payout report
- 1099 report
- End-of-show reconciliation


19. DOCUMENTS / PAPERWORK

Document types:

- Show approval
- Showbill
- Premium list
- Pattern
- Test
- Judge card
- Score sheet
- Entry form
- Membership application
- Horse license application
- Transfer
- Lease
- Non Pro declaration
- Amateur card
- Youth card
- Coggins
- Health certificate
- W-9
- Liability waiver
- Representative report
- Medication report
- Incident report
- Tally sheet
- Summary sheet
- Results PDF
- Association submission receipt


Document workflow:

Uploaded
  ↓
AI reads document
  ↓
Data extracted
  ↓
Human verifies
  ↓
Attached to person/horse/show/class
  ↓
Used in validation
  ↓
Included in export package if required


AI document extraction:

For example:

- Read NRHA membership card
- Extract member number
- Extract expiration date
- Extract horse competition license number
- Extract owner name
- Extract Coggins date
- Extract health certificate date
- Detect missing signature
- Detect wrong show date
- Detect expired paperwork


Document storage:

Every document should have:

document_id
organization_id
show_id
uploaded_by
file_name
file_type
storage_path
document_type
attached_to_type
attached_to_id
ocr_text
ai_extracted_data
verification_status
verified_by
verified_at
expires_at
required_for_submission


20. NRHA EXPORT PACKAGE

This should be the first serious affiliation export.

NRHA package generator button:

Generate NRHA Submission Package

The system runs:

1. Validate show approval numbers
2. Validate class codes
3. Validate pattern numbers
4. Validate entry/shown counts
5. Validate horse NRHA license numbers
6. Validate rider NRHA numbers
7. Validate placings
8. Validate scores
9. Validate money won
10. Validate scratches/no scores
11. Validate PDF results
12. Validate score sheets
13. Validate tally sheet
14. Validate summary sheet
15. Validate medication total
16. Validate 5% retainage
17. Validate representative report status
18. Generate CSV
19. Generate PDFs
20. Zip package


NRHA CSV export format:

The export must produce fields in this order:

ShowNum
ShowName
ClassName
ClassCode
PatternNum
EntryCount
ShownCount
GoType
GoNum
Horse
HorseNrha
Member
MemberNrha
BackNum
PlaceNum
TotalScore
MoneyWon


NRHA CSV formatting rules:

- Semicolon delimiter
- Quoted fields
- Required header
- No blank fields
- Money as 0.00 if none
- Class code exact
- Show number exact
- Pattern number numeric
- Horse/member spelling as accurate as possible
- ClassName used as confirmation, ClassCode primary
- One export can include all classes/shows for the event


NRHA scratch/no-score handling:

Score codes:

-2 = Scratched entry
-1 = No Score

If an entry’s earnings are included in the payout, that entry must still be displayed in the CSV.


NRHA submission checklist screen:

NRHA Submission Readiness

Show Info
✓ Show number entered
✓ Show name matches approval
✓ Show dates complete

Classes
✓ All class codes valid
✓ All pattern numbers numeric
✓ All go numbers complete

Entries
✓ All riders have NRHA numbers
✓ All horses have NRHA licenses or valid exception
✓ Back numbers complete

Scoring
✓ All scores entered
✓ Scratches/no scores marked correctly
✓ Placings complete
✓ Money won calculated

Documents
✓ PDF results generated
✓ Score sheets attached
✓ Summary sheet generated
✓ Tally sheet generated
✓ Medication total generated
✓ Representative report status recorded

Fees
✓ 5% retainage calculated
✓ Medication fees calculated
✓ Payment summary ready

Export
✓ ReinerSuite CSV generated
✓ Submission ZIP generated


NRHA package contents:

EPRHA_Summer_Slide_NRHA_Submission_2026.zip
  /csv
    nrha_reinersuite_results.csv
  /pdf_results
    full_show_results.pdf
    class_results_by_slate.pdf
  /score_sheets
    class_001_score_sheets.pdf
    class_002_score_sheets.pdf
  /financial
    nrha_tally_sheet.pdf
    retainage_summary.pdf
    medication_fee_summary.pdf
  /paperwork
    membership_applications.pdf
    horse_license_applications.pdf
    transfers.pdf
    non_pro_declarations.pdf
  /summary
    submission_summary.pdf
    validation_report.pdf
    audit_log.pdf


21. APHA EXPORT PACKAGE

APHA gives a clear blueprint for validation.

The system should check:

- Memberships
- Show cards
- Ownership/relation to owner
- Show leases
- Names
- APHA member numbers
- Horse numbers
- Class codes
- All required fields complete


APHA-specific features:

- PHcentral-related checklist
- Approved class code selector
- Show approval deadline reminder
- Judge eligibility reminder
- Secretary/manager membership check
- Ownership/lease validation
- Show card validation
- Error-rate pre-check


22. NSBA EXPORT / DOCUMENT PACKAGE

NSBA module should include:

- Show approval summary
- Dual Approved class application
- Special Event class application
- Futurity class application
- Slot class application
- Medication report
- Results forms
- Class purse calculation worksheet
- Entry blanks
- Exhibitor report
- Judges cards


23. MULTI-AFFILIATION SHOWS

A class may count for multiple affiliations.

Example:

Class 18 — Rookie Level 1
  ├── NRHA class code
  ├── EPRHA year-end points
  └── Sponsor jackpot

Or:

Class 27 — Ranch Riding
  ├── AQHA code
  ├── APHA Special Event code
  ├── NSBA dual approved
  └── Local circuit points


The app must separate:

- Display class name
- Local class number
- Association class code
- Association result code
- Rule package
- Points eligibility
- Payout eligibility
- Export eligibility


Data model:

classes
class_affiliations
class_affiliation_codes
class_affiliation_rules
class_affiliation_results

Example:

Class 12
  local_class_number: 12
  display_name: Green Reiner Level 1

Class Affiliations:
  NRHA:
    class_code: 5300
    counts_for_money: true
    counts_for_points: true

  EPRHA:
    class_code: EPRHA-GR-L1
    counts_for_year_end: true


24. REPORTS

Show office reports:

- Full class list
- Class schedule
- Daily schedule
- Ring schedule
- Judge schedule
- Draw sheets
- Gate sheets
- Announcer sheets
- Back number list
- Exhibitor list
- Horse list
- Owner list
- Trainer list
- Missing paperwork
- Missing payment
- Check-in list
- Stall list
- RV/camping list
- Shavings list
- Scratch/add report
- Class entry count report
- Class revenue report
- Payout report
- Results by class
- Results by exhibitor
- Results by horse
- Association submission report
- Audit log
- Incident report


Public reports:

- Showbill
- Schedule
- Estimated start times
- Draw/order of go
- Posted results
- High point standings
- Sponsor listing


Association reports:

- NRHA submission package
- APHA results export
- AQHA results export
- NSBA forms
- AHA results files
- USEF export
- Custom CSV
- Custom PDF


25. LIVE PUBLIC SHOW HUB

Every show should get a public page.

Example:

showringiq.com/eprha/summer-slide-2026

Public page includes:

- Show info
- Venue
- Dates
- Contact
- Enter show button
- Showbill PDF
- Pattern/test downloads
- Schedule
- Live class status
- Estimated start times
- Draws
- Results
- Sponsors
- Updates/announcements
- QR code


Spectator features:

- Search horse
- Search rider
- Follow back number
- Text alerts
- Favorite classes
- View live results
- Share result


26. NOTIFICATIONS

Email/SMS/push notifications:

Send to exhibitors:

- Entry received
- Payment received
- Missing document
- Missing membership
- Entry approved
- Back number assigned
- Draw posted
- Class running soon
- Class delayed
- Results posted
- Balance due
- Refund issued
- Scratch confirmed


Send to staff:

- New entry submitted
- Eligibility issue
- Missing required document
- Payment failed
- Score pending verification
- Class ready to publish
- Export error
- Submission deadline approaching


27. AUDIT LOG

Everything important must be logged.

Example:

2026-07-09 10:22 AM
Kim added Back #214 to Class 12.

2026-07-09 10:33 AM
Jason changed Class 12 pattern from 8 to 10.

2026-07-09 11:01 AM
Judge Smith submitted score 71.5 for Back #214.

2026-07-09 11:08 AM
Secretary corrected score input from 71.0 to 71.5.
Reason: Data entry typo from score sheet.

2026-07-09 11:20 AM
Jason approved Class 12 results.

2026-07-09 11:21 AM
Class 12 results published publicly.


Audit record fields:

audit_id
organization_id
show_id
actor_user_id
actor_role
action_type
entity_type
entity_id
old_value
new_value
reason
ip_address
device_id
created_at


28. DATABASE BLUEPRINT

Recommended stack:

- Next.js
- TypeScript
- Supabase/Postgres
- Supabase Auth
- Supabase Storage
- Row Level Security
- Stripe
- Resend/SendGrid for email
- Twilio for SMS
- OpenAI/AI service for document extraction
- PWA/offline sync for tablets


Core tables:

users
profiles

organizations
organization_members
organization_roles
organization_permissions
organization_role_permissions

shows
show_settings
show_staff
show_affiliations
show_venues
show_arenas
show_days

associations
association_rule_packages
association_class_codes
association_fee_rules
association_eligibility_rules
association_export_schemas
association_document_requirements

classes
class_affiliations
class_judges
class_patterns
class_schedule
class_draws

people
person_memberships
person_relationships

horses
horse_registrations
horse_ownerships
horse_leases

entries
entry_classes
entry_fees
entry_documents
entry_validations

back_numbers

scores
score_details
score_penalties
score_verifications
judge_cards

results
result_exports
result_export_files
submission_packages

invoices
invoice_items
payments
refunds
payouts
payout_items

documents
document_extractions
document_verifications

notifications
messages

audit_logs
support_tickets


29. RECOMMENDED DATABASE RELATIONSHIPS

Organization:

organizations.id
  → shows.organization_id
  → people.organization_id
  → horses.organization_id
  → documents.organization_id


Show:

shows.id
  → show_affiliations.show_id
  → classes.show_id
  → entries.show_id
  → back_numbers.show_id
  → invoices.show_id
  → submission_packages.show_id


Entry:

entries.id
  → entry_classes.entry_id
  → entry_fees.entry_id
  → entry_documents.entry_id
  → scores.entry_id
  → results.entry_id


Class:

classes.id
  → class_affiliations.class_id
  → class_draws.class_id
  → scores.class_id
  → results.class_id


30. RLS / SECURITY MODEL

Every table should be tenant-protected by organization_id.

Basic rule:

A user can only access organization data if they are an active member of that organization.

Then permissions narrow what they can do.

Examples:

- A judge can only see classes assigned to them.
- A gate person can only see show-day order of go.
- A public user can only see published public data.
- An exhibitor can only see their own entries/invoices/documents.
- A show secretary can edit entries but not billing settings.
- A manager can publish results.
- A treasurer can view financials.


Sensitive data:

Protect:

- Birthdates
- Addresses
- Youth info
- Payment info
- Tax documents
- W-9s
- Health documents
- Membership documents

Use:

- Row Level Security
- File access policies
- Audit logs
- Role-based file access
- Signed URLs
- Encryption at rest
- Minimal public exposure


31. OFFLINE MODE

Critical show-day screens should work offline:

- Judge scoring
- Gate check-in
- Secretary quick score entry
- Announcer current class
- Draw/order of go
- Class list


Offline architecture:

Use PWA local database:

- IndexedDB
- Background sync
- Conflict resolution
- Local queue of changes


Offline conflict rules:

Example:

Judge score submitted offline
Secretary edits same score online
System detects conflict
Score verifier resolves
Both versions saved in audit log


Offline status indicator:

Online
Syncing
Offline — 12 changes pending
Sync failed — tap to retry


32. AI FEATURES

Do not make AI required for the system to function. Make AI helpful.

AI showbill builder:

Upload old PDF showbill.

AI extracts:

- Show name
- Dates
- Venue
- Classes
- Fees
- Judges
- Rules
- Deadlines

Human reviews and approves.


AI class code matcher:

User types:

Green Reiner Level 1

AI suggests:

NRHA Green Reiner Level 1 — Class Code XYZ
Confidence: 93%

Human confirms.


AI document reader:

Reads:

- Membership cards
- Coggins
- Health papers
- Horse registrations
- Leases
- Judge cards
- Entry forms

Extracts structured data.


AI validation assistant:

Example:

Why is Back #214 blocked?

Answer:
Back #214 is blocked because the horse has no NRHA competition license number and this class requires one. Either enter a license number or mark the horse as application pending if allowed by the rule package.


AI schedule optimizer:

Suggests class order based on:

- Conflicts
- Entry count
- Youth classes
- Drag breaks
- Judge availability
- Estimated time


AI announcer notes:

Generates clean announcements from sponsor data.


AI post-show summary:

Generates:

- Total entries
- Biggest classes
- Revenue
- Payout totals
- Missing items
- Export status
- Suggestions for next show


33. ADMIN RULE PACKAGE BUILDER

This is how you eventually support every affiliation.

Internal admin screen:

Rule Packages
  ├── NRHA 2026
  ├── APHA 2026
  ├── AQHA 2026
  ├── NSBA 2026
  └── Custom

For each rule package:

- Upload official source document
- Import class code CSV
- Define field requirements
- Define eligibility rules
- Define fee formulas
- Define payout formulas
- Define export schema
- Define validation messages
- Test with sample show
- Publish version


Rule package lifecycle:

Draft
  ↓
Internal Review
  ↓
Tested
  ↓
Published
  ↓
Deprecated
  ↓
Archived


Legal note:

For official association data, especially full class code lists, rulebooks, or membership integrations, the safest business path is to:

- Use public rules only where permitted
- Do not copy protected materials beyond allowed use
- Request permission/partnerships where needed
- Let associations provide/import official class code files
- Let show managers upload their official approval/class list
- Store source/version metadata
- Include disclaimers that users must verify official association requirements


34. ASSOCIATION INTEGRATION STRATEGY

Phase 1: Manual official-ready exports

Start by generating files the secretary uploads.

Example:

- NRHA ReinerSuite CSV
- PDF results
- ZIP package


Phase 2: Guided upload assistant

Show the secretary:

1. Log into ReinerSuite
2. Open Events
3. Select event
4. Import Results
5. Upload CSV
6. Upload/send documentation


Phase 3: API integration where available

Some associations may offer APIs or data exports.

The product should be architected so that if NRHA, APHA, AQHA, USEF, etc. provide API access, we can plug it in later.


35. SCREENS / PAGES TO BUILD

Public side:

/
Pricing
Features
Find Shows
Organization Public Page
Show Public Page
Enter Show
Results
Schedule
Support


App side:

/dashboard
/organizations
/organizations/:id
/organizations/:id/members
/organizations/:id/settings
/organizations/:id/shows

/shows/:id/dashboard
/shows/:id/setup
/shows/:id/affiliations
/shows/:id/classes
/shows/:id/schedule
/shows/:id/entries
/shows/:id/check-in
/shows/:id/back-numbers
/shows/:id/draws
/shows/:id/gate
/shows/:id/judging
/shows/:id/scores
/shows/:id/results
/shows/:id/financials
/shows/:id/documents
/shows/:id/reports
/shows/:id/exports
/shows/:id/audit
/shows/:id/settings


Exhibitor portal:

/exhibitor/dashboard
/exhibitor/profile
/exhibitor/horses
/exhibitor/people
/exhibitor/documents
/exhibitor/entries
/exhibitor/invoices
/exhibitor/messages


Admin portal:

/admin
/admin/organizations
/admin/users
/admin/rule-packages
/admin/associations
/admin/class-codes
/admin/export-schemas
/admin/support
/admin/system-logs


36. SHOW DASHBOARD LAYOUT

The show dashboard should show:

EPRHA Summer Slide

Today:
- 42 classes
- 311 entries
- 18 missing documents
- 9 unpaid balances
- 4 eligibility errors
- 2 classes pending verification
- 1 export warning

Current Arena:
- Class 12 running
- Back #214 in arena
- Class 13 estimated 2:10 PM

Submission Readiness:
NRHA: 82% ready
EPRHA Points: 100% ready


Dashboard cards:

- Entries
- Scratches
- Payments
- Missing docs
- Eligibility issues
- Classes running
- Results pending
- Export readiness
- Messages
- Staff activity


37. BUILD ROADMAP

Phase 0: Research and design

Goal:
Lock the product before coding.

Tasks:

- Interview 3–5 show secretaries
- Interview 2 show managers
- Interview 1 judge
- Interview 1 gate person
- Gather sample showbills
- Gather sample result packages
- Gather NRHA CSV examples
- Gather payout examples
- Gather class code lists
- Gather current workflow screenshots
- Confirm EPRHA’s actual show flow
- Define MVP

Deliverables:

- Product requirements document
- Database diagram
- Wireframes
- NRHA export spec
- Role/permission spec


Phase 1: Foundation

Goal:
Build the SaaS skeleton.

Features:

- Auth
- Organizations
- Organization members
- Roles/permissions
- Show creation
- Basic dashboard
- Basic settings
- Supabase RLS
- Storage buckets
- Audit log

Screens:

- Login
- Organization dashboard
- Create organization
- Invite member
- Role management
- Create show
- Show dashboard


Phase 2: Classes and show setup

Goal:
Create a usable show structure.

Features:

- Show setup wizard
- Venues/arenas
- Staff assignment
- Class list
- Class templates
- Class fees
- Class schedule
- Basic rule package table
- Basic NRHA class code support
- Import prior show

Screens:

- Show setup
- Classes
- Schedule
- Fees
- Staff


Phase 3: People, horses, entries

Goal:
Handle actual exhibitors.

Features:

- Person profiles
- Horse profiles
- Membership numbers
- Horse licenses
- Owner relationships
- Entry creation
- Entry class selection
- Back numbers
- Entry fees
- Entry validation
- Missing info warnings

Screens:

- People
- Horses
- Entries
- Entry detail
- Back numbers
- Check-in


Phase 4: Online entries and payments

Goal:
Allow exhibitors to enter online.

Features:

- Public show page
- Entry wizard
- Document upload
- Stripe checkout
- Invoice generation
- Payment tracking
- Confirmation emails
- Entry approval queue
- Add/scratch requests

Screens:

- Public show page
- Enter show
- Exhibitor dashboard
- Invoice
- Entry confirmation


Phase 5: Scoring and results

Goal:
Run a class.

Features:

- Draw/order of go
- Gate screen
- Judge scoring screen
- Secretary score entry
- Score verification
- Results calculation
- Tie handling
- Results posting
- Scorecard PDF

Screens:

- Draws
- Gate
- Judge tablet
- Scores
- Results
- Public results


Phase 6: NRHA export package

Goal:
Make the first serious differentiator.

Features:

- NRHA rule package v1
- NRHA CSV export
- NRHA validation
- NRHA submission checklist
- PDF results
- Tally sheet
- Summary sheet
- Score sheet bundle
- ZIP package
- Export audit log

Screens:

- Export Center
- NRHA validation
- NRHA package preview
- Download package


Phase 7: Documents and AI extraction

Goal:
Reduce secretary workload.

Features:

- Document upload
- OCR
- AI extraction
- Document verification
- Expiration tracking
- Missing document dashboard
- Attach docs to show/person/horse/entry
- Include docs in exports

Screens:

- Documents
- Document review
- Missing documents
- Submission documents


Phase 8: Advanced rule engine

Goal:
Expand beyond NRHA.

Features:

- Rule package admin builder
- Class code import
- Eligibility rule builder
- Fee formula builder
- Export schema builder
- Versioning
- Test harness

Associations to add next:

1. APHA
2. AQHA
3. NSBA
4. NRCHA
5. AHA
6. USEF/USHJA/USDF depending target market


Phase 9: Offline mode

Goal:
Make it reliable at showgrounds.

Features:

- Offline judge scoring
- Offline gate screen
- Offline class list
- Offline score queue
- Sync engine
- Conflict resolution
- Device authorization


Phase 10: Analytics and year-end points

Goal:
Make organizations stick with it.

Features:

- EPRHA year-end points
- Series points
- High point
- All-around
- Participation trends
- Revenue trends
- Class popularity
- Horse/rider history
- Sponsor ROI


38. MVP SCOPE I WOULD ACTUALLY BUILD FIRST

Do not try to build every association first.

Build the first version around:

EPRHA + NRHA-style reining shows

MVP must include:

- Login
- Organizations
- Roles/permissions
- Create show
- Add staff
- Add NRHA affiliation info
- Add classes
- Add exhibitors
- Add horses
- Add entries
- Assign back numbers
- Generate draw
- Enter scores
- Calculate placings
- Calculate money won
- Generate results
- Generate NRHA CSV
- Generate PDF results
- Generate submission checklist
- Audit log


MVP can delay:

- AI extraction
- Full offline mode
- Stripe
- Public live results
- Every association
- Advanced analytics
- SMS
- API integrations

Build the clean core first.


39. WHAT MAKES THIS SUPERIOR

To beat existing systems, the product needs to be better in these specific ways:

1. Modern web app

No install, no Windows dependency, no Access database, no local network setup.


2. Permissions built correctly

Managers, secretaries, judges, gate staff, announcers, treasurers, and exhibitors each see only what they need.


3. Association compliance first

Not generic exports. Official-ready packages.


4. Rule packages

Add/update associations without rewriting the app.


5. Live validation

Catch mistakes before the show ends.


6. Offline show-day mode

Judging/gate/scoring can continue when internet drops.


7. Clean public experience

QR code, live schedule, draws, results, rider/horse search.


8. Document intelligence

Membership cards, Coggins, health papers, score sheets, leases, and forms handled in one place.


9. Historical organization memory

EPRHA should never re-enter the same horse/rider/sponsor/show setup from scratch.


10. End-of-show export confidence

The secretary should see:

NRHA Submission: Ready
APHA Submission: 3 issues
EPRHA Points: Ready
Financial Reconciliation: Ready


40. RISKS / HARD PARTS

Association data access:

Some class codes/rules are public; some may require permission. The product should support manual upload and admin-managed rule packages until official partnerships/API access are available.


Eligibility complexity:

Eligibility can be very complex. Start with validations that are clearly known and expand over time.


Offline sync:

Offline is harder than normal web app work. Build it after core workflows are proven.


Payments/payouts:

Money logic needs extreme accuracy. Start simple and add complex payout formulas carefully.


Legal/compliance:

Avoid saying the system “guarantees” eligibility. Say:

Validation assistance based on configured rule package. Final responsibility remains with show management and the applicable association.


Support burden:

Horse shows happen on weekends. A real product needs support coverage during show hours.


41. RECOMMENDED TECHNICAL STACK

Since you already understand the Atlas stack, use a similar foundation:

Frontend:
- Next.js
- TypeScript
- Tailwind
- React Hook Form
- Zod validation

Backend:
- Next.js API routes or server actions
- Supabase Postgres
- Supabase Auth
- Supabase Storage
- Supabase Realtime
- Row Level Security

Payments:
- Stripe

Email:
- Resend or SendGrid

SMS:
- Twilio

AI:
- OpenAI API for OCR interpretation and assistant features
- Use normal OCR/document parsing where possible before AI

Offline:
- PWA
- IndexedDB
- Background sync queue

Exports:
- CSV generator
- PDF generator
- ZIP generator

Monitoring:
- Sentry
- PostHog
- Supabase logs


42. FIRST DATABASE TABLES TO BUILD

For Sprint 1, start with:

organizations
organization_members
roles
permissions
role_permissions
shows
show_staff
associations
show_affiliations
classes
people
horses
entries
entry_classes
back_numbers
scores
results
audit_logs
documents

Do not start with AI. Do not start with every association. Build the show core first.


43. FIRST 10 DEVELOPMENT SPRINTS

Sprint 1 — Foundation

- Auth
- App shell
- Organizations
- Organization members
- Basic permissions


Sprint 2 — Show creation

- Create show
- Show dashboard
- Show settings
- Staff assignment


Sprint 3 — Classes

- Add/edit/delete classes
- Class list
- Class detail
- Basic class fees
- Basic schedule order


Sprint 4 — People and horses

- Add rider
- Add owner
- Add trainer
- Add horse
- Add membership/license fields


Sprint 5 — Entries

- Create entry
- Select horse/rider
- Select classes
- Assign back number
- Entry list
- Entry detail


Sprint 6 — Check-in and validation

- Missing info flags
- Basic eligibility validation
- Check-in screen
- Missing paperwork/payment dashboard


Sprint 7 — Draws and gate

- Generate draw
- Manual reorder
- Gate screen
- Announcer screen


Sprint 8 — Scoring

- Score entry
- Judge-style screen
- Secretary score entry
- Score verification
- Audit score changes


Sprint 9 — Results

- Calculate placings
- Tie handling v1
- Publish results
- Public results page
- PDF class results


Sprint 10 — NRHA export v1

- NRHA fields
- CSV generation
- Export validation
- Submission checklist
- Download package


44. MASTER FEATURE LIST

Show setup:

- Organizations
- Shows
- Venues
- Arenas
- Staff
- Judges
- Secretaries
- Managers
- Affiliations
- Approval numbers
- Rule packages
- Class list
- Fees
- Schedule
- Patterns
- Showbill
- Deadlines


Entries:

- Online entries
- Office entries
- Horse profiles
- Rider profiles
- Owner profiles
- Trainer profiles
- Memberships
- Licenses
- Documents
- Back numbers
- Adds
- Scratches
- Check-in
- Balances


Show day:

- Draws
- Order of go
- Gate management
- Announcer view
- Judge scoring
- Secretary scoring
- Drag breaks
- Holds
- Scratches
- No-shows
- Live schedule
- Live results


Compliance:

- Class codes
- Eligibility
- Memberships
- Horse licenses
- Ownership
- Leases
- Required documents
- Judge credentials
- Approval deadlines
- Submission deadlines
- Export formats
- Submission packages
- Audit logs


Financial:

- Entry fees
- Office fees
- Stall fees
- Shavings
- Camping
- Association fees
- Medication fees
- Jackpot
- Added money
- Trophy costs
- Retainage
- Payments
- Refunds
- Payouts
- Financial reports


Results:

- Placings
- Scores
- Penalties
- Ties
- Money won
- Points
- High point
- All-around
- Year-end points
- PDF reports
- CSV exports
- Official packages


Public:

- Show page
- Online entry
- Schedule
- Draws
- Results
- QR code
- Text alerts
- Sponsor visibility


Admin:

- Rule packages
- Association class codes
- Export schemas
- User support
- Billing
- System logs
- Templates


45. BEST BUILD STRATEGY

Start narrow but architect big.

Do this:

Build for EPRHA / NRHA first.
Make the architecture generic enough for every affiliation.

Do not do this:

Try to support every association in version 1.

The winning path:

1. Build the core show system.
2. Build NRHA export perfectly.
3. Test it against a real EPRHA-style show.
4. Add APHA or AQHA next.
5. Add NSBA.
6. Add rule package builder.
7. Add AI and offline.
8. Sell to regional/local shows first.
9. Use real shows to refine the product.
10. Approach associations later with a working platform.


46. IMMEDIATE NEXT STEP

The next best move is to turn this into a Sprint 1 build plan for a new app, using the same file-by-file format used for Atlas:

- File path first
- Complete copy-and-paste code
- One file at a time
- Wait for “complete” before moving to the next file


END OF BLUEPRINT
