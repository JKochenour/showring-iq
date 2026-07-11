import type { SupabaseClient } from "@supabase/supabase-js";

export interface PublicShow {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  timezone: string;
  venue_name: string | null;
  city: string | null;
  state: string | null;
  description: string | null;
  organization_name: string;
  organization_slug: string;
}

export interface PublicClass {
  id: string;
  class_number: number;
  name: string;
  display_order: number;
  status: string;
}

export interface PublicDrawRow {
  position: number;
  run_status: string;
  entry_class_status: "entered" | "scratched";
  rider_name: string;
  horse_name: string;
  back_number: number | null;
}

export interface PublicScoreRow {
  back_number: number | null;
  rider_name: string;
  horse_name: string;
  result_status: string;
  total_score_tenths: number | null;
  penalty_points_tenths: number;
  signed_at: string;
}

export interface PublicResultRow {
  placing: number | null;
  tie_status: string;
  back_number: number | null;
  rider_name: string;
  horse_name: string;
  total_score_tenths: number | null;
  money_won_cents: number;
}

/** Published-show gate is enforced inside each RPC; returns null if not found/published. */
export async function loadPublicShow(
  supabase: SupabaseClient,
  orgSlug: string,
  showSlug: string
): Promise<PublicShow | null> {
  const { data } = await supabase
    .rpc("public_show", { p_org_slug: orgSlug, p_show_slug: showSlug })
    .maybeSingle();
  return (data as PublicShow) ?? null;
}

export async function loadPublicClasses(
  supabase: SupabaseClient,
  showId: string
): Promise<PublicClass[]> {
  const { data } = await supabase.rpc("public_show_classes", { p_show: showId });
  return (data as PublicClass[]) ?? [];
}

export async function loadPublicClassDraw(
  supabase: SupabaseClient,
  showId: string,
  classId: string
): Promise<PublicDrawRow[]> {
  const { data } = await supabase.rpc("public_class_draw", {
    p_show: showId,
    p_class: classId,
  });
  return (data as PublicDrawRow[]) ?? [];
}

export async function loadPublicClassScores(
  supabase: SupabaseClient,
  showId: string,
  classId: string
): Promise<PublicScoreRow[]> {
  const { data } = await supabase.rpc("public_class_scores", {
    p_show: showId,
    p_class: classId,
  });
  return (data as PublicScoreRow[]) ?? [];
}

export async function loadPublicClassResults(
  supabase: SupabaseClient,
  showId: string,
  classId: string
): Promise<PublicResultRow[]> {
  const { data } = await supabase.rpc("public_class_results", {
    p_show: showId,
    p_class: classId,
  });
  return (data as PublicResultRow[]) ?? [];
}

/** Collapses the 12 internal class statuses to what the public page shows. */
export function publicClassStage(
  status: string
): "not_started" | "running" | "results_posted" | "cancelled" {
  if (status === "cancelled") return "cancelled";
  if (status === "results_posted" || status === "exported") return "results_posted";
  if (["draft", "open", "entry_closed"].includes(status)) return "not_started";
  return "running";
}
