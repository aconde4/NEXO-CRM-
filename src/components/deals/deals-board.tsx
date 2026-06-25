"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Building2,
  Columns3,
  List,
  MoreHorizontal,
  Plus,
  Trophy,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";

import type { ContactFilterCondition } from "@/lib/contact-filters";
import type { CustomFieldDef } from "@/lib/custom-fields";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  bulkAddLabelToDeals,
  bulkEnrollDeals,
  bulkMoveDeals,
  bulkRemoveDealsFromFunnel,
  deleteDeal,
  loadContactsIntoFunnel,
  moveDeal,
  setDealLost,
  setDealWon,
} from "@/server/actions/deals";
import type { Board, BoardColumn, DealCard } from "@/server/queries/deals";
import type { SavedView } from "@/server/queries/saved-views";
import {
  DealFormDialog,
  type DealInitial,
  type Option,
} from "@/components/deals/deal-form-dialog";
import { Button } from "@/components/ui/button";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ContactFiltersBar } from "@/components/contacts/contact-filters-bar";
import { SavedViewsBar } from "@/components/saved-views/saved-views-bar";

const selectClass =
  "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-9 shrink-0 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none transition focus-visible:ring-[3px]";

type Col = { stage: BoardColumn["stage"]; deals: DealCard[] };

const COL_PREFIX = "stage:";

