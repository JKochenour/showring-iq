-- ============================================================
-- ShowRing IQ — Sprint 6: Check-in
-- Check-in state on entries, changed only via audited RPCs.
-- Checking in over blocking validation issues requires a reason
-- (recorded in the audit log as an override).
-- ============================================================

alter table public.entries
  add column checked_in_at timestamptz,
  add column checked_in_by uuid references auth.users (id);

-- checked_in_* are deliberately NOT in the authenticated update grant
-- from 00005 — they only change via the RPCs below.

create or replace function public.check_in_entry(
  p_entry uuid,
  p_override_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry record;
begin
  select * into v_entry from public.entries where id = p_entry;
  if v_entry is null then
    raise exception 'Entry not found';
  end if;
  if not public.has_org_permission(v_entry.organization_id, 'entry.check_in') then
    raise exception 'Missing permission: entry.check_in';
  end if;
  if v_entry.status = 'scratched' then
    raise exception 'Scratched entries cannot be checked in';
  end if;
  if v_entry.checked_in_at is not null then
    return;
  end if;

  update public.entries
  set checked_in_at = now(), checked_in_by = (select auth.uid())
  where id = p_entry;

  perform public.log_audit(v_entry.organization_id,
    case when p_override_reason is not null then 'entry.checked_in_with_override'
         else 'entry.checked_in' end,
    'entry', p_entry::text,
    null,
    jsonb_build_object('entry_number', v_entry.entry_number),
    p_override_reason);
end;
$$;

create or replace function public.undo_check_in(p_entry uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry record;
begin
  select * into v_entry from public.entries where id = p_entry;
  if v_entry is null then
    raise exception 'Entry not found';
  end if;
  if not public.has_org_permission(v_entry.organization_id, 'entry.check_in') then
    raise exception 'Missing permission: entry.check_in';
  end if;
  if v_entry.checked_in_at is null then
    return;
  end if;

  update public.entries
  set checked_in_at = null, checked_in_by = null
  where id = p_entry;

  perform public.log_audit(v_entry.organization_id, 'entry.check_in_undone', 'entry', p_entry::text,
    jsonb_build_object('entry_number', v_entry.entry_number, 'checked_in_at', v_entry.checked_in_at),
    null);
end;
$$;

revoke execute on function public.check_in_entry(uuid, text) from anon;
revoke execute on function public.undo_check_in(uuid) from anon;
