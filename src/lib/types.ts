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
  status: ClassStatus;
  scheduled_date: string | null;
  notes: string | null;
  created_at: string;
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
  created_at: string;
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
