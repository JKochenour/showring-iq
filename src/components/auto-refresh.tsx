"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Refreshes server-component data on an interval (gate/announcer screens). */
export function AutoRefresh({ seconds = 10 }: { seconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(timer);
  }, [router, seconds]);

  return null;
}
