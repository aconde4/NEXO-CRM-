import type { Metadata } from "next";

import { GoalsView } from "@/components/goals/goals-view";
import { PageHeader } from "@/components/page-header";
import { listGoalsWithProgress } from "@/server/queries/goals";

export const metadata: Metadata = { title: "Objetivos" };

export default async function GoalsPage() {
  const goals = await listGoalsWithProgress();

  return (
    <>
      <PageHeader
        title="Objetivos"
        description="Define metas por periodo y sigue su progreso con tus datos reales."
      />
      <GoalsView goals={goals} />
    </>
  );
}
