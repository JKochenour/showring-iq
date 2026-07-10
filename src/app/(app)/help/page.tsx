import { PageHeader, Card } from "@/components/ui";

export const metadata = { title: "Help & Support — ShowRing IQ" };

/**
 * Add real videos by filling in `youtubeId` (the part after "v=" in a
 * YouTube URL, or the id from an unlisted/private link). Entries left
 * with youtubeId: null render as "Coming soon" placeholders.
 */
interface TutorialVideo {
  title: string;
  description: string;
  minutes: number;
  youtubeId: string | null;
}

const TUTORIALS: TutorialVideo[] = [
  {
    title: "Setting up your organization",
    description: "Create your organization, invite staff, and set roles.",
    minutes: 4,
    youtubeId: null,
  },
  {
    title: "Creating a show and adding classes",
    description: "Show setup, staff assignment, and building the class list with NRHA codes.",
    minutes: 6,
    youtubeId: null,
  },
  {
    title: "Adding people, horses, and entries",
    description: "Riders, owners, horses, membership numbers, and creating entries with back numbers.",
    minutes: 7,
    youtubeId: null,
  },
  {
    title: "Check-in, draws, and the gate screen",
    description: "Resolving validation issues, generating a draw, and running the gate.",
    minutes: 5,
    youtubeId: null,
  },
  {
    title: "Scoring, results, and NRHA export",
    description: "Entering and verifying scores, calculating placings, and downloading the submission package.",
    minutes: 8,
    youtubeId: null,
  },
];

const ROLE_GUIDES = [
  {
    role: "Organization Owner",
    steps: [
      "Organizations → Members to invite staff and assign roles.",
      "Organizations → Rule Packages to start building association-specific class codes (optional, advanced).",
      "Create your first show from Organizations → Shows → New show.",
    ],
  },
  {
    role: "Show Manager / Secretary",
    steps: [
      "Show → Staff to assign judges, gate, announcer, and treasurer.",
      "Show → Classes to build the class list — set the NRHA class code, pattern number, and fees on each.",
      "Show → Entries → New entry to enter riders/horses into classes and assign back numbers.",
      "Show → Issues to catch missing back numbers, memberships, or scores before check-in.",
    ],
  },
  {
    role: "Judge / Score Verifier",
    steps: [
      "Show → Scoring, choose your class — entries appear in draw order.",
      "Enter the result status and score, then Submit to sign it.",
      "A Score Verifier reviews submitted scores and marks them Verified.",
    ],
  },
  {
    role: "Gate / Announcer",
    steps: [
      "Show → Gate shows Now / On Deck / 2 Away / 3 Away with one-tap actions.",
      "Show → Announcer is a read-only mirror — safe to display on a second screen.",
    ],
  },
];

const FAQ = [
  {
    q: "Why can't I check in an entry?",
    a: "The entry likely has a blocking validation issue (shown on the Issues tab) — most often a missing back number. You can check in anyway with an override reason, which is recorded in the audit log.",
  },
  {
    q: "Why is a class's Exports tab not ready?",
    a: "The NRHA export needs the show's approval number (Settings), every included class's NRHA code and pattern number, and every entry's back number and score. The Exports tab lists exactly what's missing.",
  },
  {
    q: "Can I change a score after it's verified?",
    a: "Yes — use the \"Correct\" action on the Scoring tab. It requires a reason and is recorded as a judge-sheet or data-entry correction in the audit log.",
  },
  {
    q: "Where do payout amounts come from?",
    a: "Results → a class page has a payout schedule you configure (percent by placing) — it's a calculator, not a pre-built formula, so confirm the percentages match your own fee schedule before relying on it.",
  },
];

export default function HelpPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Help & Support"
        description="Guides, video tutorials, and answers to common questions. Use the chat bubble in the corner for a quick question anytime."
      />

      <section>
        <h2 className="mb-3 text-lg font-semibold">Getting started by role</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {ROLE_GUIDES.map((guide) => (
            <Card key={guide.role}>
              <h3 className="mb-2 font-semibold">{guide.role}</h3>
              <ol className="list-inside list-decimal space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
                {guide.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Video tutorials</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TUTORIALS.map((video) => (
            <Card key={video.title} className="flex flex-col">
              <div className="mb-3 flex aspect-video items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800">
                {video.youtubeId ? (
                  <iframe
                    className="h-full w-full rounded-md"
                    src={`https://www.youtube.com/embed/${video.youtubeId}`}
                    title={video.title}
                    allowFullScreen
                  />
                ) : (
                  <span className="text-xs text-zinc-400">Coming soon</span>
                )}
              </div>
              <h3 className="text-sm font-semibold">{video.title}</h3>
              <p className="mt-1 flex-1 text-xs text-zinc-500 dark:text-zinc-400">
                {video.description}
              </p>
              <p className="mt-2 text-xs text-zinc-400">{video.minutes} min</p>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Frequently asked questions</h2>
        <Card>
          <dl className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {FAQ.map((item) => (
              <div key={item.q} className="py-4 first:pt-0 last:pb-0">
                <dt className="text-sm font-semibold">{item.q}</dt>
                <dd className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      </section>
    </div>
  );
}
