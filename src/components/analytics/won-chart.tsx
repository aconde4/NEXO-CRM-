import { Trophy } from "lucide-react";

import { formatMoney, formatMoneyCompact } from "@/lib/format";
import type { WonMonthPoint } from "@/server/queries/analytics";
import { ChartCard } from "@/components/analytics/chart-card";
import { ColumnChart } from "@/components/analytics/column-chart";

export function WonChart({
  data,
  currentKey,
}: {
  data: WonMonthPoint[];
  currentKey: string;
}) {
  const totalValue = data.reduce((sum, m) => sum + m.value, 0);
  const bars = data.map((m) => ({
    key: m.key,
    label: m.label,
    value: Math.round(m.value),
    valueText: m.value > 0 ? formatMoneyCompact(Math.round(m.value)) : "",
    title: `${m.label}: ${m.count} ${
      m.count === 1 ? "negocio ganado" : "negocios ganados"
    } · ${formatMoney(Math.round(m.value))}`,
    highlight: m.key === currentKey,
  }));

  return (
    <ChartCard
      icon={Trophy}
      title="Ganados por mes"
      description={`Valor de los negocios ganados en los últimos 6 meses (${formatMoney(
        Math.round(totalValue),
      )}).`}
    >
      <ColumnChart
        bars={bars}
        emptyText="Aún no has ganado negocios en los últimos 6 meses."
      />
    </ChartCard>
  );
}
