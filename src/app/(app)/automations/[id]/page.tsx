import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AutomationBuilder } from "@/components/automations/automation-builder";
import { AutomationRuns } from "@/components/automations/automation-runs";
import {
  getAutomation,
  listAutomationBuilderOptions,
  listAutomationRuns,
} from "@/server/queries/automations";

export const metadata: Metadata = { title: "Editar automatización" };

export default async function AutomationEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [automation, options, runs] = await Promise.all([
    getAutomation(id),
    listAutomationBuilderOptions(),
    listAutomationRuns(id),
  ]);
  if (!automation) notFound();

  return (
    <div className="space-y-6">
      <AutomationBuilder automation={automation} options={options} />
      <AutomationRuns runs={runs} />
    </div>
  );
}
