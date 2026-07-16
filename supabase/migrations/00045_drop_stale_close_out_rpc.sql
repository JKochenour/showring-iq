-- ============================================================
-- ShowRing IQ — retire apply_close_out_fee (00036)
--
-- The RPC computed each person's balance from MATERIALIZED rows only:
-- entry_class fees + misc_charges − payments. Since 00042 the
-- judge/video/photo run fees are computed live in the app
-- (src/lib/billing.ts computeEntryRunFees) and never materialized, so
-- the SQL balance under-counts what people owe and can miss debtors
-- entirely (someone who owes only run fees looks settled here).
--
-- Debtor detection now lives app-side in the applyCloseOutFee server
-- action, driven by the exact billing roster staff see on the
-- Financials page, charging each debtor through add_misc_charge
-- (invoice.edit gated, audit-logged, idempotent via the
-- 'Close-out fee' category check). Dropping the function keeps a
-- wrong-money-math code path from being callable.
-- ============================================================

drop function if exists public.apply_close_out_fee(uuid);
