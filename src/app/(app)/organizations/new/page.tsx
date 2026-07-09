import { CreateOrgForm } from "@/components/org/create-org-form";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "New organization — ShowRing IQ" };

export default function NewOrganizationPage() {
  return (
    <div>
      <PageHeader
        title="Create organization"
        description="You'll become the Organization Owner. Default staff roles (Show Manager, Show Secretary, Judge, Gate, …) are created automatically."
      />
      <CreateOrgForm />
    </div>
  );
}
