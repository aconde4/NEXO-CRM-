"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  Handshake,
  Inbox,
  Loader2,
  MoreHorizontal,
  Sparkles,
  Trash2,
  User,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { relativeDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { LeadStatus } from "@/server/db/schema";
import type {
  LeadCounts,
  LeadListItem,
  LeadListSort,
} from "@/server/queries/leads";
import { scoreLeadWithAI, scoreNewLeadsWithAI } from "@/server/actions/ai";
import {
  convertLeadToDeal,
  deleteLead,
  setLeadStatus,
} from "@/server/actions/leads";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type TabKey = LeadStatus | "all";

const TABS: { key: TabKey; label: string }[] = [
  { key: "new", label: "Nuevos" },
  { key: "qualified", label: "Calificados" },
  { key: "converted", label: "Convertidos" },
  { key: "junk", label: "Basura" },
  { key: "all", label: "Todos" },
];

type BadgeVariant = React.ComponentProps<typeof Badge>["variant"];
const statusMeta: Record<
  LeadStatus,
  { label: string; variant: BadgeVariant; className?: string }
> = {
  new: { label: "Nuevo", variant: "secondary" },
  qualified: {
    label: "Calificado",
    variant: "secondary",
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  converted: {
    label: "Convertido",
    variant: "secondary",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  junk: { label: "Basura", variant: "outline" },
};

export type LeadAIStatus = {
  configured: boolean;
  model: string | null;
  provider: string | null;
  reason: string | null;
};

/** Color y etiqueta del badge de puntuación según el tramo (caliente/templado/frío). */
function scoreMeta(score: number): { className: string; label: string } {
  if (score >= 70) {
    return {
      className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      label: "Caliente",
    };
  }
  if (score >= 40) {
    return {
      className: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
      label: "Templado",
    };
  }
  return { className: "bg-muted text-muted-foreground", label: "Frío" };
}

function tabHref(status: TabKey, sort: LeadListSort): string {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (sort === "score") params.set("sort", "score");
  const qs = params.toString();
  return qs ? `/leads?${qs}` : "/leads";
}

export function LeadsView({
  leads,
  counts,
  activeStatus,
  activeSort,
  aiStatus,
}: {
  leads: LeadListItem[];
  counts: LeadCounts;
  activeStatus: TabKey;
  activeSort: LeadListSort;
  aiStatus: LeadAIStatus;
}) {
  const router = useRouter();
  const [scoringAll, setScoringAll] = React.useState(false);

  async function scoreNew() {
    if (scoringAll || !aiStatus.configured) return;
    setScoringAll(true);
    try {
      const result = await scoreNewLeadsWithAI({ limit: 10 });
      if (result.total === 0) {
        toast.info("No hay leads nuevos sin puntuar.");
      } else {
        toast.success(
          `Puntuados ${result.scored}/${result.total}` +
            (result.failed ? ` (${result.failed} con error)` : ""),
        );
      }
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudieron puntuar",
      );
    } finally {
      setScoringAll(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {TABS.map((tab) => {
            const active = tab.key === activeStatus;
            const count = tab.key === "all" ? counts.all : counts[tab.key];
            return (
              <Link
                key={tab.key}
                href={tabHref(tab.key, activeSort)}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
                <span className="ml-1.5 tabular-nums opacity-70">{count}</span>
              </Link>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="text-muted-foreground inline-flex items-center overflow-hidden rounded-full border text-xs">
            <Link
              href={tabHref(activeStatus, "recent")}
              className={cn(
                "px-3 py-1 font-medium transition-colors",
                activeSort === "recent"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted",
              )}
            >
              Recientes
            </Link>
            <Link
              href={tabHref(activeStatus, "score")}
              className={cn(
                "px-3 py-1 font-medium transition-colors",
                activeSort === "score"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted",
              )}
            >
              Puntuación
            </Link>
          </div>
          {aiStatus.configured ? (
            <Button
              variant="outline"
              size="sm"
              onClick={scoreNew}
              disabled={scoringAll}
              title="Puntúa con IA los leads nuevos aún sin puntuar"
            >
              {scoringAll ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {scoringAll ? "Puntuando…" : "Puntuar nuevos"}
            </Button>
          ) : null}
        </div>
      </div>

      {!aiStatus.configured ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
          Puntuación con IA desactivada. {aiStatus.reason ?? "Configura la IA en .env.local."}
        </div>
      ) : null}

      {leads.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <div className="bg-primary/10 text-primary mb-4 flex size-12 items-center justify-center rounded-xl">
            <Inbox className="size-6" />
          </div>
          <h3 className="font-medium">No hay leads aquí</h3>
          <p className="text-muted-foreground mt-1 max-w-xs text-sm">
            Cuando alguien envíe un formulario, su lead aparecerá en esta bandeja.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="bg-muted/40 text-muted-foreground border-b text-left text-xs">
                  <th className="px-4 py-2.5 font-medium">Contacto</th>
                  <th className="px-4 py-2.5 font-medium">Empresa</th>
                  <th className="px-4 py-2.5 font-medium">Origen</th>
                  <th className="px-4 py-2.5 font-medium">Puntuación</th>
                  <th className="px-4 py-2.5 font-medium">Recibido</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
                  <th className="w-12 px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <LeadRow key={lead.id} lead={lead} aiStatus={aiStatus} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function LeadRow({
  lead,
  aiStatus,
}: {
  lead: LeadListItem;
  aiStatus: LeadAIStatus;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const meta = statusMeta[lead.status];
  const scored = Boolean(lead.scoredAt);
  const score = scoreMeta(lead.score);

  async function scoreNow() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await scoreLeadWithAI({ leadId: lead.id });
      toast.success(`Puntuado: ${result.score}/100 — ${result.rationale}`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo puntuar",
      );
    } finally {
      setBusy(false);
    }
  }

  async function run(fn: () => Promise<unknown>, okMsg: string) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      toast.success(okMsg);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo completar",
      );
    } finally {
      setBusy(false);
    }
  }

  async function convert() {
    if (busy) return;
    setBusy(true);
    try {
      await convertLeadToDeal(lead.id);
      toast.success("Lead convertido a negocio");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo convertir",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="hover:bg-muted/30 border-b transition-colors last:border-0">
      <td className="px-4 py-2.5">
        {lead.person ? (
          <Link
            href={`/contacts/${lead.person.id}`}
            className="block min-w-0 hover:underline"
          >
            <span className="block truncate font-medium">
              {lead.person.name}
            </span>
            {lead.person.email ? (
              <span className="text-muted-foreground block truncate text-xs">
                {lead.person.email}
              </span>
            ) : null}
          </Link>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="text-muted-foreground px-4 py-2.5">
        {lead.organization ? (
          <Link
            href={`/organizations/${lead.organization.id}`}
            className="hover:text-foreground inline-flex max-w-44 items-center gap-1.5 truncate"
          >
            <Building2 className="size-3.5 shrink-0" />
            <span className="truncate">{lead.organization.name}</span>
          </Link>
        ) : (
          "—"
        )}
      </td>
      <td className="text-muted-foreground px-4 py-2.5">
        <span className="block max-w-48 truncate">{lead.source || "—"}</span>
      </td>
      <td className="px-4 py-2.5">
        {scored ? (
          <Badge
            variant="secondary"
            className={score.className}
            title={lead.scoreReason ?? undefined}
          >
            <span className="tabular-nums">{lead.score}</span>
            <span className="hidden sm:inline">· {score.label}</span>
          </Badge>
        ) : (
          <span className="text-muted-foreground text-xs">Sin puntuar</span>
        )}
      </td>
      <td className="text-muted-foreground px-4 py-2.5 whitespace-nowrap">
        {relativeDate(lead.createdAt)}
      </td>
      <td className="px-4 py-2.5">
        <Badge variant={meta.variant} className={meta.className}>
          {meta.label}
        </Badge>
      </td>
      <td className="px-4 py-2.5 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Acciones"
                disabled={busy}
              />
            }
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {aiStatus.configured ? (
              <>
                <DropdownMenuItem onClick={scoreNow}>
                  <Sparkles />
                  {scored ? "Repuntuar con IA" : "Puntuar con IA"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            ) : null}
            {lead.status !== "converted" ? (
              <DropdownMenuItem onClick={convert} disabled={!lead.person}>
                <Handshake />
                Convertir a negocio
              </DropdownMenuItem>
            ) : lead.convertedDealId ? (
              <DropdownMenuItem
                render={<Link href={`/deals/${lead.convertedDealId}`} />}
              >
                <Handshake />
                Ver negocio
              </DropdownMenuItem>
            ) : null}
            {lead.status !== "qualified" && lead.status !== "converted" ? (
              <DropdownMenuItem
                onClick={() =>
                  run(() => setLeadStatus(lead.id, "qualified"), "Lead calificado")
                }
              >
                <CheckCircle2 />
                Calificar
              </DropdownMenuItem>
            ) : null}
            {lead.status !== "junk" ? (
              <DropdownMenuItem
                onClick={() =>
                  run(() => setLeadStatus(lead.id, "junk"), "Marcado como basura")
                }
              >
                <XCircle />
                Marcar basura
              </DropdownMenuItem>
            ) : null}
            {lead.status === "junk" || lead.status === "converted" ? (
              <DropdownMenuItem
                onClick={() =>
                  run(() => setLeadStatus(lead.id, "new"), "Lead reabierto")
                }
              >
                <Inbox />
                Volver a nuevos
              </DropdownMenuItem>
            ) : null}
            {lead.person ? (
              <DropdownMenuItem render={<Link href={`/contacts/${lead.person.id}`} />}>
                <User />
                Ver contacto
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => run(() => deleteLead(lead.id), "Lead eliminado")}
            >
              <Trash2 />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}
