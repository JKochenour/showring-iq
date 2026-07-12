"use client";

/**
 * The allowlist of server actions the offline queue may store and replay.
 * Only add an action here after deciding a delayed replay is safe:
 * - setRunStatus: sets gate state absolutely (not incrementally) and is
 *   the flow that must survive arena Wi-Fi dropouts.
 * - enterScore: first-time score entry by judge/secretary; the scoring
 *   flow's verification step still gates anything official.
 * Corrections, money actions, and publishing stay online-only on purpose.
 */

import { setRunStatus } from "@/app/(app)/shows/[id]/draws/actions";
import { enterScore } from "@/app/(app)/shows/[id]/scoring/actions";

export const OFFLINE_ACTIONS = {
  setRunStatus,
  enterScore,
} as const;

export type OfflineActionKey = keyof typeof OFFLINE_ACTIONS;
