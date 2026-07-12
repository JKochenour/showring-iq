"use client";

/**
 * Offline write queue — show-day offline mode v2.
 *
 * Wraps specific, replay-safe server actions (gate status changes, judge
 * score entry) so that when the venue connection drops, the write is
 * stored in IndexedDB instead of failing, then replayed in FIFO order the
 * moment connectivity returns. Deliberately NOT generic middleware: only
 * actions registered in offline-actions.ts can queue, because replaying a
 * write hours later must be safe for that specific action (status setters
 * and first-time score entry are; corrections and money actions are not
 * and stay online-only).
 *
 * Failure semantics on replay: a network failure stops the flush and
 * keeps the queue (still offline); a server-side rejection ({error} from
 * the action — permissions, validation, state conflicts) drops the item
 * into a visible "sync issues" list rather than retrying forever, since
 * retrying a rejected write will never succeed.
 */

import { OFFLINE_ACTIONS, type OfflineActionKey } from "@/lib/offline-actions";

export interface QueuedWrite {
  id?: number;
  actionKey: OfflineActionKey;
  args: unknown[];
  label: string;
  queuedAt: number;
}

export interface SyncFailure {
  label: string;
  error: string;
}

interface QueueSnapshot {
  pending: number;
  syncing: boolean;
  failures: SyncFailure[];
}

const DB_NAME = "showring-offline";
const STORE = "queue";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

// ---- reactive snapshot for useSyncExternalStore ----

let snapshot: QueueSnapshot = { pending: 0, syncing: false, failures: [] };
const listeners = new Set<() => void>();

function setSnapshot(patch: Partial<QueueSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((l) => l());
}

export function subscribeQueue(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) void refreshCount();
  return () => listeners.delete(listener);
}

export function getQueueSnapshot(): QueueSnapshot {
  return snapshot;
}

export function getServerQueueSnapshot(): QueueSnapshot {
  return EMPTY_SNAPSHOT;
}

const EMPTY_SNAPSHOT: QueueSnapshot = { pending: 0, syncing: false, failures: [] };

async function refreshCount(): Promise<void> {
  try {
    const count = await tx("readonly", (s) => s.count());
    if (count !== snapshot.pending) setSnapshot({ pending: count });
  } catch {
    // IndexedDB unavailable (private mode etc.) — queue simply disabled.
  }
}

export function dismissFailures(): void {
  setSnapshot({ failures: [] });
}

// ---- core API ----

export type RunOrQueueResult = { error?: string; queued?: boolean };

/** Runs the registered action now, or queues it when the device is
 * offline / the call dies on the network. */
export async function runOrQueue(
  actionKey: OfflineActionKey,
  args: unknown[],
  label: string
): Promise<RunOrQueueResult> {
  const action = OFFLINE_ACTIONS[actionKey] as (
    ...a: unknown[]
  ) => Promise<{ error?: string }>;

  if (navigator.onLine) {
    try {
      return await action(...args);
    } catch {
      // Server action transport failed mid-flight — treat as offline.
    }
  }

  try {
    await tx("readwrite", (s) =>
      s.add({ actionKey, args, label, queuedAt: Date.now() } satisfies QueuedWrite)
    );
    await refreshCount();
    return { queued: true };
  } catch {
    return { error: "Offline, and this device can't store queued changes." };
  }
}

let flushing = false;

/** Replays queued writes in FIFO order. Stops (keeping the queue) on
 * network failure; drops server-rejected items into the failures list. */
export async function flushQueue(): Promise<{ flushed: number }> {
  if (flushing || !navigator.onLine) return { flushed: 0 };
  flushing = true;
  setSnapshot({ syncing: true });
  let flushed = 0;
  const failures: SyncFailure[] = [...snapshot.failures];

  try {
    for (;;) {
      const items = await tx<QueuedWrite[]>("readonly", (s) => s.getAll());
      const item = items[0];
      if (!item) break;

      const action = OFFLINE_ACTIONS[item.actionKey] as
        | ((...a: unknown[]) => Promise<{ error?: string }>)
        | undefined;

      if (!action) {
        // Unknown key from an older app version — drop it visibly.
        failures.push({ label: item.label, error: "Unknown queued action." });
        await tx("readwrite", (s) => s.delete(item.id!));
        continue;
      }

      try {
        const result = await action(...item.args);
        if (result?.error) {
          failures.push({ label: item.label, error: result.error });
        } else {
          flushed++;
        }
        await tx("readwrite", (s) => s.delete(item.id!));
      } catch {
        // Still can't reach the server — stop, keep the queue intact.
        break;
      }
    }
  } finally {
    flushing = false;
    setSnapshot({ syncing: false, failures });
    await refreshCount();
  }
  return { flushed };
}
