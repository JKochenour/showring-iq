/**
 * Permission keys mirror the `organization_permissions` catalog seeded in
 * supabase/migrations/00001_foundation.sql. Business logic checks these —
 * never role names (roles are just presets of permissions).
 */
export const PERMISSIONS = {
  ORG_VIEW: "org.view",
  ORG_EDIT: "org.edit",
  ORG_BILLING_MANAGE: "org.billing.manage",
  ORG_MEMBERS_INVITE: "org.members.invite",
  ORG_MEMBERS_REMOVE: "org.members.remove",
  ORG_ROLES_MANAGE: "org.roles.manage",
  AUDIT_VIEW: "audit.view",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS] | string;