export function DealsBoard({
  board,
  persons,
  organizations,
  stagesByPipeline,
  conditions,
  customFieldDefs,
  labels,
  sequenceOptions,
  savedViews,
}: {
  board: Board;
  persons: Option[];
  organizations: Option[];
  stagesByPipeline: Record<string, Option[]>;
  conditions: ContactFilterCondition[];
  customFieldDefs: CustomFieldDef[];
  labels: Option[];
  sequenceOptions: Option[];
  savedViews: SavedView[];
}) {
  const router = useRouter();
  const [cols, setCols] = React.useState<Col[]>(() =>
    board.columns.map((c) => ({ stage: c.stage, deals: [...c.deals] })),
  );
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<DealInitial | null>(null);
  const [createStageId, setCreateStageId] = React.useState<string | null>(null);
  const [lost, setLost] = React.useState<DealCard | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = React.useState(false);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function clearSelection() {
    setSelected(new Set());
  }
  async function runBulk(fn: () => Promise<unknown>, okMsg: string) {
    if (bulkBusy) return;
    setBulkBusy(true);
    try {
      await fn();
      toast.success(okMsg);
      clearSelection();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo completar",
      );
    } finally {
      setBulkBusy(false);
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const searchParams = useSearchParams();
  const pipelineId = board.activePipelineId ?? "";

  // Navega dentro de /deals preservando el resto de parámetros (filtro, etc.).
  function dealsHref(overrides: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(overrides)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    return `/deals${qs ? `?${qs}` : ""}`;
  }
  const listHref = dealsHref({ view: "list" });

  // Vista guardada actual (6.4h): en Kanban guardamos embudo + condiciones (la etapa
  // son las columnas; la vista por defecto es el tablero). Usamos el param crudo para
  // que el tablero por defecto cuente como "sin filtro".
  const savedViewCurrent = {
    conditions,
    pipeline: searchParams.get("pipeline") ?? undefined,
  };

  const activeDeal = activeId
    ? (cols.flatMap((c) => c.deals).find((d) => d.id === activeId) ?? null)
    : null;

  function colOf(id: string): number {
    if (id.startsWith(COL_PREFIX)) {
      const sid = id.slice(COL_PREFIX.length);
      return cols.findIndex((c) => c.stage.id === sid);
    }
    return cols.findIndex((c) => c.deals.some((d) => d.id === id));
  }

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function onDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);
    const from = colOf(activeIdStr);
    const to = colOf(overIdStr);
    if (from === -1 || to === -1 || from === to) return;

    setCols((prev) => {
      const next = prev.map((c) => ({ ...c, deals: [...c.deals] }));
      const fromDeals = next[from]!.deals;
      const idx = fromDeals.findIndex((d) => d.id === activeIdStr);
      if (idx === -1) return prev;
      const [moved] = fromDeals.splice(idx, 1);
      if (!moved) return prev;
      const toDeals = next[to]!.deals;
      const overIdx = overIdStr.startsWith(COL_PREFIX)
        ? toDeals.length
        : toDeals.findIndex((d) => d.id === overIdStr);
      toDeals.splice(overIdx < 0 ? toDeals.length : overIdx, 0, {
        ...moved,
        stageId: next[to]!.stage.id,
      });
      return next;
    });
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;
    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);
    const to = colOf(overIdStr);
    const from = colOf(activeIdStr);
    if (to === -1 || from === -1) return;

    let finalIndex = 0;
    setCols((prev) => {
      const next = prev.map((c) => ({ ...c, deals: [...c.deals] }));
      const toDeals = next[to]!.deals;
      const oldIndex = toDeals.findIndex((d) => d.id === activeIdStr);
      const overIndex = overIdStr.startsWith(COL_PREFIX)
        ? toDeals.length - 1
        : toDeals.findIndex((d) => d.id === overIdStr);
      if (oldIndex !== -1 && overIndex !== -1 && oldIndex !== overIndex) {
        next[to]!.deals = arrayMove(toDeals, oldIndex, overIndex);
      }
      finalIndex = Math.max(
        0,
        next[to]!.deals.findIndex((d) => d.id === activeIdStr),
      );
      return next;
    });

    const toStageId = cols[to]!.stage.id;
    void persist(activeIdStr, toStageId, finalIndex);
  }

  async function persist(dealId: string, toStageId: string, index: number) {
    try {
      await moveDeal(dealId, toStageId, index);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo mover el negocio",
      );
      router.refresh();
    }
  }

  async function win(id: string) {
    try {
      await setDealWon(id);
      setCols((prev) =>
        prev.map((c) => ({ ...c, deals: c.deals.filter((d) => d.id !== id) })),
      );
      toast.success("Negocio marcado como ganado 🎉");
      router.refresh();
    } catch {
      toast.error("No se pudo actualizar");
    }
  }

  const [loadingContacts, setLoadingContacts] = React.useState(false);
  const hasFilter = conditions.length > 0;
  async function loadContacts() {
    setLoadingContacts(true);
    try {
      const { created } = await loadContactsIntoFunnel(
        hasFilter ? conditions : undefined,
      );
      const scope = hasFilter ? " (del filtro)" : "";
      toast.success(
        created > 0
          ? `${created} contacto(s)${scope} añadidos a Cargadas`
          : `Todos los contactos${scope} ya están en el embudo`,
      );
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudieron cargar",
      );
    } finally {
      setLoadingContacts(false);
    }
  }

  async function remove(id: string) {
    try {
      await deleteDeal(id);
      setCols((prev) =>
        prev.map((c) => ({ ...c, deals: c.deals.filter((d) => d.id !== id) })),
      );
      toast.success("Negocio eliminado");
      router.refresh();
    } catch {
      toast.error("No se pudo eliminar");
    }
  }

  const totalCount = cols.reduce((a, c) => a + c.deals.length, 0);
  const totalSum = cols.reduce(
    (a, c) => a + c.deals.reduce((s, d) => s + d.value, 0),
    0,
  );
  const forecast = cols.reduce(
    (a, c) =>
      a +
      c.deals.reduce((s, d) => s + d.value * (c.stage.probability / 100), 0),
    0,
  );

  return (
    <>
      <SavedViewsBar
        entityType="deal"
        basePath="/deals"
        views={savedViews}
        current={savedViewCurrent}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <select
            className={cn(selectClass, "max-w-[12rem] truncate")}
            value={pipelineId}
            onChange={(e) =>
              router.push(dealsHref({ pipeline: e.target.value }))
            }
            aria-label="Embudo"
          >
            {board.pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <div className="text-muted-foreground hidden gap-3 text-xs sm:flex">
            <span>
              <span className="text-foreground font-semibold tabular-nums">
                {totalCount}
              </span>{" "}
              negocios
            </span>
            <span>
              <span className="text-foreground font-semibold tabular-nums">
                {formatMoney(totalSum)}
              </span>{" "}
              en juego
            </span>
            <span>
              Previsión{" "}
              <span className="text-foreground font-semibold tabular-nums">
                {formatMoney(Math.round(forecast))}
              </span>
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" className="shrink-0" aria-current="page">
            <Columns3 />
            Kanban
          </Button>
          <Button
            variant="outline"
            className="shrink-0"
            render={<Link href={listHref} />}
          >
            <List />
            Lista
          </Button>
          <Button
            variant="outline"
            className="shrink-0"
            onClick={loadContacts}
            disabled={loadingContacts}
          >
            <User />
            {loadingContacts
              ? "Cargando…"
              : hasFilter
                ? "Cargar filtrados"
                : "Cargar contactos"}
          </Button>
          <Button
            className="shrink-0"
            onClick={() => setCreateStageId(cols[0]?.stage.id ?? "")}
            disabled={cols.length === 0}
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

      {selected.size > 0 ? (
        <div className="bg-card sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border p-2 shadow-xs">
          <span className="text-sm font-medium">
            {selected.size} seleccionado{selected.size === 1 ? "" : "s"}
          </span>
          <select
            className={`${selectClass} h-8`}
            value=""
            disabled={bulkBusy}
            onChange={(e) => {
              const v = e.target.value;
              if (v)
                void runBulk(
                  () => bulkMoveDeals([...selected], v),
                  "Tarjetas movidas de etapa",
                );
            }}
          >
            <option value="">Mover a…</option>
            {(stagesByPipeline[pipelineId] ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {labels.length > 0 ? (
            <select
              className={`${selectClass} h-8`}
              value=""
              disabled={bulkBusy}
              onChange={(e) => {
                const v = e.target.value;
                if (v)
                  void runBulk(
                    () => bulkAddLabelToDeals([...selected], v),
                    "Etiqueta añadida a los contactos",
                  );
              }}
            >
              <option value="">Etiquetar…</option>
              {labels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          ) : null}
          {sequenceOptions.length > 0 ? (
            <select
              className={`${selectClass} h-8`}
              value=""
              disabled={bulkBusy}
              onChange={(e) => {
                const v = e.target.value;
                if (v)
                  void runBulk(
                    () => bulkEnrollDeals([...selected], v),
                    "Contactos inscritos en la secuencia",
                  );
              }}
            >
              <option value="">Inscribir en…</option>
              {sequenceOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            disabled={bulkBusy}
            onClick={() =>
              void runBulk(
                () => bulkRemoveDealsFromFunnel([...selected]),
                "Tarjetas quitadas del embudo",
              )
            }
          >
            Quitar del embudo
          </Button>
          <Button variant="ghost" size="sm" onClick={clearSelection}>
            Limpiar
          </Button>
        </div>
      ) : null}

      {cols.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <p className="text-muted-foreground text-sm">
            Este embudo no tiene etapas. Añádelas en{" "}
            <Link href="/settings" className="text-primary hover:underline">
              Ajustes
            </Link>
            .
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
          <div className="flex gap-3 overflow-x-auto pb-2">
            {cols.map((col) => (
              <Column
                key={col.stage.id}
                col={col}
                selected={selected}
                onToggleSelect={toggleSelect}
                onAdd={() => setCreateStageId(col.stage.id)}
                onEdit={(d) => setEditing(toInitial(d, pipelineId))}
                onWin={win}
                onLose={(d) => setLost(d)}
                onDelete={remove}
              />
            ))}
          </div>

          <DragOverlay>
            {activeDeal ? <CardBody deal={activeDeal} dragging /> : null}
          </DragOverlay>
        </DndContext>
      )}

      <DealFormDialog
        open={Boolean(createStageId)}
        onOpenChange={(o) => !o && setCreateStageId(null)}
        pipelines={board.pipelines}
        stagesByPipeline={stagesByPipeline}
        persons={persons}
        organizations={organizations}
        defaultPipelineId={pipelineId}
        defaultStageId={createStageId ?? undefined}
      />

      <DealFormDialog
        open={Boolean(editing)}
        onOpenChange={(o) => !o && setEditing(null)}
        deal={editing}
        pipelines={board.pipelines}
        stagesByPipeline={stagesByPipeline}
        persons={persons}
        organizations={organizations}
      />

      <LostDialog
        deal={lost}
        onClose={() => setLost(null)}
        onConfirm={() =>
          setCols((prev) =>
            lost
              ? prev.map((c) => ({
                  ...c,
                  deals: c.deals.filter((d) => d.id !== lost.id),
                }))
              : prev,
          )
        }
      />
    </>
  );
}

function toInitial(d: DealCard, pipelineId: string): DealInitial {
  return {
    id: d.id,
    title: d.title,
    value: d.value,
    currency: d.currency,
    pipelineId,
    stageId: d.stageId,
    personId: d.person?.id ?? null,
    orgId: d.organization?.id ?? null,
    expectedCloseDate: d.expectedCloseDate,
  };
}

function Column({
  col,
  selected,
  onToggleSelect,
  onAdd,
  onEdit,
  onWin,
  onLose,
  onDelete,
}: {
  col: Col;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onAdd: () => void;
  onEdit: (deal: DealCard) => void;
  onWin: (id: string) => void;
  onLose: (deal: DealCard) => void;
  onDelete: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${COL_PREFIX}${col.stage.id}`,
  });
  const total = col.deals.reduce((s, d) => s + d.value, 0);

  return (
    <div className="bg-muted/40 flex w-72 shrink-0 flex-col rounded-xl">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{col.stage.name}</p>
          <p className="text-muted-foreground text-xs tabular-nums">
            {col.deals.length} · {formatMoney(total)}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Añadir negocio"
          onClick={onAdd}
        >
          <Plus className="size-4" />
        </Button>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2 transition-colors",
          isOver && "bg-primary/5 rounded-b-xl",
        )}
      >
        <SortableContext
          items={col.deals.map((d) => d.id)}
          strategy={verticalListSortingStrategy}
        >
          {col.deals.map((deal) => (
            <SortableCard
              key={deal.id}
              deal={deal}
              selected={selected.has(deal.id)}
              onToggleSelect={() => onToggleSelect(deal.id)}
              onEdit={() => onEdit(deal)}
              onWin={() => onWin(deal.id)}
              onLose={() => onLose(deal)}
              onDelete={() => onDelete(deal.id)}
            />
          ))}
        </SortableContext>
        {col.deals.length === 0 ? (
          <p className="text-muted-foreground/60 px-2 py-6 text-center text-xs">
            Arrastra aquí
          </p>
        ) : null}
      </div>
    </div>
  );
}

function SortableCard({
  deal,
  selected,
  onToggleSelect,
  onEdit,
  onWin,
  onLose,
  onDelete,
}: {
  deal: DealCard;
  selected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onWin: () => void;
  onLose: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: deal.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("touch-none", isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
    >
      <CardBody
        deal={deal}
        selected={selected}
        onToggleSelect={onToggleSelect}
        onEdit={onEdit}
        onWin={onWin}
        onLose={onLose}
        onDelete={onDelete}
      />
    </div>
  );
}

function CardBody({
  deal,
  dragging,
  selected,
  onToggleSelect,
  onEdit,
  onWin,
  onLose,
  onDelete,
}: {
  deal: DealCard;
  dragging?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onEdit?: () => void;
  onWin?: () => void;
  onLose?: () => void;
  onDelete?: () => void;
}) {
  // Embudo de contactos (6.4c): empresa como título, contacto debajo.
  const title = deal.organization?.name ?? deal.title;
  const contact = deal.person?.name ?? null;

  return (
    <div
      className={cn(
        "bg-card group cursor-grab rounded-lg border p-2.5 shadow-xs active:cursor-grabbing",
        dragging && "rotate-2 shadow-md",
        selected && "ring-primary/50 border-primary/50 ring-2",
        deal.rotting && "border-destructive/40",
      )}
    >
      <div className="flex items-start gap-1.5">
        {onToggleSelect ? (
          <span
            className="mt-0.5 shrink-0"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={Boolean(selected)}
              onCheckedChange={() => onToggleSelect()}
              aria-label="Seleccionar tarjeta"
            />
          </span>
        ) : null}
        <Link href={`/deals/${deal.id}`} className="min-w-0 flex-1 text-left">
          <p className="flex items-center gap-1 truncate text-sm font-medium">
            <Building2 className="text-muted-foreground size-3.5 shrink-0" />
            {title}
          </p>
          {contact ? (
            <p className="text-muted-foreground mt-1 flex items-center gap-1 truncate text-xs">
              <User className="size-3 shrink-0" />
              {contact}
            </p>
          ) : null}
        </Link>
        {onEdit ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Acciones"
                  className="opacity-0 transition-opacity group-hover:opacity-100 data-[popup-open]:opacity-100"
                />
              }
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>Editar</DropdownMenuItem>
              <DropdownMenuItem onClick={onWin}>
                <Trophy />
                Marcar ganado
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onLose}>
                <X />
                Marcar perdido
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {deal.rotting ? (
        <p className="text-destructive mt-1.5 text-xs font-medium">Estancado</p>
      ) : null}
    </div>
  );
}

function LostDialog({
  deal,
  onClose,
  onConfirm,
}: {
  deal: DealCard | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={Boolean(deal)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent showCloseButton={false}>
        {deal ? (
          <LostBody deal={deal} onClose={onClose} onConfirm={onConfirm} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function LostBody({
  deal,
  onClose,
  onConfirm,
}: {
  deal: DealCard;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const router = useRouter();
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await setDealLost(deal.id, reason);
      onConfirm();
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
        onChange={(e) => setReason(e.target.value)}
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
