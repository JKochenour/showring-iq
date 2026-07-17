import type { ReactNode } from "react";

/**
 * Legal content for ShowRing IQ, kept as structured data so the page and any
 * future per-document routes render from one source.
 *
 * IMPORTANT: this is a good-faith STARTER TEMPLATE, not attorney-reviewed
 * language. Everything in [SQUARE BRACKETS] is a placeholder the operator (or
 * their counsel) must fill in before the site is opened to the public. Search
 * the codebase for "[" to find them all. Update EFFECTIVE_DATE whenever the
 * substance changes.
 */

export const EFFECTIVE_DATE = "[EFFECTIVE DATE]";
export const ENTITY = "[LEGAL ENTITY NAME]";
export const CONTACT_EMAIL = "[CONTACT EMAIL]";
export const GOVERNING_STATE = "[GOVERNING STATE]";
export const GOVERNING_VENUE = "[COUNTY, STATE]";
export const SITE_URL = "showringiq.com";

export interface LegalSection {
  heading: string;
  body: ReactNode;
}

export interface LegalDoc {
  id: string;
  title: string;
  summary: string;
  sections: LegalSection[];
}

/** Small helper so document bodies read as prose without repeating classes. */
function P({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={`leading-relaxed text-stone-600 dark:text-stone-300 ${className ?? ""}`}>
      {children}
    </p>
  );
}

function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 leading-relaxed text-stone-600 marker:text-brand-500 dark:text-stone-300">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}

