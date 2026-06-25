"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Plus, X } from "lucide-react";
import { toast } from "sonner";

import {
  appendContactFilterParams,
  contactFiltersKey,
  type ContactFilterCondition,
} from "@/lib/contact-filters";
import { cn } from "@/lib/utils";
import {
  createSavedView,
  deleteSavedView,
} from "@/server/actions/saved-views";
import type { SavedViewEntity } from "@/server/db/schema";
import type { SavedView } from "@/server/queries/saved-views";
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
import { Input } from "@/components/ui/input";

export type ViewFilters = {
  conditions?: ContactFilterCondition[];
  label?: string;
  q?: string;
  sort?: string;
  // Embudo de Negocios (6.4h): embudo, etapa y vista (kanban/list).
  pipeline?: string;
  stage?: string;
  view?: string;
};

function buildHref(basePath: string, filters: ViewFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.label) params.set("label", filters.label);
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.pipeline) params.set("pipeline", filters.pipeline);
  if (filters.stage) params.set("stage", filters.stage);
  if (filters.view) params.set("view", filters.view);
  appendContactFilterParams(params, filters.conditions ?? []);
  return params.size ? `${basePath}?${params}` : basePath;
}

function sameFilters(a: ViewFilters, b: ViewFilters): boolean {
  return (
    (a.q ?? "") === (b.q ?? "") &&
    (a.label ?? "") === (b.label ?? "") &&
    (a.sort ?? "") === (b.sort ?? "") &&
    (a.pipeline ?? "") === (b.pipeline ?? "") &&
    (a.stage ?? "") === (b.stage ?? "") &&
    (a.view ?? "") === (b.view ?? "") &&
    contactFiltersKey(a.conditions) === contactFiltersKey(b.conditions)
  );
}

export function SavedViewsBar({
  entityType,
  basePath,
  views,
  current,
}: {
  entityType: SavedViewEntity;
  basePath: string;
  views: SavedView[];
  current: ViewFilters;
}) {
  const router = useRouter();
  const [saveOpen, setSaveOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const hasFilters = Boolean(
    current.q ||
      current.label ||
      current.sort ||
      current.pipeline ||
      current.stage ||
      (current.conditions?.length ?? 0) > 0,
  );
  const onDefault = !hasFilters;
  const activeView = views.find((v) => sameFilters(v.filters, current));
  const isNewCombination = hasFilters && !activeView;

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createSavedView({ name, entityType, filters: current });
      toast.success("Vista guardada");
      setSaveOpen(false);
      setName("");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo guardar la vista",
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await deleteSavedView(id);
      toast.success("Vista eliminada");
      router.refresh();
    } catch {
      toast.error("No se pudo eliminar la vista");
    }
  }

  if (views.length === 0 && !hasFilters) return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => router.push(basePath)}
          className={cn(
            "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
            onDefault
              ? "border-primary bg-primary text-primary-foreground"
              : "hover:bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          Todos
        </button>

        {views.map((view) => {
          const active = activeView?.id === view.id;
          return (
            <span
              key={view.id}
              className={cn(
                "group inline-flex items-center gap-1 rounded-full border py-1 pr-1 pl-3 text-sm font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              <button
                type="button"
                onClick={() => router.push(buildHref(basePath, view.filters))}
                className="inline-flex items-center gap-1.5"
              >
                <Bookmark className="size-3" />
                {view.name}
              </button>
              <button
                type="button"
                aria-label={`Eliminar vista ${view.name}`}
                onClick={() => remove(view.id)}
                className={cn(
                  "rounded-full p-0.5 transition-colors",
                  active
                    ? "hover:bg-primary-foreground/20"
                    : "hover:bg-muted-foreground/15",
                )}
              >
                <X className="size-3" />
              </button>
            </span>
          );
        })}

        {isNewCombination ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => setSaveOpen(true)}
          >
            <Plus className="size-3" />
            Guardar vista
          </Button>
        ) : null}
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Guardar vista</DialogTitle>
            <DialogDescription>
              Guarda los filtros actuales para reutilizarlos con un clic.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Leads de Madrid"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void save();
              }
            }}
          />
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button onClick={() => void save()} disabled={saving || !name.trim()}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
