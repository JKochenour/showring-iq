export interface Organization {
  id: string;
  name: string;
  slug: string;
  contact_email: string | null;
  website: string | null;
  city: string | null;
  state: string | null;
  logo_url: string | null;
  created_at: string;
}

export interface OrganizationRole {
  id: string;
  organization_id: string;
  key: string;
  name: string;
  description: string | null;
  is_system: boolean;
}

export interface MemberRow {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
  role: Pick<OrganizationRole, "id" | "key" | "name"> | null;
  profile: { email: string; full_name: string | null } | null;
}

export interface InviteRow {
  id: string;
  email: string;
  status: string;
  created_at: string;
  role: Pick<OrganizationRole, "id" | "name"> | null;
}

export interface PendingInvite {
  invite_id: string;
  organization_name: string;
  role_name: string;
  invited_by_email: string | null;
  created_at: string;
}

export type ShowStatus = "draft" | "published" | "locked" | "archived";

export interface Show {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  status: ShowStatus;
  start_date: string;
  end_date: string;
  timezone: string;
  venue_name: string | null;
  city: string | null;
  state: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  description: string | null;
  nrha_show_number: string | null;
  medication_fee_cents: number;
  standard_entry_charges: {
    label: string;
    amount_cents: number;
    per_run?: boolean;
    youth_exempt?: boolean;
  }[];
  schedule_start_time: string;
  schedule_break_minutes: number;
  schedule_drag_minutes: number;
  event_classification: "D" | "C" | "B" | "BB" | "A" | "AA" | null;
  payouts_distributed_at: string | null;
  late_entry_fee_cents: number;
  close_out_fee_cents: number;
  close_out_deadline: string | null;
  card_surcharge_percent: number;
  reservation_types: {
    key: string;
    label: string;
    unitPriceCents: number;
    slotOptions: string[];
  }[];
  weekend_id: string | null;
  created_at: string;
}

export interface ShowWeekend {
  id: string;
  organization_id: string;
  name: string;
  created_at: string;
}

