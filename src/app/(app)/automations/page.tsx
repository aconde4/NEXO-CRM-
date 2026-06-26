import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { AutomationsView } from "@/components/automations/automations-view";
import {
  listAutomationBuilderOptions,
  listAutomations,
} from "@/server/queries/automations";
import { getAISettingsStatus } from "@/server/queries/ai";

export const metadata: Metadata = { title: "Automatizaciones" };

export default async function AutomationsPage() {
  const [automations, options, aiStatus] = await Promise.all([
    listAutomations(),
    listAutomationBuilderOptions(),
    getAISettingsStatus(),
  ]);

  return (
    <>
      <PageHeader
        title="Automatizaciones"
        description="Flujos: disparador → condiciones → esperas → acciones. Se ejecutan en segundo plano."
      />
      <AutomationsView
        automations={automations}
        options={options}
        aiStatus={aiStatus}
      />
    </>
  );
}
