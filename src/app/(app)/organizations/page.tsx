import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { OrganizationsView } from "@/components/organizations/organizations-view";
import { listOrganizations } from "@/server/queries/contacts";

export const metadata: Metadata = { title: "Empresas" };

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q ?? "";
  const organizations = await listOrganizations(query);

  return (
    <>
      <PageHeader
        title="Empresas"
        description={`${organizations.length} ${
          organizations.length === 1 ? "empresa" : "empresas"
        } en tu CRM.`}
      />
      <OrganizationsView organizations={organizations} query={query} />
    </>
  );
}
