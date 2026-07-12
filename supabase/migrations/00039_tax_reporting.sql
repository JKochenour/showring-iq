-- ============================================================
-- ShowRing IQ — 1099 / payout tax reporting
--
-- Shows that pay out purse money need W-9 collection and a year-end
-- payout total per payee to prepare 1099-NEC forms. This is a
-- REPORTING aid, not a filer — it never generates or e-files a 1099.
--
-- Deliberately does NOT store a raw SSN/EIN, or even an on-file flag,
-- in a plain column. Per CLAUDE.md ("Sensitive data... W-9s... RLS +
-- file access policies + signed URLs"), the actual tax ID lives inside
-- an uploaded W-9 PDF using the existing documents table + storage
-- RLS/signed-URL infrastructure (00013) — 'w9' is added to that
-- table's document_type list below. "W-9 on file" is derived live at
-- report time from whether a verified w9 document exists for the
-- person, so there's no separate flag that can drift out of sync with
-- the actual upload. This migration only adds a legal name for 1099
-- purposes, since it commonly differs from the display name (e.g. an
-- LLC/business name for an EIN-based payee).

alter table public.people
  add column tax_name text check (char_length(tax_name) <= 160);

comment on column public.people.tax_name is
  'Legal name for 1099 purposes, if different from the display name '
  '(e.g. an LLC/business name). Optional — falls back to first/last name.';

-- 'w9' joins the existing fixed document_type list (00013).
alter table public.documents
  drop constraint documents_document_type_check;
alter table public.documents
  add constraint documents_document_type_check check (document_type in (
    'membership_card', 'competition_license', 'coggins', 'health_certificate',
    'non_pro_declaration', 'ownership_transfer', 'show_card', 'w9', 'other'
  ));
