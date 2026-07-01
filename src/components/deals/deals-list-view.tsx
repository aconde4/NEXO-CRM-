"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BarChart3,
  Building2,
  CalendarDays,
  Columns3,
  List,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Trophy,
  User,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";

import type { ContactFilterCondition } from "@/lib/contact-filters";
import type { CustomFieldDef } from "@/lib/custom-fields";
import { formatDate, formatMoney } from "@/lib/format";
import type { DealStatus } from "@/server/db/schema";
import {
  bulkEnrollDeals,
  deleteDeal,
  reopenDeal,
  setDealLost,
  setDealWon,
} from "@/server/actions/deals";
import type {
  DealListItem,
  DealListSort,
  DealListStatusFilter,
  PipelineOption,
} from "@/server/queries/deals";
import type { SavedView } from "@/server/queries/saved-views";
import {
  DealFormDialog,
  type DealInitial,
  type Option,
} from "@/components/deals/deal-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ContactFiltersBar } from "@/components/contacts/contact-filters-bar";
import { PipelineCombobox } from "@/components/deals/pipeline-combobox";
import { SavedViewsBar } from "@/components/saved-views/saved-views-bar";

const selectClass =
  "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-9 shrink-0 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none transition focus-visible:ring-[3px]";

const STATUS_OPTIONS: { value: DealListStatusFilter; label: string }[] = [
  { value: "open", label: "Abiertos" },
  { value: "won", label: "Ganados" },
  { value: "lost", label: "Perdidos" },
  { value: "all", label: "Todos" },
];

const SORT_OPTIONS: { value: DealListSort; label: string }[] = [
  { value: "recent", label: "Recientes" },
  { value: "oldest", label: "Más antiguos" },
  { value: "value-desc", label: "Mayor valor" },
  { value: "value-asc", label: "Menor valor" },
  { value: "close-date", label: "Cierre próximo" },
];

