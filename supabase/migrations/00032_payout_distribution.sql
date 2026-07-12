-- 00032: Payout distribution deadline tracking (NRHA Show Rules P(5))
--
-- Payouts must reach the recorded rider/agent/owner/responsible party
-- within thirty (30) days following completion of the event. We track a
-- single show-level "distributed" timestamp; the deadline itself
-- (end_date + 30 days) is computed in the app. Soft tracking only — the
-- app reminds, it never blocks.
--
-- Marking distribution is a payout.approve action and must work on a
-- locked show (distribution happens after the show closes), so it goes
-- through a security-definer RPC instead of a column grant — the shows
-- UPDATE policy only allows draft/published rows.

alter table public.shows
  add column payouts_distributed_at timestamptz;

comment on column public.shows.payouts_distributed_at is
  'When show management marked all purse money as distributed (Show Rules '
  'P(5): due within 30 days of event completion). Null = not yet marked.';

create or replace function public.mark_payouts_distributed(
  p_show uuid,
  p_distributed boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_show record;
begin
  select * into v_show from public.shows where id = p_show;
  if v_show is null then
    raise exception 'Show not found';
  end if;
  if not public.has_org_permission(v_show.organization_id, 'payout.approve') then
    raise exception 'Missing permission: payout.approve';
  end if;

  update public.shows
  set payouts_distributed_at = case when p_distributed then now() else null end
  where id = p_show;

  perform public.log_audit(
    v_show.organization_id,
    case when p_distributed
      then 'payout.distribution_marked'
      else 'payout.distribution_unmarked'
    end,
    'show',
    p_show::text,
    jsonb_build_object('payouts_distributed_at', v_show.payouts_distributed_at),
    jsonb_build_object(
      'payouts_distributed_at',
      case when p_distributed then now() else null end
    ),
    null,
    p_show
  );
end;
$$;

revoke execute on function public.mark_payouts_distributed(uuid, boolean) from anon;
