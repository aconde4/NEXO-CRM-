import { formatDate, formatMoney } from "@/lib/format";
import { REPORT_STATUS_LABELS } from "@/lib/reports";
import { cn } from "@/lib/utils";
import type { DealsReport, ReportDealRow } from "@/server/queries/reports";

const DETAIL_LIMIT = 200;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card flex flex-col gap-1 rounded-xl border p-3">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-xl font-semibold tabular-nums">{value}</span>
    </div>
  );
}

export function DealsReportResults({
  report,
  rows,
}: {
  report: DealsReport;
  rows: ReportDealRow[];
}) {
  const { summary, groups, groupBy } = report;
  const maxValue = Math.max(1, ...groups.map((g) => Math.abs(g.value)));

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Negocios" value={String(summary.count)} />
        <Stat label="Valor total" value={formatMoney(Math.round(summary.value))} />
        <Stat label="Ganados" value={String(summary.wonCount)} />
        <Stat
          label="Valor ganado"
          value={formatMoney(Math.round(summary.wonValue))}
        />
      </section>

      {summary.count === 0 ? (
        <p className="text-muted-foreground rounded-xl border px-4 py-12 text-center text-sm">
          Ningún negocio coincide con estos filtros.
        </p>
      ) : groupBy === "none" ? (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground border-b text-left text-xs">
              <tr>
                <th className="px-3 py-2 font-medium">Negocio</th>
                <th className="px-3 py-2 font-medium">Empresa</th>
                <th className="px-3 py-2 font-medium">Contacto</th>
                <th className="px-3 py-2 font-medium">Etapa</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 text-right font-medium">Valor</th>
                <th className="px-3 py-2 font-medium">Creado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.slice(0, DETAIL_LIMIT).map((row) => (
                <tr key={row.id}>
                  <td className="max-w-[18rem] truncate px-3 py-2 font-medium">
                    {row.title}
                  </td>
                  <td className="text-muted-foreground px-3 py-2">
                    {row.orgName ?? "—"}
                  </td>
                  <td className="text-muted-foreground px-3 py-2">
                    {row.personName ?? "—"}
                  </td>
                  <td className="text-muted-foreground px-3 py-2">
                    {row.stageName ?? "—"}
                  </td>
                  <td className="px-3 py-2">{REPORT_STATUS_LABELS[row.status]}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatMoney(Math.round(row.value))}
                  </td>
                  <td className="text-muted-foreground px-3 py-2 whitespace-nowrap">
                    {formatDate(row.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > DETAIL_LIMIT ? (
            <p className="text-muted-foreground border-t px-3 py-2 text-xs">
              Mostrando {DETAIL_LIMIT} de {rows.length}. Exporta a CSV para ver
              todos.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground border-b text-left text-xs">
              <tr>
                <th className="px-3 py-2 font-medium">Grupo</th>
                <th className="px-3 py-2 text-right font-medium">Negocios</th>
                <th className="px-3 py-2 font-medium">Valor</th>
                <th className="px-3 py-2 text-right font-medium">Ganado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {groups.map((group) => (
                <tr key={group.key}>
                  <td className="px-3 py-2 font-medium">{group.label}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {group.count}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                        <div
                          className={cn("bg-primary/70 h-full rounded-full")}
                          style={{
                            width: `${Math.max(2, (Math.abs(group.value) / maxValue) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="w-24 shrink-0 text-right tabular-nums">
                        {formatMoney(Math.round(group.value))}
                      </span>
                    </div>
                  </td>
                  <td className="text-muted-foreground px-3 py-2 text-right tabular-nums">
                    {formatMoney(Math.round(group.wonValue))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
