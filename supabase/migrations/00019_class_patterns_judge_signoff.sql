-- ============================================================
-- ShowRing IQ — class patterns + judge digital sign-off
-- Closes two gaps in the Judge role per CLAUDE.md ("View assigned
-- classes + patterns, enter scores/penalties, sign digital cards,
-- submit for verification"):
--
-- 1. class_patterns: a place to record/view the pattern for a class
--    (text — numbered pattern steps — plus an optional reference to
--    an already-uploaded document, e.g. a scanned NRHA pattern
--    sheet). Office-only to write; broadly viewable like the rest of
--    show data (show.view), since both judges and staff need to see
--    it on the scoring screen.
--
-- 2. Digital sign-off on submit_score: a judge submitting their card
--    is legally attesting it's accurate. We record who (show_staff),
--    when, and a typed attestation name — a software judge card, not
--    a cryptographic signature. Distinct from the generic audit log
--    (which already records score.submitted) because this is meant
--    to be surfaced back to the judge/secretary as "signed by X at
--    HH:MM" on the card itself, not just in the audit trail.
-- ============================================================

-- ------------------------------------------------------------
-- class_patterns
-- One pattern per class. pattern_text holds the numbered pattern
-- (free text); document_id optionally points at an already-uploaded
-- document (public.documents — e.g. a scanned official pattern
-- sheet) attached to the same show. At least one of the two must be
-- present.
-- ------------------------------------------------------------

create table public.class_patterns (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null unique references public.classes (id) on delete cascade,
  show_id uuid not null references public.shows (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  pattern_text text,
  document_id uuid references public.documents (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_patterns_has_content
    check (pattern_text is not null or document_id is not null)
);

create index class_patterns_show_idx on public.class_patterns (show_id);

alter table public.class_patterns enable row level security;

create trigger class_patterns_set_updated_at
  before update on public.class_patterns
  for each row execute function public.set_updated_at();

-- Sync show_id/organization_id from the class, validate an attached
-- document belongs to the same show (or org, for org-level reference
-- material), and stamp updated_by.
create or replace function public.class_patterns_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class record;
  v_doc record;
begin
  select c.show_id, c.organization_id into v_class
  from public.classes c where c.id = new.class_id;
  if v_class is null then
    raise exception 'Class not found';
  end if;
  new.show_id := v_class.show_id;
  new.organization_id := v_class.organization_id;

  if new.document_id is not null then
    select d.organization_id, d.show_id into v_doc
    from public.documents d where d.id = new.document_id;
    if v_doc is null then
      raise exception 'Document not found';
    end if;
    if v_doc.organization_id <> new.organization_id then
      raise exception 'Document does not belong to this organization';
    end if;
    if v_doc.show_id is not null and v_doc.show_id <> new.show_id then
      raise exception 'Document is attached to a different show';
    end if;
  end if;

  new.updated_by := (select auth.uid());
  return new;
end;
$$;

create trigger class_patterns_before_insert
  before insert on public.class_patterns
  for each row execute function public.class_patterns_before_write();

create trigger class_patterns_before_update
  before update on public.class_patterns
  for each row execute function public.class_patterns_before_write();

-- ------------------------------------------------------------
-- RLS: broad read (show.view, same as classes) so judges can see
-- the pattern for their assigned classes; writes are office-only
-- (class.edit) on an editable show, matching class_judges.
-- ------------------------------------------------------------

create policy "class_patterns_select_permitted" on public.class_patterns
  for select to authenticated
  using (public.has_org_permission(organization_id, 'show.view'));

create policy "class_patterns_insert_permitted" on public.class_patterns
  for insert to authenticated
  with check (
    public.has_org_permission(organization_id, 'class.edit')
    and public.show_is_editable(show_id)
  );

create policy "class_patterns_update_permitted" on public.class_patterns
  for update to authenticated
  using (
    public.has_org_permission(organization_id, 'class.edit')
    and public.show_is_editable(show_id)
  )
  with check (
    public.has_org_permission(organization_id, 'class.edit')
    and public.show_is_editable(show_id)
  );

create policy "class_patterns_delete_permitted" on public.class_patterns
  for delete to authenticated
  using (
    public.has_org_permission(organization_id, 'class.edit')
    and public.show_is_editable(show_id)
  );

revoke insert, update, delete on public.class_patterns from anon;

-- ------------------------------------------------------------
-- Digital sign-off on scores. Additive columns; nullable so existing
-- rows (and any caller that doesn't pass a signature) are unaffected.
-- signed_by_staff_id is the judge's show_staff row (mirrors
-- scores.judge_staff_id); signature_name is the typed attestation
-- ("I certify this card is accurate" — typed full name, not a
-- cryptographic signature); signed_at is the moment of submission.
-- ------------------------------------------------------------

alter table public.scores
  add column signature_name text,
  add column signed_by_staff_id uuid references public.show_staff (id) on delete set null,
  add column signed_at timestamptz;

-- ------------------------------------------------------------
-- Tighten submit_score: require a typed signature (the judge's
-- attestation) and record it alongside the existing submitted_at/
-- submitted_by fields. Signature name defaults to the judge on
-- record if not supplied (keeps direct-RPC callers/tests working),
-- but the app-level server action always passes one so the UI can
-- require it. Everything else (permission + assignment checks) is
-- unchanged from 00016_class_judges.sql.
-- ------------------------------------------------------------

-- Changing the parameter list creates a new overload rather than
-- replacing the existing function; drop the old one-arg signature
-- first so calls with a single argument aren't ambiguous.
drop function if exists public.submit_score(uuid);

create or replace function public.submit_score(
  p_entry_class uuid,
  p_signature_name text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_score record;
  v_signature text;
begin
  select * into v_score from public.scores where entry_class_id = p_entry_class;
  if v_score is null then
    raise exception 'No score entered yet';
  end if;
  if not public.has_org_permission(v_score.organization_id, 'score.enter') then
    raise exception 'Missing permission: score.enter';
  end if;
  if not public.has_org_permission(v_score.organization_id, 'score.edit_unofficial')
     and public.assigned_judge_staff_id(v_score.class_id) is null then
    raise exception 'You are not assigned as judge for this class';
  end if;
  if v_score.status <> 'pending' then
    return;
  end if;

  v_signature := nullif(btrim(coalesce(p_signature_name, '')), '');
  if v_signature is null then
    select display_name into v_signature from public.show_staff where id = v_score.judge_staff_id;
  end if;
  if v_signature is null then
    raise exception 'A signature (typed name) is required to submit a score card';
  end if;

  update public.scores
  set status = 'submitted', submitted_at = now(), submitted_by = (select auth.uid()),
      signature_name = v_signature, signed_by_staff_id = v_score.judge_staff_id, signed_at = now()
  where entry_class_id = p_entry_class;

  perform public.log_audit(v_score.organization_id, 'score.submitted', 'score', v_score.id::text,
    jsonb_build_object('status', 'pending'),
    jsonb_build_object('status', 'submitted', 'total_score_tenths', v_score.total_score_tenths,
                       'result_status', v_score.result_status));

  perform public.log_audit(v_score.organization_id, 'score.signed', 'score', v_score.id::text,
    null,
    jsonb_build_object('signature_name', v_signature, 'signed_by_staff_id', v_score.judge_staff_id));
end;
$$;

-- reopen_score clears a stale signature when a submitted card is sent
-- back to pending, since the judge will need to re-sign on resubmit.
create or replace function public.reopen_score(p_entry_class uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_score record;
  v_new_status text;
  v_permission text;
begin
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required to reopen a score';
  end if;

  select * into v_score from public.scores where entry_class_id = p_entry_class;
  if v_score is null then
    raise exception 'No score entered yet';
  end if;

  if v_score.status = 'verified' then
    v_new_status := 'submitted'; v_permission := 'score.verify';
  elsif v_score.status = 'submitted' then
    v_new_status := 'pending'; v_permission := 'score.enter';
  else
    return;
  end if;

  if not public.has_org_permission(v_score.organization_id, v_permission) then
    raise exception 'Missing permission: %', v_permission;
  end if;
  if v_permission = 'score.enter'
     and not public.has_org_permission(v_score.organization_id, 'score.edit_unofficial')
     and public.assigned_judge_staff_id(v_score.class_id) is null then
    raise exception 'You are not assigned as judge for this class';
  end if;

  update public.scores set
    status = v_new_status,
    signature_name = case when v_new_status = 'pending' then null else signature_name end,
    signed_by_staff_id = case when v_new_status = 'pending' then null else signed_by_staff_id end,
    signed_at = case when v_new_status = 'pending' then null else signed_at end
  where entry_class_id = p_entry_class;

  perform public.log_audit(v_score.organization_id, 'score.reopened', 'score', v_score.id::text,
    jsonb_build_object('status', v_score.status),
    jsonb_build_object('status', v_new_status),
    p_reason);
end;
$$;

revoke execute on function public.submit_score(uuid, text) from anon;
