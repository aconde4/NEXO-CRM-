import { ListChecks } from "lucide-react";

import type { ActivityDayPoint } from "@/server/queries/analytics";
import { ChartCard } from "@/components/analytics/chart-card";
import { ColumnChart } from "@/components/analytics/column-chart";

export function ActivityChart({
  data,
  currentKey,
}: {
  data: ActivityDayPoint[];
  currentKey: string;
}) {
  const totalCompleted = data.reduce((sum, d) => sum + d.completed, 0);
  const bars = data.map((d) => ({
    key: d.key,
    label: d.label,
    value: d.completed,
    valueText: String(d.completed),
    title: `${d.label}: ${d.completed} completada${
      d.completed === 1 ? "" : "s"
    } · ${d.created} creada${d.created === 1 ? "" : "s"}`,
    highlight: d.key === currentKey,
  }));

  return (
    <ChartCard
      icon={ListChecks}
      title="Actividad completada"
      description={`Tareas completadas en los últimos 14 días (${totalCompleted} en total).`}
    >
      <ColumnChart
        bars={bars}
        showValues={false}
        emptyText="No has completado tareas en los últimos 14 días."
      />
    </ChartCard>
  );
}