export interface Reservation {
  id: string;
  show_id: string;
  organization_id: string;
  person_id: string;
  type_key: string;
  label: string;
  quantity: number;
  unit_price_cents: number;
  slot_label: string | null;
  status: "requested" | "confirmed" | "cancelled";
  charge_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface ShowStaffRow {
  id: string;
  show_id: string;
  user_id: string | null;
  display_name: string;
  staff_role: string;
  notes: string | null;
  created_at: string;
  profile: { email: string; full_name: string | null } | null;
}

export interface ClassJudgeRow {
  id: string;
  class_id: string;
  show_staff_id: string;
  assigned_at: string;
  show_staff: Pick<ShowStaffRow, "id" | "display_name" | "user_id"> | null;
}

export interface ClassAffiliationRow {
  id: string;
  class_id: string;
  association_class_code_id: string;
  counts_for_money: boolean;
  counts_for_points: boolean;
  counts_for_year_end: boolean;
  is_primary: boolean;
  code: {
    code: string;
    name: string;
    rule_package: {
      year: number;
      version: string;
      association: { name: string } | null;
    } | null;
  } | null;
}

export type ClassStatus =
  | "draft"
  | "open"
  | "entry_closed"
  | "draw_posted"
  | "in_progress"
  | "scoring"
  | "pending_verification"
  | "official"
  | "results_posted"
  | "exported"
  | "archived"
  | "cancelled";

export interface ShowClass {
  id: string;
  show_id: string;
  organization_id: string;
  class_number: number;
  display_order: number;
  name: string;
  discipline: string | null;
  division: string | null;
  pattern_number: number | null;
  go_type: string;
  go_number: number;
  entry_fee_cents: number;
  added_money_cents: number;
  judge_fee_cents: number;
  status: ClassStatus;
  scheduled_date: string | null;
  drag_every_n: number | null;
  avg_run_minutes: number;
  is_youth: boolean;
  is_single_purse: boolean;
  concurrent_group_id: string | null;
  nrha_class_code: string | null;
  class_code_id: string | null;
  retainage_percent: number;
  payout_schedule: PayoutScheduleEntry[];
  notes: string | null;
  created_at: string;
}

export interface PayoutScheduleEntry {
  placing: number;
  percent: number;
}

export interface Association {
  id: string;
  organization_id: string;
  name: string;
  created_at: string;
}

export type RulePackageStatus =
  | "draft"
  | "review"
  | "tested"
  | "published"
  | "deprecated"
  | "archived";

export interface RulePackage {
  id: string;
  association_id: string;
  year: number;
  version: string;
  status: RulePackageStatus;
  source_notes: string | null;
  points_schedule: { placing: number; points: number }[];
  created_at: string;
}

export interface AssociationClassCode {
  id: string;
  rule_package_id: string;
  code: string;
  name: string;
  discipline: string | null;
  division: string | null;
  is_youth: boolean;
  is_amateur: boolean;
  is_open: boolean;
  is_non_pro: boolean;
  counts_for_points: boolean;
  counts_for_money: boolean;
  active: boolean;
  max_added_money_cents: number | null;
  max_entry_fee_cents: number | null;
  max_entry_fee_percent_of_added_money: number | null;
  max_entry_fee_jackpot_cents: number | null;
}

export interface AssociationEligibilityRule {
  id: string;
  rule_package_id: string;
  rule_key: string;
  applies_to: string[];
  conditions: { field: string; operator: string; value: string }[];
  severity: "info" | "warning" | "blocking" | "critical";
  message: string;
}

export interface Person {
  id: string;
  organization_id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  birthdate: string | null;
  roles: string[];
  notes: string | null;
  tax_name: string | null;
  created_at: string;
  user_id: string | null;
}

export interface PersonMembership {
  id: string;
  person_id: string;
  association: string;
  membership_number: string;
  membership_type: string | null;
  status: string;
  expiration_date: string | null;
  verified_at: string | null;
  notes: string | null;
}

export interface Horse {
  id: string;
  organization_id: string;
  registered_name: string;
  barn_name: string | null;
  breed: string | null;
  sex: string | null;
  color: string | null;
  foal_year: number | null;
  sire: string | null;
  dam: string | null;
  notes: string | null;
  created_at: string;
}

export interface HorseRegistration {
  id: string;
  horse_id: string;
  association: string;
  registration_number: string | null;
  competition_license_number: string | null;
  status: string;
  expiration_date: string | null;
  verified_at: string | null;
  notes: string | null;
}

export interface HorseOwnership {
  id: string;
  horse_id: string;
  owner_person_id: string;
  percentage: number;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  owner: Pick<Person, "id" | "first_name" | "last_name"> | null;
}

export interface Entry {
  id: string;
  show_id: string;
  organization_id: string;
  entry_number: number;
  rider_person_id: string;
  horse_id: string;
  owner_person_id: string | null;
  trainer_person_id: string | null;
  rider_name: string;
  horse_name: string;
  owner_name: string | null;
  trainer_name: string | null;
  bill_to_trainer: boolean;
  /** Party to receive winning checks; null = default (owner → rider). */
  payee_person_id: string | null;
  payee_name: string | null;
  status: "active" | "scratched";
  notes: string | null;
  checked_in_at: string | null;
  created_at: string;
}

export interface EntryClassRow {
  id: string;
  entry_id: string;
  class_id: string;
  status: "entered" | "scratched";
  fee_cents: number;
  scratch_reason: string | null;
  class: Pick<ShowClass, "id" | "class_number" | "name" | "status"> | null;
}

export interface BackNumberRow {
  id: string;
  show_id: string;
  number: number;
  entry_id: string;
}

export type ResultStatus = "shown" | "zero" | "no_score" | "dq" | "excused";
export type ScoreStatus = "pending" | "submitted" | "verified";

export interface Score {
  id: string;
  entry_class_id: string;
  class_id: string;
  judge_staff_id: string | null;
  judge_name: string | null;
  result_status: ResultStatus;
  total_score_tenths: number | null;
  penalty_points_tenths: number;
  notes: string | null;
  status: ScoreStatus;
  submitted_at: string | null;
  verified_at: string | null;
  signature_name: string | null;
  signed_by_staff_id: string | null;
  signed_at: string | null;
}

export interface ClassPatternRow {
  id: string;
  class_id: string;
  pattern_text: string | null;
  pattern_key: string | null;
  document_id: string | null;
  updated_at: string;
}

export interface Result {
  id: string;
  entry_class_id: string;
  class_id: string;
  placing: number | null;
  tie_status: "none" | "tied";
  tie_resolution: "co_champions" | "run_off_completed" | null;
  tie_resolution_note: string | null;
  champion_level: 1 | 2 | 3 | 4 | null;
  money_won_cents: number;
  manual_override: boolean;
}

export type DocumentType =
  | "membership_card"
  | "competition_license"
  | "coggins"
  | "health_certificate"
  | "non_pro_declaration"
  | "ownership_transfer"
  | "show_card"
  | "other";

export type DocumentStatus = "pending" | "verified" | "rejected";

export interface DocumentRow {
  id: string;
  organization_id: string;
  person_id: string | null;
  horse_id: string | null;
  show_id: string | null;
  document_type: DocumentType;
  file_path: string;
  file_name: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  expiration_date: string | null;
  status: DocumentStatus;
  rejection_reason: string | null;
  verified_by: string | null;
  verified_at: string | null;
  uploaded_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface AuditLogRow {
  id: number;
  actor_role: string | null;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  reason: string | null;
  created_at: string;
  actor: { email: string; full_name: string | null } | null;
}
