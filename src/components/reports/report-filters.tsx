"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, RotateCcw } from "lucide-react";

import {
  REPORT_DATE_FIELDS,
  REPORT_GROUP_BY,
  REPORT_STATUSES,
  type ReportParams,
  reportParamsToQuery,
} from "@/lib/reports";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClass =
  "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none transition focus-visible:ring-[3px]";

export function ReportFilters({
  params,
  pipelines,
  exportHref,
}: {
  params: ReportParams;
  pipelines: { id: string; name: string }[];
  exportHref: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = React.useState<ReportParams>(params);

  function set<K extends keyof ReportParams>(key: K, value: ReportParams[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function apply(event: React.FormEvent) {
    event.preventDefault();
    const query = reportParamsToQuery(draft);
    router.push(`/analytics/reports${query ? `?${query}` : ""}`);
  }

  return (
    <form
      onSubmit={apply}
      className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <div className="grid gap-1.5">
        <Label>Estado</Label>
        <select
          className={selectClass}
          value={draft.status}
          onChange={(event) =>
            set("status", event.target.value as ReportParams["status"])
          }
        >
          {REPORT_STATUSES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-1.5">
        <Label>Embudo</Label>
        <select
          className={selectClass}
          value={draft.pipelineId}
          onChange={(event) => set("pipelineId", event.target.value)}
        >
          <option value="">Todos los embudos</option>
          {pipelines.map((pipeline) => (
            <option key={pipeline.id} value={pipeline.id}>
              {pipeline.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-1.5">
        <Label>Agrupar por</Label>
        <select
          className={selectClass}
          value={draft.groupBy}
          onChange={(event) =>
            set("groupBy", event.target.value as ReportParams["groupBy"])
          }
        >
          {REPORT_GROUP_BY.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-1.5">
        <Label>Fecha</Label>
        <select
          className={selectClass}
          value={draft.dateField}
          onChange={(event) =>
            set("dateField", event.target.value as ReportParams["dateField"])
          }
        >
          {REPORT_DATE_FIELDS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-1.5">
        <Label>Desde</Label>
        <Input
          type="date"
          value={draft.from}
          onChange={(event) => set("from", event.target.value)}
        />
      </div>

      <div className="grid gap-1.5">
        <Label>Hasta</Label>
        <Input
          type="date"
          value={draft.to}
          onChange={(event) => set("to", event.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-3">
        <Button type="submit">Aplicar filtros</Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/analytics/reports")}
        >
          <RotateCcw />
          Limpiar
        </Button>
        <Button
          variant="outline"
          className="ml-auto"
          render={<Link href={exportHref} prefetch={false} />}
        >
          <Download />
          Exportar CSV
        </Button>
      </div>
    </form>
  );
}
