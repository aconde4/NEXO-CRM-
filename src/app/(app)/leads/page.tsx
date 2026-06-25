import type { Metadata } from "next";

import type { LeadStatus } from "@/server/db/schema";
import { getLeadCounts, listLeads } from "@/server/queries/leads";
import { LeadsView } from "@/components/leads/leads-view";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Leads" };

const VALID_STATUS = new Set<LeadStatus>([
  "new",
  "qualified",
  "converted",
  "junk",
]);

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const params = await searchParams;
  const statusParam = firstParam(params.status);
  const activeStatus =
    statusParam && VALID_STATUS.has(statusParam as LeadStatus)
      ? (statusParam as LeadStatus)
      : "all";

  const [leads, counts] = await Promise.all([
    listLeads(activeStatus === "all" ? undefined : activeStatus),
    getLeadCounts(),
  ]);

  return (
    <>
      <PageHeader
        title="Leads"
        description="Bandeja de leads captados: califica, descarta o conviértelos en negocio."
      />
      <LeadsView leads={leads} counts={counts} activeStatus={activeStatus} />
    </>
  );
}
