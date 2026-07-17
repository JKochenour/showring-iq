import type { Metadata } from "next";
import {
  LEGAL_DOCS,
  EFFECTIVE_DATE,
  ENTITY,
  CONTACT_EMAIL,
} from "./legal-content";

export const metadata: Metadata = {
  title: "Legal — ShowRing IQ",
  description:
    "Terms of Service, Privacy Policy, validation disclaimer, and data security for ShowRing IQ.",
};

export default function LegalPage() {
  return (
    <div className="space-y-10">
      {/* ---------------------------------------------------------- header */}
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-brand-600 dark:text-brand-400">
          Legal
        </p>
        <h1 className="font-grotesk mt-2 text-3xl font-semibold tracking-tight text-stone-900 dark:text-stone-50 sm:text-4xl">
          Terms, privacy &amp; disclaimers
        </h1>
        <p className="mt-3 max-w-2xl leading-relaxed text-stone-600 dark:text-stone-300">
          These pages explain the agreement for using ShowRing IQ, how data is
          handled and protected, and the limits of the platform&rsquo;s
          validation assistance.
        </p>
        <p className="mt-4 font-mono text-xs uppercase tracking-[0.12em] text-stone-400">
          Effective date: {EFFECTIVE_DATE}
        </p>
      </header>

      {/* ------------------------------------------------- template notice */}
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-900/60 dark:bg-amber-950/30">
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          Draft template — not yet reviewed by counsel
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-amber-800 dark:text-amber-300/90">
          This is a good-faith starting point, not legal advice. Every value in{" "}
          <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
            [SQUARE BRACKETS]
          </code>{" "}
          — including the legal entity name ({ENTITY}), contact address (
          {CONTACT_EMAIL}), effective date, and governing state — must be filled
          in, and the full text reviewed by a qualified attorney, before the site
          is opened to the public.
        </p>
      </div>

      {/* --------------------------------------------------- table of contents */}
      <nav
        aria-label="Legal documents"
        className="rounded-xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900"
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-400">
          On this page
        </p>
        <ol className="space-y-2.5">
          {LEGAL_DOCS.map((doc, i) => (
            <li key={doc.id}>
              <a
                href={`#${doc.id}`}
                className="group flex gap-3 rounded-lg px-2 py-1.5 -mx-2 transition-colors hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:hover:bg-stone-800/60"
              >
                <span className="font-mono text-sm text-stone-400 group-hover:text-brand-500">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-stone-900 group-hover:text-brand-700 dark:text-stone-100 dark:group-hover:text-brand-400">
                    {doc.title}
                  </span>
                  <span className="mt-0.5 block text-sm text-stone-500 dark:text-stone-400">
                    {doc.summary}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {/* ------------------------------------------------------- documents */}
      {LEGAL_DOCS.map((doc) => (
        <section key={doc.id} id={doc.id} className="scroll-mt-8">
          <div className="border-t border-stone-200 pt-8 dark:border-stone-800">
            <h2 className="font-grotesk text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
              {doc.title}
            </h2>
            <p className="mt-2 max-w-2xl leading-relaxed text-stone-600 dark:text-stone-300">
              {doc.summary}
            </p>
            <div className="mt-6 space-y-7">
              {doc.sections.map((section) => (
                <div key={section.heading}>
                  <h3 className="mb-2 text-base font-semibold text-stone-900 dark:text-stone-100">
                    {section.heading}
                  </h3>
                  {section.body}
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

      <footer className="border-t border-stone-200 pt-6 text-sm text-stone-500 dark:border-stone-800 dark:text-stone-400">
        Questions? Contact{" "}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="font-medium text-brand-700 underline underline-offset-2 dark:text-brand-400"
        >
          {CONTACT_EMAIL}
        </a>
        .
      </footer>
    </div>
  );
}