export const LEGAL_DOCS: LegalDoc[] = [
  // ---------------------------------------------------------------- Terms
  {
    id: "terms",
    title: "Terms of Service",
    summary:
      "The agreement between you and ShowRing IQ for using the platform — accounts, acceptable use, payments, and the limits of our responsibility.",
    sections: [
      {
        heading: "1. Agreement to these terms",
        body: (
          <div className="space-y-3">
            <P>
              These Terms of Service (the &ldquo;Terms&rdquo;) govern your access
              to and use of the ShowRing IQ software, websites, and services
              (together, the &ldquo;Service&rdquo;) provided by {ENTITY}{" "}
              (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;ShowRing IQ&rdquo;).
              By creating an account, accessing, or using the Service, you agree
              to be bound by these Terms. If you are using the Service on behalf
              of an organization, you represent that you are authorized to bind
              that organization, and &ldquo;you&rdquo; includes that
              organization.
            </P>
            <P>
              If you do not agree to these Terms, do not use the Service.
            </P>
          </div>
        ),
      },
      {
        heading: "2. The Service",
        body: (
          <div className="space-y-3">
            <P>
              ShowRing IQ is a horse show management platform that helps
              organizations manage entries, class codes, eligibility checks,
              scoring, payouts, results, documents, and association submission
              packages. The Service is provided as a tool for show management;
              it does not replace the judgment of show officials or the rules of
              any breed or discipline association.
            </P>
            <P>
              We may add, change, or remove features at any time. We will make
              reasonable efforts to notify you of material changes that affect
              how you use the Service.
            </P>
          </div>
        ),
      },
      {
        heading: "3. Accounts and organizations",
        body: (
          <List
            items={[
              "You must provide accurate account information and keep it current.",
              "You are responsible for safeguarding your login credentials and for all activity that occurs under your account.",
              "Access within an organization is governed by roles and permissions set by that organization's owners and managers. You agree to use only the access granted to you.",
              "You must notify us promptly at " + CONTACT_EMAIL + " of any unauthorized use of your account or any other breach of security.",
              "You must be at least 18 years old, or the age of majority in your jurisdiction, to create an account. Records about minor participants may be entered by authorized adults in accordance with the Privacy Policy.",
            ]}
          />
        ),
      },
      {
        heading: "4. Acceptable use",
        body: (
          <div className="space-y-3">
            <P>You agree not to:</P>
            <List
              items={[
                "Use the Service in violation of any applicable law or association rule.",
                "Upload data you do not have the right to use, or infringe anyone's intellectual property or privacy rights.",
                "Attempt to gain unauthorized access to another organization's data, to any system, or to the accounts of other users.",
                "Interfere with, disrupt, probe, or reverse engineer the Service, or circumvent any security or access control.",
                "Use the Service to store or transmit malicious code, or to send unsolicited communications.",
                "Resell, sublicense, or provide the Service to third parties except as expressly permitted in writing.",
              ]}
            />
          </div>
        ),
      },
      {
        heading: "5. Your data and content",
        body: (
          <div className="space-y-3">
            <P>
              You retain ownership of the data and content your organization
              enters into the Service (&ldquo;Your Content&rdquo;). You grant us
              a limited license to host, process, and display Your Content solely
              to operate and improve the Service and to provide it back to you
              and the users you authorize.
            </P>
            <P>
              You are responsible for the accuracy, legality, and appropriate
              handling of Your Content, including any personal information about
              exhibitors, owners, riders, trainers, minors, and staff. See the{" "}
              <a href="#privacy" className="font-medium text-brand-700 underline underline-offset-2 dark:text-brand-400">
                Privacy Policy
              </a>{" "}
              for how we handle that information.
            </P>
          </div>
        ),
      },
      {
        heading: "6. Payments, fees, and the financial ledger",
        body: (
          <div className="space-y-3">
            <P>
              <strong className="font-semibold text-stone-800 dark:text-stone-100">
                ShowRing IQ records payments; it does not process card payments.
              </strong>{" "}
              The Service acts as a financial ledger: it records charges,
              payments (cash, check, or card taken on your organization&rsquo;s
              own payment terminal), refunds, and payouts that your organization
              enters or reconciles. Your organization is solely responsible for
              actually collecting funds, running its own payment processor, and
              for the accuracy of amounts recorded.
            </P>
            <P>
              Subscription or usage fees for the Service itself, if any, will be
              described at the point of purchase. Except where required by law or
              expressly stated, fees are non-refundable.
            </P>
            <P>
              Payout calculations, retainage, added money, and similar figures
              are computed from the schedules and rule packages your organization
              configures. You are responsible for confirming these before
              distributing money. See the{" "}
              <a href="#disclaimer" className="font-medium text-brand-700 underline underline-offset-2 dark:text-brand-400">
                Validation &amp; Liability Disclaimer
              </a>
              .
            </P>
          </div>
        ),
      },
      {
        heading: "7. Association rules and submissions",
        body: (
          <P>
            The Service can help assemble association submission packages (for
            example, NRHA, AQHA, or APHA) based on rule packages you configure or
            import. We are not affiliated with, endorsed by, or acting on behalf
            of any association. You are responsible for meeting each
            association&rsquo;s requirements, deadlines, and fees, and for the
            final accuracy of anything you submit.
          </P>
        ),
      },
      {
        heading: "8. Intellectual property",
        body: (
          <P>
            The Service, including its software, design, and content we provide
            (excluding Your Content), is owned by {ENTITY} and its licensors and
            is protected by intellectual property laws. We grant you a limited,
            non-exclusive, non-transferable, revocable license to use the Service
            in accordance with these Terms. All rights not expressly granted are
            reserved.
          </P>
        ),
      },
      {
        heading: "9. Third-party services",
        body: (
          <P>
            The Service relies on third-party providers for hosting, database,
            authentication, email, error monitoring, and analytics. Your use of
            the Service may be subject to those providers&rsquo; terms. We are not
            responsible for third-party services outside our control.
          </P>
        ),
      },
      {
        heading: "10. Disclaimers",
        body: (
          <P>
            THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS
            AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS,
            IMPLIED, OR STATUTORY, INCLUDING IMPLIED WARRANTIES OF
            MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
            NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE
            UNINTERRUPTED, ERROR-FREE, OR THAT VALIDATION RESULTS, ELIGIBILITY
            CHECKS, OR CALCULATIONS ARE COMPLETE OR ACCURATE. See the Validation
            &amp; Liability Disclaimer below.
          </P>
        ),
      },
      {
        heading: "11. Limitation of liability",
        body: (
          <P>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, {ENTITY} AND ITS AFFILIATES
            WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
            CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA,
            GOODWILL, OR OTHER INTANGIBLE LOSSES, ARISING FROM OR RELATED TO YOUR
            USE OF THE SERVICE. OUR TOTAL LIABILITY FOR ANY CLAIM ARISING OUT OF
            OR RELATING TO THE SERVICE WILL NOT EXCEED THE GREATER OF (A) THE
            AMOUNTS YOU PAID US FOR THE SERVICE IN THE TWELVE MONTHS BEFORE THE
            CLAIM, OR (B) ONE HUNDRED U.S. DOLLARS ($100).
          </P>
        ),
      },
      {
        heading: "12. Indemnification",
        body: (
          <P>
            You agree to indemnify and hold harmless {ENTITY} and its officers,
            employees, and agents from any claims, damages, liabilities, and
            expenses (including reasonable legal fees) arising from Your Content,
            your use of the Service, your violation of these Terms, or your
            violation of any law or third-party right.
          </P>
        ),
      },
      {
        heading: "13. Termination",
        body: (
          <P>
            You may stop using the Service at any time. We may suspend or
            terminate your access if you violate these Terms or if we reasonably
            believe your use poses a risk to the Service or others. On
            termination, your right to use the Service ends; provisions that by
            their nature should survive (including ownership, disclaimers,
            limitation of liability, and indemnification) will survive.
          </P>
        ),
      },
      {
        heading: "14. Governing law and disputes",
        body: (
          <P>
            These Terms are governed by the laws of the State of{" "}
            {GOVERNING_STATE}, without regard to its conflict-of-laws rules. You
            agree that the exclusive venue for any dispute that is not subject to
            arbitration or small-claims court will be the state or federal courts
            located in {GOVERNING_VENUE}.
          </P>
        ),
      },
      {
        heading: "15. Changes to these terms",
        body: (
          <P>
            We may update these Terms from time to time. When we make material
            changes, we will update the effective date above and, where
            appropriate, provide additional notice. Your continued use of the
            Service after changes take effect constitutes acceptance of the
            updated Terms.
          </P>
        ),
      },
      {
        heading: "16. Contact",
        body: (
          <P>
            Questions about these Terms can be sent to{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-brand-700 underline underline-offset-2 dark:text-brand-400">
              {CONTACT_EMAIL}
            </a>
            .
          </P>
        ),
      },
    ],
  },

  // -------------------------------------------------------------- Privacy
  {
    id: "privacy",
    title: "Privacy Policy",
    summary:
      "What personal information the Service handles, how it is used, who processes it, how long it is kept, and the choices available to you.",
    sections: [
      {
        heading: "1. Scope",
        body: (
          <P>
            This Privacy Policy explains how {ENTITY} collects, uses, and shares
            information in connection with the ShowRing IQ Service at {SITE_URL}.
            For most personal information about exhibitors, owners, riders,
            trainers, and minors, the organization running the show is the party
            that decides what to collect and why (the &ldquo;controller&rdquo;),
            and ShowRing IQ processes that information on the
            organization&rsquo;s behalf.
          </P>
        ),
      },
      {
        heading: "2. Information we collect",
        body: (
          <div className="space-y-3">
            <P>Depending on how the Service is used, we may handle:</P>
            <List
              items={[
                "Account information — name, email address, and organization membership for people who sign in.",
                "Participant records — names, contact details, birthdates, association membership and license numbers, ownership and lease details, and back numbers, entered by organizations to run their shows.",
                "Documents — uploaded files such as Coggins, memberships, licenses, ownership transfers, and W-9s, which may contain sensitive information.",
                "Financial records — charges, payments, refunds, and payouts recorded in the ledger. We do not collect or store full payment-card numbers; card payments are handled on your organization's own terminal.",
                "Usage and device data — log data, IP address, browser type, and interactions with the Service, collected for security, troubleshooting, and product analytics.",
              ]}
            />
          </div>
        ),
      },
      {
        heading: "3. How we use information",
        body: (
          <List
            items={[
              "To provide, operate, secure, and improve the Service.",
              "To authenticate users and enforce role-based access and permissions.",
              "To run validation, scoring, results, payouts, and submission-package features that organizations configure.",
              "To send transactional messages such as entry confirmations and results notifications when an organization enables them.",
              "To monitor for errors and abuse, and to comply with legal obligations.",
            ]}
          />
        ),
      },
      {
        heading: "4. Service providers (sub-processors)",
        body: (
          <div className="space-y-3">
            <P>
              We use trusted third parties to run the Service. Each processes
              data only as needed to provide their function:
            </P>
            <List
              items={[
                "Supabase — database, authentication, and file storage.",
                "Vercel — application hosting and delivery.",
                "Resend — transactional email delivery (when enabled).",
                "Twilio — SMS notifications (when enabled).",
                "Sentry — error and performance monitoring.",
                "PostHog — product analytics.",
                "Anthropic — powering the optional in-app help assistant (only the messages you send to that assistant are processed).",
              ]}
            />
            <P>
              This list may change as the Service evolves; we will keep it
              current here.
            </P>
          </div>
        ),
      },
      {
        heading: "5. How information is shared",
        body: (
          <P>
            We do not sell personal information. Information is shared within an
            organization according to its roles and permissions, with the
            service providers listed above, with associations when your
            organization chooses to generate and submit packages, and when
            required by law or to protect rights and safety.
          </P>
        ),
      },
      {
        heading: "6. Data security",
        body: (
          <P>
            We use technical and organizational measures to protect information,
            including row-level security to isolate each organization&rsquo;s
            data, encryption in transit and at rest, signed time-limited URLs for
            file access, and least-privilege access controls. No method of
            transmission or storage is perfectly secure. See the{" "}
            <a href="#security" className="font-medium text-brand-700 underline underline-offset-2 dark:text-brand-400">
              Data Processing &amp; Security note
            </a>{" "}
            for more detail.
          </P>
        ),
      },
      {
        heading: "7. Data retention",
        body: (
          <P>
            We retain information for as long as an organization&rsquo;s account
            is active or as needed to provide the Service, and afterward as
            required to comply with legal, accounting, association-record, or
            reporting obligations. Organizations may request deletion of their
            data as described below; some records may be retained where retention
            is legally required.
          </P>
        ),
      },
      {
        heading: "8. Children's information",
        body: (
          <P>
            The Service is used to manage shows that include minor participants.
            Records about minors are entered by authorized adults within an
            organization. We do not knowingly allow minors to create their own
            accounts, and we handle records about minors as part of the
            organization&rsquo;s data under this Policy. If you believe a minor
            has created an account, contact us at {CONTACT_EMAIL}.
          </P>
        ),
      },
      {
        heading: "9. Your choices and rights",
        body: (
          <div className="space-y-3">
            <P>
              Depending on your location, you may have rights to access, correct,
              delete, or port personal information, or to object to or restrict
              certain processing. Because organizations control most participant
              data, we will generally direct such requests to the relevant
              organization and assist them in responding.
            </P>
            <P>
              To make a request about your own account information, contact{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-brand-700 underline underline-offset-2 dark:text-brand-400">
                {CONTACT_EMAIL}
              </a>
              .
            </P>
          </div>
        ),
      },
      {
        heading: "10. Cookies",
        body: (
          <P>
            We use strictly necessary cookies to keep you signed in and to secure
            the Service, and limited analytics to understand and improve usage.
            You can control cookies through your browser settings; disabling
            necessary cookies may prevent you from signing in.
          </P>
        ),
      },
      {
        heading: "11. International users",
        body: (
          <P>
            The Service is operated from the United States and information may be
            processed there and in the regions where our service providers
            operate. By using the Service, you understand that your information
            may be transferred to and processed in those locations.
          </P>
        ),
      },
      {
        heading: "12. Changes and contact",
        body: (
          <P>
            We may update this Policy from time to time and will update the
            effective date when we do. Questions or requests can be sent to{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-brand-700 underline underline-offset-2 dark:text-brand-400">
              {CONTACT_EMAIL}
            </a>
            .
          </P>
        ),
      },
    ],
  },

  // ------------------------------------------------------------ Disclaimer
  {
    id: "disclaimer",
    title: "Validation & Liability Disclaimer",
    summary:
      "ShowRing IQ assists with validation — it does not guarantee eligibility, accuracy, or compliance. Final responsibility stays with show management and the association.",
    sections: [
      {
        heading: "Validation assistance only",
        body: (
          <div className="space-y-3">
            <P className="text-stone-800 dark:text-stone-100">
              <strong className="font-semibold">
                Validation assistance is based on the configured rule package.
                Final responsibility remains with show management and the
                applicable association.
              </strong>
            </P>
            <P>
              ShowRing IQ&rsquo;s eligibility checks, warnings, readiness
              checklists, and calculations are tools to help show staff catch
              problems earlier. They are only as accurate as the rule packages,
              class codes, memberships, documents, and other data that your
              organization configures and enters. They are not legal, financial,
              or compliance advice, and they do not replace the judgment of show
              officials or the rules of any association.
            </P>
          </div>
        ),
      },
      {
        heading: "No guarantee of eligibility or compliance",
        body: (
          <P>
            We do not guarantee that any entry is eligible, that any result is
            correct, that any submission will be accepted by an association, or
            that any calculation (including placings, payouts, retainage, added
            money, or fees) is complete or accurate. A &ldquo;ready&rdquo; status
            or a passing validation means the checks that were configured did not
            find a problem — not that the entry, result, or package is guaranteed
            to be correct or accepted.
          </P>
        ),
      },
      {
        heading: "Your responsibility as show management",
        body: (
          <List
            items={[
              "Confirm class codes, eligibility rules, fee caps, and payout schedules against the current, official association materials before relying on them.",
              "Verify memberships, licenses, ownership, birthdates, and other records against original documents.",
              "Review every submission package, results file, and payout before distributing money or submitting to an association.",
              "Meet all association deadlines, fees, and formatting requirements. ShowRing IQ is not responsible for late fees, rejected files, error-rate penalties, or corrections.",
            ]}
          />
        ),
      },
      {
        heading: "Association independence",
        body: (
          <P>
            {ENTITY} is an independent software provider. It is not affiliated
            with, sponsored by, or endorsed by NRHA, AQHA, APHA, or any other
            breed or discipline association. Association names are used only to
            describe compatibility. Official rules, class codes, and requirements
            are published by each association and control in the event of any
            conflict with data configured in the Service.
          </P>
        ),
      },
    ],
  },

  // -------------------------------------------------------------- Security
  {
    id: "security",
    title: "Data Processing & Security",
    summary:
      "A plain-language summary of how organization, exhibitor, youth, and financial data — and sensitive documents — are stored and protected.",
    sections: [
      {
        heading: "Tenant isolation",
        body: (
          <P>
            Every record is scoped to an organization. Access requires an active
            membership in that organization, and is then narrowed further by
            individual permissions. This is enforced in the database with
            row-level security, not only in the interface, so one
            organization&rsquo;s data is not visible to another.
          </P>
        ),
      },
      {
        heading: "Roles and least privilege",
        body: (
          <P>
            Permissions are granted individually and grouped into role presets
            (owner, manager, secretary, judge, gate, announcer, treasurer,
            exhibitor, and others). Business logic checks specific permissions
            rather than roles, so people see only what their job requires — for
            example, judges see only their assigned classes and exhibitors see
            only their own entries and invoices.
          </P>
        ),
      },
      {
        heading: "Sensitive data and documents",
        body: (
          <P>
            Sensitive information — birthdates, addresses, youth records,
            financial records, and uploaded documents such as W-9s, memberships,
            licenses, and health paperwork — is protected by row-level security
            and file-access policies, is encrypted at rest, and is served through
            signed, time-limited URLs. We aim to expose the minimum necessary
            information for each task.
          </P>
        ),
      },
      {
        heading: "Auditing",
        body: (
          <P>
            State-changing actions such as overrides, score corrections,
            re-draws, unlocks, and publishing are recorded in an audit log
            capturing who acted, what changed (before and after), the reason, and
            when — supporting accountability and after-the-fact review.
          </P>
        ),
      },
      {
        heading: "Payments",
        body: (
          <P>
            ShowRing IQ records payments; it never processes payment cards. Full
            card numbers are not entered into or stored by the Service. Card
            payments are taken on your organization&rsquo;s own payment terminal,
            and only the resulting record (amount, method, date) is stored in the
            ledger.
          </P>
        ),
      },
      {
        heading: "Reporting a concern",
        body: (
          <P>
            If you believe you have found a security vulnerability or a data
            issue, please contact{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-brand-700 underline underline-offset-2 dark:text-brand-400">
              {CONTACT_EMAIL}
            </a>{" "}
            so we can investigate promptly.
          </P>
        ),
      },
    ],
  },
];
