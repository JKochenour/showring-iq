# One-off operational scripts

SQL run by hand in the Supabase SQL editor, for jobs that are not schema
changes and so do not belong in `supabase/migrations/`.

## What must NOT live here

**Association class-code catalogs, and anything that reproduces one.**

NRHA's numeric class codes (and the equivalents for AQHA, APHA, USEF and
the rest) come from member-only handbooks and results software. They are
the associations' material. CLAUDE.md is explicit:

> Association data: use public rules where permitted, support manual
> upload of official class code lists and approvals, store source/version
> metadata, pursue partnerships later. **Do not copy protected
> association materials.**

That rules out two things:

1. **Seeding real codes into the product** — e.g. `STARTER_CLASSES` in
   `rule-packages/actions.ts`. That ships the catalog to every
   organization that clicks the starter button. Class NAMES and
   youth/amateur/open/non-pro flags are public taxonomy and fine; the
   numeric codes are seeded as clearly-marked `CONFIRM-` placeholders.
2. **Committing a code list to this repo**, even as an ops script, since
   the repo is the product.

An organization holding its own association's codes is a different
matter — that is their own material, entered through the sanctioned
path. So per-org artifacts that carry codes live **outside the repo**,
next to the source document they were transcribed from. For this
project's own org that is `Documents/NRHA/`:

- `nrha-class-codes.csv` — the approved-class list as an importable CSV,
  generated from the org's own `NRHA_Approved_Classes.pdf`. Load it via
  a rule package's **Import class codes** page, which matches on `code`
  so re-importing a revised list updates rather than duplicates.
- `nrha-eligibility-rules.sql` — the transcribed eligibility rules
  (youth/Prime Time/Masters/Legends ages, and owner-recorded checks for
  non-pro and youth classes). It scopes rules by explicit class code, so
  it carries codes and belongs out here.

## What may live here

Scripts that operate on an organization's data **without embedding
association codes** — they join or match instead.

- `link-fire-cracker-nrha-codes.sql` — links a circuit's classes to their
  rule-package codes by matching `classes.nrha_class_code` against
  `association_class_codes.code`. No code literals, so it is safe here.
