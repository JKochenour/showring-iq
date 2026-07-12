"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  dismissFailures,
  flushQueue,
  getQueueSnapshot,
  getServerQueueSnapshot,
  subscribeQueue,
} from "@/lib/offline-queue";

function subscribeToConnectivity(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/** Registers the offline-mode service worker, shows a banner while the
 * device is offline (with the count of queued writes), flushes the write
 * queue on reconnect, and surfaces replay rejections. */
export function PwaSetup() {
  const router = useRouter();
  const offline = useSyncExternalStore(
    subscribeToConnectivity,
    () => !navigator.onLine,
    () => false
  );
  const queue = useSyncExternalStore(
    subscribeQueue,
    getQueueSnapshot,
    getServerQueueSnapshot
  );

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("Service worker registration failed:", err);
      });
    }
  }, []);

  // Replay queued writes whenever connectivity returns (and once on
  // mount, in case the app reloaded with a non-empty queue).
  useEffect(() => {
    if (offline) return;
    let cancelled = false;
    void flushQueue().then(({ flushed }) => {
      if (!cancelled && flushed > 0) router.refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [offline, router]);

  return (
    <>
      {offline && (
        <div className="fixed inset-x-0 top-0 z-50 bg-amber-600 px-4 py-2 text-center text-sm font-medium text-white">
          Offline — showing the last data loaded on this device.
          {queue.pending > 0
            ? ` ${queue.pending} change${queue.pending === 1 ? "" : "s"} saved on this device, syncing when the connection returns.`
            : " Gate and score changes will be saved on this device and synced later."}
        </div>
      )}
      {!offline && queue.syncing && queue.pending > 0 && (
        <div className="fixed inset-x-0 top-0 z-50 bg-brand-700 px-4 py-2 text-center text-sm font-medium text-white">
          Back online — syncing {queue.pending} queued change
          {queue.pending === 1 ? "" : "s"}…
        </div>
      )}
      {queue.failures.length > 0 && (
        <div className="fixed inset-x-0 top-0 z-50 bg-red-700 px-4 py-2 text-center text-sm font-medium text-white">
          {queue.failures.length} queued change
          {queue.failures.length === 1 ? " was" : "s were"} rejected on sync:{" "}
          {queue.failures.map((f) => `${f.label} (${f.error})`).join("; ")}
          <button
            className="ml-3 rounded bg-red-900 px-2 py-0.5 text-xs"
            onClick={dismissFailures}
          >
            Dismiss
          </button>
        </div>
      )}
    </>
  );
}
