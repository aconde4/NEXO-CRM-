import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AutomationBuilder } from "@/components/automations/automation-builder";
import {
  getAutomation,
  listAutomationBuilderOptions,
} from "@/server/queries/automations";

export const metadata: Metadata = { title: "Editar automatización" };

export default async function AutomationEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [automation, options] = await Promise.all([
    getAutomation(id),
    listAutomationBuilderOptions(),
  ]);
  if (!automation) notFound();

  return <AutomationBuilder automation={automation} options={options} />;
}
