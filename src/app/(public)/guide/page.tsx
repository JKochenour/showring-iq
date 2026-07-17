import type { Metadata } from "next";
import Link from "next/link";
import { GuideWalkthrough } from "./guide-walkthrough";

export const metadata: Metadata = {
  title: "Guide — Run a show start to finish · ShowRing IQ",
  description:
    "A step-by-step walkthrough of setting up and running a horse show in ShowRing IQ, from creating your organization to the final NRHA submission package.",
};

export default function GuidePage() {
  return (
    <div className="space-y-10">
      {/* ---------------------------------------------------------- header */}
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-brand-600 dark:text-brand-400">
          Guide
        </p>
        <h1 className="font-grotesk mt-2 text-3xl font-semibold tracking-tight text-stone-900 dark:text-stone-50 sm:text-4xl">
          Run a show, start to finish
        </h1>
        <p className="mt-3 max-w-2xl leading-relaxed text-stone-600 dark:text-stone-300">
          Eleven steps take you from an empty account to a validated association
          submission package. Click through each stage to see what the screen
          looks like and exactly where to go.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/signup"
            className="rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-800"
          >
            Create your organization
          </Link>
          <Link
            href="/help"
            className="rounded-lg border border-stone-300 px-5 py-2.5 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-50 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800"
          >
            Help &amp; FAQ
          </Link>
        </div>
      </header>

      {/* ------------------------------------------------- overview video */}
      <VideoTeaser />

      {/* ------------------------------------------------------ walkthrough */}
      <GuideWalkthrough />

      {/* ------------------------------------------------------------- note */}
      <p className="border-t border-stone-200 pt-6 text-xs leading-relaxed text-stone-400 dark:border-stone-800">
        Screens above are illustrative representations of the interface, shown
        with sample data. Validation assistance is based on the configured rule
        package; final responsibility remains with show management and the
        applicable association.
      </p>
    </div>
  );
}

/**
 * Marketing overview video slot. Drops in an mp4 at /public/guide-overview.mp4
 * when present; until then it renders a styled placeholder so the layout is
 * stable. Kept as its own component so wiring a real file is a one-line change.
 */
const VIDEO_SRC = "/guide-overview.mp4";
const VIDEO_POSTER = "/guide-overview-poster.jpg";
const VIDEO_AVAILABLE = false; // flip to true once the file is added to /public

function VideoTeaser() {
  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-stone-950 dark:border-stone-800">
      <div className="relative aspect-video">
        {VIDEO_AVAILABLE ? (
          <video
            className="h-full w-full object-cover"
            src={VIDEO_SRC}
            poster={VIDEO_POSTER}
            controls
            playsInline
            preload="metadata"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(67,167,156,0.18),transparent_65%)] text-center">
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-brand-400">
              Overview
            </span>
            <p className="font-grotesk mt-2 max-w-md px-6 text-xl font-semibold text-stone-100 sm:text-2xl">
              The whole weekend, in ninety seconds
            </p>
            <p className="mt-2 text-sm text-stone-400">Video coming soon</p>
          </div>
        )}
      </div>
    </div>
  );
}
