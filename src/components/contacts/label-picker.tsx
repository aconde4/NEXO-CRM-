"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Tag } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { createLabel, togglePersonLabel } from "@/server/actions/labels";
import { LabelChips, type LabelChip } from "@/components/label-chips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#06b6d4",
  "#3b82f6",
  "#64748b",
];

export function LabelPicker({
  personId,
  allLabels,
  assigned,
}: {
  personId: string;
  allLabels: LabelChip[];
  assigned: LabelChip[];
}) {
  const router = useRouter();
  const [labels, setLabels] = React.useState(allLabels);
  const [assignedIds, setAssignedIds] = React.useState(
    () => new Set(assigned.map((l) => l.id)),
  );
  const [pending, startTransition] = React.useTransition();
  const [newName, setNewName] = React.useState("");
  const [newColor, setNewColor] = React.useState(COLORS[0]!);

  const assignedLabels = labels.filter((l) => assignedIds.has(l.id));

  function toggle(labelId: string) {
    setAssignedIds((prev) => {
      const next = new Set(prev);
      if (next.has(labelId)) next.delete(labelId);
      else next.add(labelId);
      return next;
    });
    startTransition(async () => {
      try {
        await togglePersonLabel(personId, labelId);
        router.refresh();
      } catch {
        toast.error("No se pudo actualizar la etiqueta");
      }
    });
  }

  async function create() {
    const name = newName.trim();
    if (!name) return;
    try {
      const label = await createLabel({ name, color: newColor });
      setLabels((prev) =>
        [...prev, label].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setNewName("");
      setAssignedIds((prev) => new Set(prev).add(label.id));
      startTransition(async () => {
        await togglePersonLabel(personId, label.id);
        router.refresh();
      });
      toast.success("Etiqueta creada");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo crear la etiqueta",
      );
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <LabelChips labels={assignedLabels} />
      <Popover>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className="h-6 gap-1 px-2 text-xs"
            />
          }
        >
          <Tag className="size-3" />
          {assignedLabels.length ? "Editar" : "Añadir etiqueta"}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64">
          <div className="space-y-1">
            <p className="text-muted-foreground px-1 text-xs font-medium">
              Etiquetas
            </p>
            <div className="max-h-44 space-y-0.5 overflow-y-auto">
              {labels.length === 0 ? (
                <p className="text-muted-foreground px-1 py-2 text-xs">
                  Aún no hay etiquetas. Crea una abajo.
                </p>
              ) : (
                labels.map((label) => (
                  <button
                    key={label.id}
                    type="button"
                    onClick={() => toggle(label.id)}
                    className="hover:bg-muted flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-sm transition-colors"
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: label.color }}
                    />
                    <span className="flex-1 truncate text-left">
                      {label.name}
                    </span>
                    {assignedIds.has(label.id) ? (
                      <Check className="text-primary size-3.5" />
                    ) : null}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="space-y-2 border-t pt-2.5">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nueva etiqueta…"
              className="h-8"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void create();
                }
              }}
            />
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewColor(color)}
                    className={cn(
                      "ring-ring size-4 rounded-full ring-offset-1 transition",
                      newColor === color && "ring-2",
                    )}
                    style={{ backgroundColor: color }}
                    aria-label={`Color ${color}`}
                  />
                ))}
              </div>
              <Button
                size="sm"
                className="h-7"
                onClick={() => void create()}
                disabled={!newName.trim() || pending}
              >
                <Plus className="size-3.5" />
                Crear
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
