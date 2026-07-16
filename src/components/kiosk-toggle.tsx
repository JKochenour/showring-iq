"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";

/** "Tablet mode" for arena screens (gate, scoring): hides the app
 * chrome via html.kiosk (see globals.css) and goes fullscreen where
 * the browser allows it. State lives on the <html> element so it
 * survives router.refresh() from AutoRefresh; leaving fullscreen with
 * the system gesture (Esc / swipe) exits tablet mode too. */
export function KioskToggle() {
  const [active, setActive] = useState(false);

  // No initial sync needed: the kiosk class is set client-side only, so
  // a hard reload always starts clean, and router.refresh() preserves
  // this component's state.
  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        document.documentElement.classList.remove("kiosk");
        setActive(false);
      }
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  // Leaving the page (e.g. navigating back to the dashboard) shouldn't
  // strand the rest of the app chrome-less.
  useEffect(() => {
    return () => document.documentElement.classList.remove("kiosk");
  }, []);

  const toggle = async () => {
    const next = !active;
    document.documentElement.classList.toggle("kiosk", next);
    setActive(next);
    try {
      if (next && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else if (!next && document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // Fullscreen can be denied (iframe, iPad Safari quirks) — the
      // chrome-hiding class alone is still a big win, so ignore.
    }
  };

  return (
    <Button variant="secondary" className="kiosk-keep" onClick={toggle}>
      {active ? "Exit tablet mode" : "Tablet mode"}
    </Button>
  );
}
