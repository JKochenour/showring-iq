import Link from "next/link";
import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import {
  deleteHorse,
  removeOwnership,
  removeRegistration,
} from "@/app/(app)/organizations/[id]/horses/actions";
import { EditHorseForm } from "@/components/org/horse-form";
import {
  AddOwnershipForm,
  AddRegistrationForm,
} from "@/components/org/horse-managers";
import { DocumentManager } from "@/components/org/document-manager";
import { RemoveButton } from "@/components/remove-button";
import { Card } from "@/components/ui";
import type { DocumentRow, Horse, HorseOwnership, HorseRegistration } from "@/lib/types";

export const metadata = { title: "Horse — ShowRing IQ" };

export default async function HorseDetailPage({
  params,
}: {
  params: Promise<{ id: string; horseId: string }>;
}) {
  const { id, horseId } = await params;
  const { supabase } = await requireUser();

  const [
    { data: horse },
    { data: registrations },
    { data: ownerships },
    { data: owners },
    { data: documents },
    canEdit,
    canEditMemberships,
    canEditOwnership,
    canUploadDocs,
    canVerifyDocs,
    canRejectDocs,
    canDeleteDocs,
  ] = await Promise.all([
    supabase
      .from("horses")
      .select("*")
      .eq("id", horseId)
      .eq("organization_id", id)
      .maybeSingle(),
    supabase
      .from("horse_registrations")
      .select("*")
      .eq("horse_id", horseId)
      .order("association"),
    supabase
      .from("horse_ownerships")
      .select("*, owner:people(id, first_name, last_name)")
      .eq("horse_id", horseId)
      .order("created_at"),
    supabase
      .from("people")
      .select("id, first_name, last_name")
      .eq("organization_id", id)
      .contains("roles", ["owner"])
      .order("last_name"),
    supabase
      .from("documents")
      .select("*")
      .eq("horse_id", horseId)
      .order("created_at", { ascending: false }),
    hasOrgPermission(id, "horse.edit"),
    hasOrgPermission(id, "membership.edit"),
    hasOrgPermission(id, "ownership.edit"),
    hasOrgPermission(id, "document.upload"),
    hasOrgPermission(id, "document.verify"),
    hasOrgPermission(id, "document.reject"),
    hasOrgPermission(id, "document.delete"),
  ]);

  if (!horse) notFound();
  const h = horse as Horse;
  const documentRows = (documents as DocumentRow[]) ?? [];
  const regRows = (registrations as HorseRegistration[]) ?? [];
  const ownershipRows = (ownerships as unknown as HorseOwnership[]) ?? [];
  const ownerOptions =
    owners?.map((p) => ({
      id: p.id as string,
      label: `${p.last_name}, ${p.first_name}`,
    })) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          <Link href={`/organizations/${id}/horses`} className="hover:underline">
            Horses
          </Link>{" "}
          / {h.registered_name}
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">
          {h.registered_name}
          {h.barn_name && (
            <span className="ml-2 text-base font-normal text-zinc-500 dark:text-zinc-400">
              “{h.barn_name}”
            </span>
          )}
        </h2>
      </div>

      <Card>
        <h3 className="mb-1 text-base font-semibold">
          Registrations &amp; competition licenses
        </h3>
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          The NRHA competition license number is required on the ReinerSuite
          CSV for every entry.
        </p>
        {regRows.length > 0 && (
          <ul className="mb-4 divide-y divide-zinc-200 dark:divide-zinc-800">
            {regRows.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {r.association}
                    {r.registration_number && ` · reg #${r.registration_number}`}
                    {r.competition_license_number &&
                      ` · license #${r.competition_license_number}`}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {r.status}
                    {r.expiration_date && ` · expires ${r.expiration_date}`}
                    {r.verified_at
                      ? ` · verified ${new Date(r.verified_at).toLocaleDateString()}`
                      : " · not verified"}
                  </p>
                </div>
                {canEditMemberships && (
                  <RemoveButton
                    action={removeRegistration.bind(null, r.id)}
                    confirmText={`Remove ${r.association} registration?`}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
        {canEditMemberships ? (
          <AddRegistrationForm horseId={horseId} />
        ) : (
          regRows.length === 0 && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No registrations recorded.
            </p>
          )
        )}
      </Card>

      <Card>
        <h3 className="mb-1 text-base font-semibold">Ownership</h3>
        {ownershipRows.length > 0 && (
          <ul className="mb-4 divide-y divide-zinc-200 dark:divide-zinc-800">
            {ownershipRows.map((o) => (
              <li
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {o.owner ? (
                      <Link
                        href={`/organizations/${id}/people/${o.owner.id}`}
                        className="text-emerald-700 hover:underline dark:text-emerald-500"
                      >
                        {o.owner.first_name} {o.owner.last_name}
                      </Link>
                    ) : (
                      "Unknown person"
                    )}{" "}
                    · {o.percentage}%
                  </p>
                  {o.start_date && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      since {o.start_date}
                    </p>
                  )}
                </div>
                {canEditOwnership && (
                  <RemoveButton
                    action={removeOwnership.bind(null, o.id)}
                    confirmText="Remove this owner?"
                  />
                )}
              </li>
            ))}
          </ul>
        )}
        {canEditOwnership ? (
          <AddOwnershipForm horseId={horseId} people={ownerOptions} />
        ) : (
          ownershipRows.length === 0 && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No owners recorded.
            </p>
          )
        )}
      </Card>

      <Card>
        <h3 className="mb-1 text-base font-semibold">Documents</h3>
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          Coggins, health certificates, registration papers, and other
          paperwork. Verified documents are included in the show&apos;s NRHA
          submission package.
        </p>
        <DocumentManager
          organizationId={id}
          horseId={horseId}
          documents={documentRows}
          canUpload={canUploadDocs}
          canVerify={canVerifyDocs}
          canReject={canRejectDocs}
          canDelete={canDeleteDocs}
        />
      </Card>

      {canEdit && (
        <>
          <section>
            <h3 className="mb-3 text-base font-semibold">Profile</h3>
            <EditHorseForm horse={h} />
          </section>
          <Card className="max-w-2xl border-red-200 dark:border-red-900">
            <h3 className="mb-1 text-sm font-semibold">Danger zone</h3>
            <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
              Deleting removes this horse, its registrations, and ownership
              records. Once entries exist (Sprint 5), horses connected to
              entries can&apos;t be deleted.
            </p>
            <RemoveButton
              action={deleteHorse.bind(null, horseId)}
              label="Delete horse"
              pendingLabel="Deleting…"
              confirmText={`Permanently delete ${h.registered_name}? This cannot be undone.`}
            />
          </Card>
        </>
      )}
    </div>
  );
}
