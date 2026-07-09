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
