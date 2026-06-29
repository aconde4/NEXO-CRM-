import { Handshake, Target, Trophy, Percent } from "lucide-react";

import { StatCard } from "@/components/stat-card";
import { formatMoney } from "@/lib/format";
import type { AnalyticsOverview } from "@/server/queries/analytics";

export function AnalyticsKpis({ kpis }: { kpis: AnalyticsOverview["kpis"] }) {
  const stats = [
    {
      label: "Negocios abiertos",
      value: String(kpis.openDeals),
      hint: `${formatMoney(Math.round(kpis.openValue))} en juego`,
      icon: Handshake,
    },
    {
      label: "Previsión ponderada",
      value: formatMoney(Math.round(kpis.forecast)),
      hint: "Según probabilidad de etapa",
      icon: Target,
    },
    {
      label: "Ganado este mes",
      value: formatMoney(Math.round(kpis.wonThisMonth.value)),
      hint: `${kpis.wonThisMonth.count} ${
        kpis.wonThisMonth.count === 1 ? "negocio" : "negocios"
      } cerrado${kpis.wonThisMonth.count === 1 ? "" : "s"}`,
      icon: Trophy,
    },
    {
      label: "Tasa de victoria",
      value: kpis.winRate != null ? `${kpis.winRate}%` : "—",
      hint: kpis.winRate != null ? "Últimos 90 días" : "Sin cierres en 90 días",
      icon: Percent,
    },
  ];

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <StatCard key={stat.label} {...stat} />
      ))}
    </section>
  );
}
