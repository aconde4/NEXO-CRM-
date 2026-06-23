import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { AutomationsView } from "@/components/automations/automations-view";
import { listAutomations } from "@/server/queries/automations";

export const metadata: Metadata = { title: "Automatizaciones" };

export default async function AutomationsPage() {
  const automations = await listAutomations();

  return (
    <>
      <PageHeader
        title="Automatizaciones"
        description="Flujos: disparador → condiciones → esperas → acciones. Se ejecutan en segundo plano."
      />
      <AutomationsView automations={automations} />
    </>
  );
}