const statusMeta: Record<DealStatus, { label: string; className: string }> = {
  open: { label: "Abierto", className: "" },
  won: {
    label: "Ganado",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  lost: { label: "Perdido", className: "bg-destructive/10 text-destructive" },
};

type DealListFilters = {
  pipelineId: string;
  stageId: string;
  status: DealListStatusFilter;
  query: string;
  sort: DealListSort;
};

export function DealsListView({
  deals,
  filters,
  pipelines,
  stagesByPipeline,
  persons,
  organizations,
  conditions,
  customFieldDefs,
  savedViews,
  sequenceOptions,
}: {
  deals: DealListItem[];
  filters: DealListFilters;
  pipelines: PipelineOption[];
  stagesByPipeline: Record<string, Option[]>;
  persons: Option[];
  organizations: Option[];
  conditions: ContactFilterCondition[];
  customFieldDefs: CustomFieldDef[];
  savedViews: SavedView[];
  sequenceOptions: Option[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = React.useState(filters.query);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<DealInitial | null>(null);
  const [lost, setLost] = React.useState<DealListItem | null>(null);
  const [deleting, setDeleting] = React.useState<DealListItem | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeStages = stagesByPipeline[filters.pipelineId] ?? [];
  const total = deals.reduce((sum, deal) => sum + deal.value, 0);
  const forecast = deals.reduce(
    (sum, deal) =>
      deal.status === "open"
        ? sum + deal.value * (deal.stage.probability / 100)
        : sum,
    0,
  );
  const selectableIds = React.useMemo(
    () => deals.filter((deal) => deal.personId).map((deal) => deal.id),
    [deals],
  );
  const selectableIdSet = React.useMemo(
    () => new Set(selectableIds),
    [selectableIds],
  );
  const selectedVisibleIds = React.useMemo(
    () => selectableIds.filter((id) => selected.has(id)),
    [selectableIds, selected],
  );
  const selectedContactCount = React.useMemo(() => {
    const ids = new Set<string>();
    for (const deal of deals) {
      if (selected.has(deal.id) && deal.personId) ids.add(deal.personId);
    }
    return ids.size;
  }, [deals, selected]);
  const allVisibleSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  const boardHref = React.useMemo(() => {
    // Preserva el filtro (y demás parámetros) al cambiar a Kanban; solo quita `view`.
    const params = new URLSearchParams(searchParams.toString());
    params.delete("view");
    return `/deals${params.size ? `?${params}` : ""}`;
  }, [searchParams]);

  const metricsHref = React.useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "metrics");
    return `/deals?${params}`;
  }, [searchParams]);

  // Vista guardada actual (6.4h): en la lista guardamos embudo + etapa + vista +
  // condiciones. Params crudos para que coincidan con lo que reaplica la vista.
  const savedViewCurrent = {
    conditions,
    pipeline: searchParams.get("pipeline") ?? undefined,
    stage: searchParams.get("stage") ?? undefined,
    view: "list",
  };

  function replaceParams(next: {
    q?: string;
    pipeline?: string;
    stage?: string;
    status?: string;
    sort?: string;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "list");

    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }

    if (next.pipeline !== undefined) params.delete("stage");
    if (params.get("status") === "open") params.delete("status");
    if (params.get("sort") === "recent") params.delete("sort");

    router.replace(`/deals${params.size ? `?${params}` : ""}`);
  }

  function onSearchChange(value: string) {
    setSearch(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => replaceParams({ q: value }), 300);
  }

  function toggleSelect(id: string) {
    if (!selectableIdSet.has(id) || bulkBusy) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    if (selectableIds.length === 0 || bulkBusy) return;
    setSelected((prev) => {
      const next = new Set(prev);
      const shouldClear = selectableIds.every((id) => next.has(id));
      for (const id of selectableIds) {
        if (shouldClear) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function enrollSelected(sequenceId: string) {
    if (bulkBusy) return;
    const dealIds = selectedVisibleIds;
    if (dealIds.length === 0) {
      toast.error("Selecciona al menos un contacto visible.");
      return;
    }

    setBulkBusy(true);
    try {
      const result = await bulkEnrollDeals(dealIds, sequenceId);
      toast.success(enrollmentMessage(result));
      clearSelection();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo inscribir",
      );
    } finally {
      setBulkBusy(false);
    }
  }

  async function win(id: string) {
    try {
      await setDealWon(id);
      toast.success("Negocio ganado");
      router.refresh();
    } catch {
      toast.error("No se pudo actualizar");
    }
  }

  async function reopen(id: string) {
    try {
      await reopenDeal(id);
      toast.success("Negocio reabierto");
      router.refresh();
    } catch {
      toast.error("No se pudo actualizar");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      await deleteDeal(deleting.id);
      toast.success("Negocio eliminado");
      setDeleting(null);
      router.refresh();
    } catch {
      toast.error("No se pudo eliminar");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <SavedViewsBar
        entityType="deal"
        basePath="/deals"
        views={savedViews}
        current={savedViewCurrent}
      />

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative w-full sm:max-w-xs">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Buscar negocio, contacto o empresa…"
              className="pl-9"
            />
          </div>

          <PipelineCombobox
            pipelines={pipelines}
            value={filters.pipelineId}
            onSelect={(id) => replaceParams({ pipeline: id })}
          />

          <select
            className={selectClass}
            value={filters.stageId}
            onChange={(event) => replaceParams({ stage: event.target.value })}
            aria-label="Etapa"
          >
            <option value="">Todas las etapas</option>
            {activeStages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </select>

          <select
            className={selectClass}
            value={filters.status}
            onChange={(event) => replaceParams({ status: event.target.value })}
            aria-label="Estado"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            className={selectClass}
            value={filters.sort}
            onChange={(event) => replaceParams({ sort: event.target.value })}
            aria-label="Orden"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className="shrink-0"
            render={<Link href={boardHref} />}
          >
            <Columns3 />
            Kanban
          </Button>
          <Button variant="secondary" className="shrink-0" aria-current="page">
            <List />
            Lista
          </Button>
          <Button
            variant="outline"
            className="shrink-0"
            render={<Link href={metricsHref} />}
          >
            <BarChart3 />
            Métricas
          </Button>
          <Button
            className="shrink-0"
            onClick={() => setCreateOpen(true)}
            disabled={!filters.pipelineId || activeStages.length === 0}
          >
            <Plus />
            Nuevo negocio
          </Button>
        </div>
      </div>

      <ContactFiltersBar
        conditions={conditions}
        customFieldDefs={customFieldDefs}
        basePath="/deals"
      />

      <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span>
          <span className="text-foreground font-semibold tabular-nums">
            {deals.length}
          </span>{" "}
          {deals.length === 1 ? "negocio" : "negocios"}
        </span>
        <span>
          <span className="text-foreground font-semibold tabular-nums">
            {formatMoney(total)}
          </span>{" "}
          visibles
        </span>
        <span>
          Previsión{" "}
          <span className="text-foreground font-semibold tabular-nums">
            {formatMoney(Math.round(forecast))}
          </span>
        </span>
      </div>

      {selectedVisibleIds.length > 0 ? (
        <div className="bg-card sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border p-2 shadow-xs">
          <span className="inline-flex items-center gap-2 text-sm font-medium">
            <UserPlus className="size-4" />
            {selectedContactCount} contacto
            {selectedContactCount === 1 ? "" : "s"} seleccionado
            {selectedContactCount === 1 ? "" : "s"}
          </span>
          <select
            className={`${selectClass} h-8`}
            value=""
            disabled={bulkBusy || sequenceOptions.length === 0}
            aria-label="Añadir contactos seleccionados a secuencia"
            onChange={(event) => {
              const value = event.target.value;
              if (value) void enrollSelected(value);
            }}
          >
            <option value="">
              {sequenceOptions.length > 0
                ? "Añadir a secuencia…"
                : "Sin secuencias activas"}
            </option>
            {sequenceOptions.map((sequence) => (
              <option key={sequence.id} value={sequence.id}>
                {sequence.name}
              </option>
            ))}
          </select>
          <Button
            variant="ghost"
            size="sm"
            disabled={bulkBusy}
            onClick={clearSelection}
          >
            Limpiar
          </Button>
        </div>
      ) : null}

      {deals.length === 0 ? (
        <EmptyState
          hasFilter={Boolean(
            filters.query ||
            filters.stageId ||
            filters.status !== "open" ||
            filters.sort !== "recent",
          )}
          onCreate={() => setCreateOpen(true)}
          canCreate={Boolean(filters.pipelineId && activeStages.length > 0)}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="bg-muted/40 text-muted-foreground border-b text-left text-xs">
                  <th className="w-10 px-4 py-2.5">
                    <Checkbox
                      checked={allVisibleSelected}
                      disabled={selectableIds.length === 0 || bulkBusy}
                      aria-label="Seleccionar todos los contactos visibles"
                      onCheckedChange={toggleAllVisible}
                    />
                  </th>
                  <th className="px-4 py-2.5 font-medium">Negocio</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
                  <th className="px-4 py-2.5 font-medium">Etapa</th>
                  <th className="px-4 py-2.5 font-medium">Contacto</th>
                  <th className="px-4 py-2.5 font-medium">Empresa</th>
                  <th className="px-4 py-2.5 text-right font-medium">Valor</th>
                  <th className="px-4 py-2.5 font-medium">Cierre</th>
                  <th className="w-12 px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {deals.map((deal) => (
                  <tr
                    key={deal.id}
                    className="hover:bg-muted/30 border-b transition-colors last:border-0"
                  >
                    <td className="px-4 py-2.5">
                      <Checkbox
                        checked={selected.has(deal.id)}
                        disabled={!deal.personId || bulkBusy}
                        aria-label={
                          deal.person?.name
                            ? `Seleccionar ${deal.person.name}`
                            : "Seleccionar contacto del negocio"
                        }
                        onCheckedChange={() => toggleSelect(deal.id)}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        prefetch={false}
                        href={`/deals/${deal.id}`}
                        className="block min-w-0"
                      >
                        <span className="block truncate font-medium">
                          {deal.title}
                        </span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {deal.pipeline.name}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={deal.status} />
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="block truncate">{deal.stage.name}</span>
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {deal.stage.probability}%
                        {deal.rotting ? " · estancado" : ""}
                      </span>
                    </td>
                    <td className="text-muted-foreground px-4 py-2.5">
                      {deal.person ? (
                        <Link
                          href={`/contacts/${deal.person.id}`}
                          className="hover:text-foreground inline-flex max-w-40 items-center gap-1.5 truncate"
                        >
                          <User className="size-3.5 shrink-0" />
                          <span className="truncate">{deal.person.name}</span>
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="text-muted-foreground px-4 py-2.5">
                      {deal.organization ? (
                        <Link
                          href={`/organizations/${deal.organization.id}`}
                          className="hover:text-foreground inline-flex max-w-44 items-center gap-1.5 truncate"
                        >
                          <Building2 className="size-3.5 shrink-0" />
                          <span className="truncate">
                            {deal.organization.name}
                          </span>
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                      {formatMoney(deal.value, deal.currency)}
                    </td>
                    <td className="text-muted-foreground px-4 py-2.5">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="size-3.5" />
                        {formatDate(deal.expectedCloseDate)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <RowActions
                        deal={deal}
                        onEdit={() => setEditing(toInitial(deal))}
                        onWin={() => win(deal.id)}
                        onLose={() => setLost(deal)}
                        onReopen={() => reopen(deal.id)}
                        onDelete={() => setDeleting(deal)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <DealFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        pipelines={pipelines}
        stagesByPipeline={stagesByPipeline}
        persons={persons}
        organizations={organizations}
        defaultPipelineId={filters.pipelineId}
        defaultStageId={filters.stageId || activeStages[0]?.id}
      />

      <DealFormDialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        deal={editing}
        pipelines={pipelines}
        stagesByPipeline={stagesByPipeline}
        persons={persons}
        organizations={organizations}
      />

      <LostDialog deal={lost} onClose={() => setLost(null)} />

      <Dialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>¿Eliminar negocio?</DialogTitle>
            <DialogDescription>
              Se eliminará{" "}
              <span className="text-foreground font-medium">
                {deleting?.title}
              </span>
              . Podrás recuperarlo más adelante (borrado reversible).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Eliminando…" : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function enrollmentMessage(
  result: Awaited<ReturnType<typeof bulkEnrollDeals>>,
) {
  if (result.enrolled > 0) {
    return `${result.enrolled} contacto${result.enrolled === 1 ? "" : "s"} inscrito${result.enrolled === 1 ? "" : "s"} en la secuencia`;
  }
  if (result.alreadyEnrolled > 0) {
    return "Los contactos seleccionados ya estaban en la secuencia";
  }
  if (result.skippedNoEmail > 0) {
    return "Ningún contacto seleccionable tiene email válido";
  }
  if (result.skippedNotSubscribed > 0 || result.skippedSuppressed > 0) {
    return "Los contactos seleccionados no cumplen consentimiento o supresión";
  }
  return "No se pudo inscribir ningún contacto";
}

function StatusBadge({ status }: { status: DealStatus }) {
  const meta = statusMeta[status];
  return (
    <Badge variant="secondary" className={meta.className}>
      {meta.label}
    </Badge>
  );
}

function RowActions({
  deal,
  onEdit,
  onWin,
  onLose,
  onReopen,
  onDelete,
}: {
  deal: DealListItem;
  onEdit: () => void;
  onWin: () => void;
  onLose: () => void;
  onReopen: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label="Acciones" />}
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem render={<Link href={`/deals/${deal.id}`} />}>
          <List />
          Ver ficha
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onEdit}>
          <Pencil />
          Editar
        </DropdownMenuItem>
        {deal.status === "open" ? (
          <>
            <DropdownMenuItem onClick={onWin}>
              <Trophy />
              Marcar ganado
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onLose}>
              <X />
              Marcar perdido
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem onClick={onReopen}>
            <RotateCcw />
            Reabrir
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 />
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LostDialog({
  deal,
  onClose,
}: {
  deal: DealListItem | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={Boolean(deal)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false}>
        {deal ? <LostBody deal={deal} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function LostBody({
  deal,
  onClose,
}: {
  deal: DealListItem;
  onClose: () => void;
}) {
  const router = useRouter();
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await setDealLost(deal.id, reason);
      toast.success("Negocio marcado como perdido");
      onClose();
      router.refresh();
    } catch {
      toast.error("No se pudo actualizar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Marcar como perdido</DialogTitle>
        <DialogDescription>
          Opcional: indica el motivo de la pérdida para tus informes.
        </DialogDescription>
      </DialogHeader>
      <Input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Precio, competencia, sin presupuesto…"
        autoFocus
      />
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>
          Cancelar
        </DialogClose>
        <Button variant="destructive" onClick={confirm} disabled={busy}>
          {busy ? "Guardando…" : "Marcar perdido"}
        </Button>
      </DialogFooter>
    </>
  );
}

function EmptyState({
  hasFilter,
  canCreate,
  onCreate,
}: {
  hasFilter: boolean;
  canCreate: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
      <div className="bg-primary/10 text-primary mb-4 flex size-12 items-center justify-center rounded-xl">
        <List className="size-6" />
      </div>
      <h3 className="font-medium">
        {hasFilter ? "Sin resultados" : "Aún no tienes negocios"}
      </h3>
      <p className="text-muted-foreground mt-1 max-w-xs text-sm">
        {hasFilter
          ? "Prueba con otros filtros."
          : "Crea tu primer negocio para empezar a medir tu cartera."}
      </p>
      {!hasFilter && canCreate ? (
        <Button onClick={onCreate} className="mt-4">
          <Plus />
          Nuevo negocio
        </Button>
      ) : null}
    </div>
  );
}

function toInitial(deal: DealListItem): DealInitial {
  return {
    id: deal.id,
    title: deal.title,
    value: deal.value,
    currency: deal.currency,
    pipelineId: deal.pipelineId,
    stageId: deal.stageId,
    personId: deal.personId,
    orgId: deal.orgId,
    expectedCloseDate: deal.expectedCloseDate,
  };
}
