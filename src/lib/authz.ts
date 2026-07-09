import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Current authenticated user or redirect to /login. Server-side only. */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/**
 * Server-side permission check backed by the `has_org_permission` Postgres
 * function (RLS-safe, security definer). Never trust client role claims.
 */
export async function hasOrgPermission(
  organizationId: string,
  permission: string
): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("has_org_permission", {
    p_org: organizationId,
    p_permission: permission,
  });
  if (error) return false;
  return data === true;
}
