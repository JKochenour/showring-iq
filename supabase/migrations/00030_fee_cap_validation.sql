-- ============================================================
-- ShowRing IQ — Fee-cap validation warnings
-- Show Rules H/I/J/K/L (Ancillary/Aged/Jackpot Affiliate/Entry Level
-- Ride & Slide/Green Level fee-cap tables). Per CLAUDE.md principle
-- #2 ("association rules are DATA, not code"), the actual $ caps are
-- NOT hardcoded — they're optional fields on association_class_codes
-- that an org fills in when setting up a rule package class code
-- (e.g. "Limited Open — max $500 added money, max entry fee 10% of
-- added money or $50 jackpot"). The app only supplies the generic
-- comparison mechanism and a soft warning (not a block) when a
-- class's configured fee exceeds its linked code's caps — show
-- management retains final judgment, matching the standing
-- disclaimer used everywhere else in this app.
--
-- Entry fee caps come in two shapes seen across the Handbook:
-- a flat dollar cap (e.g. Green Level: $30 flat), or a percent-of-
-- added-money cap with a separate flat cap for jackpot classes (e.g.
-- Limited Open: 10% of added money, or $50 if run as a jackpot with
-- no added money). Both are optional/nullable so a code can use
-- whichever shape applies, or none at all.
-- ============================================================

alter table public.association_class_codes
  add column max_added_money_cents integer
    check (max_added_money_cents is null or max_added_money_cents >= 0),
  add column max_entry_fee_cents integer
    check (max_entry_fee_cents is null or max_entry_fee_cents >= 0),
  add column max_entry_fee_percent_of_added_money numeric
    check (max_entry_fee_percent_of_added_money is null or max_entry_fee_percent_of_added_money >= 0),
  add column max_entry_fee_jackpot_cents integer
    check (max_entry_fee_jackpot_cents is null or max_entry_fee_jackpot_cents >= 0);
