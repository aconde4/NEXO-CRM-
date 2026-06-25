"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  Handshake,
  Inbox,
  MoreHorizontal,
  Trash2,
  User,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { relativeDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { LeadStatus } from "@/server/db/schema";
import type { LeadCounts, LeadListItem } from "@/server/queries/leads";
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

export function LeadsView({
  leads,
  counts,
  activeStatus,
}: {
  leads: LeadListItem[];
  counts: LeadCounts;
  activeStatus: TabKey;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {TABS.map((tab) => {
          const active = tab.key === activeStatus;
          const count = tab.key === "all" ? counts.all : counts[tab.key];
          return (
            <Link
              key={tab.key}
              href={tab.key === "all" ? "/leads" : `/leads?status=${tab.key}`}
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
                  <th className="px-4 py-2.5 font-medium">Recibido</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
                  <th className="w-12 px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <LeadRow key={lead.id} lead={lead} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function LeadRow({ lead }: { lead: LeadListItem }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const meta = statusMeta[lead.status];

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
