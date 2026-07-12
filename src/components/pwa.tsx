"use client";

import { useEffect, useSyncExternalStore } from "react";

function subscribeToConnectivity(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/** Registers the offline-mode service worker and shows a banner while the
 * device is offline. Read-only offline: visited pages stay viewable from
 * cache; writes fail visibly until connectivity returns. */
export function PwaSetup() {
  const offline = useSyncExternalStore(
    subscribeToConnectivity,
    () => !navigator.onLine,
    () => false
  );

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("Service worker registration failed:", err);
      });
    }
  }, []);

  if (!offline) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-50 bg-amber-600 px-4 py-2 text-center text-sm font-medium text-white">
      Offline — showing the last data loaded on this device. Score entry and
      other changes won&apos;t save until the connection returns.
    </div>
  );
}
