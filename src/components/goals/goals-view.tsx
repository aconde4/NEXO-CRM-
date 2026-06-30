"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Goal, Pencil, Plus, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { formatMoney } from "@/lib/format";
import {
  GOAL_METRICS,
  GOAL_PERIODS,
  goalMetricFormat,
  goalMetricLabel,
  goalPeriodLabel,
} from "@/lib/goals";
import { cn } from "@/lib/utils";
import type { GoalMetric, GoalPeriod } from "@/server/db/schema";
import { deleteGoal, saveGoal } from "@/server/actions/goals";
import type { GoalWithProgress } from "@/server/queries/goals";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Label } from "@/components/ui/label";

const selectClass =
  "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none transition focus-visible:ring-[3px]";

const numberFmt = new Intl.NumberFormat("es-ES");

function formatMetricValue(metric: GoalMetric, value: number): string {
  return goalMetricFormat(metric) === "money"
    ? formatMoney(Math.round(value))
    : numberFmt.format(Math.round(value));
}

export function GoalsView({ goals }: { goals: GoalWithProgress[] }) {
  const [dialog, setDialog] = React.useState<{
    goal: GoalWithProgress | null;
  } | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialog({ goal: null })}>
          <Plus />
          Nuevo objetivo
        </Button>
      </div>

      {goals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="bg-muted flex size-12 items-center justify-center rounded-full">
              <Goal className="text-muted-foreground size-6" />
            </div>
            <div>
              <p className="text-sm font-medium">Aún no tienes objetivos</p>
              <p className="text-muted-foreground text-sm">
                Define metas de ingresos, pipeline, actividad o comunicación y
                sigue su progreso cada periodo.
              </p>
            </div>
            <Button variant="outline" onClick={() => setDialog({ goal: null })}>
              <Plus />
              Crear el primero
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onEdit={() => setDialog({ goal })}
            />
          ))}
        </div>
      )}

      {dialog ? (
        <GoalDialog
          key={dialog.goal?.id ?? "new-goal"}
          goal={dialog.goal}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  );
}

function GoalCard({
  goal,
  onEdit,
}: {
  goal: GoalWithProgress;
  onEdit: () => void;
}) {
  const reached = goal.progress >= 100;
  const barWidth = Math.max(2, Math.min(100, goal.progress));

  return (
    <Card className="gap-0 py-0">
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {goal.name?.trim() || goalMetricLabel(goal.metric)}
            </p>
            <p className="text-muted-foreground text-xs">
              {goalMetricLabel(goal.metric)} · {goalPeriodLabel(goal.period)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Editar objetivo"
            onClick={onEdit}
          >
            <Pencil className="size-4" />
          </Button>
        </div>

        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="font-semibold tabular-nums">
            {formatMetricValue(goal.metric, goal.actual)}
          </span>
          <span className="text-muted-foreground text-xs tabular-nums">
            de {formatMetricValue(goal.metric, goal.target)}
          </span>
        </div>

        <div className="bg-muted h-2.5 overflow-hidden rounded-full">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              reached ? "bg-emerald-500" : "bg-primary/80",
            )}
            style={{ width: `${barWidth}%` }}
          />
        </div>

        <p
          className={cn(
            "text-xs tabular-nums",
            reached
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-muted-foreground",
          )}
        >
          {goal.progress}% del objetivo
          {reached ? " · ¡conseguido! 🎉" : ""}
        </p>
      </CardContent>
    </Card>
  );
}

function GoalDialog({
  goal,
  onClose,
}: {
  goal: GoalWithProgress | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [metric, setMetric] = React.useState<GoalMetric>(
    goal?.metric ?? "revenue_won",
  );
  const [period, setPeriod] = React.useState<GoalPeriod>(
    goal?.period ?? "month",
  );
  const [name, setName] = React.useState(goal?.name ?? "");
  const [target, setTarget] = React.useState(
    goal ? String(goal.target) : "",
  );
  const [busy, setBusy] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const targetNumber = Number(target.replace(",", "."));
    if (!Number.isFinite(targetNumber) || targetNumber <= 0) {
      toast.error("Indica un objetivo mayor que 0.");
      return;
    }
    setBusy(true);
    try {
      await saveGoal({
        id: goal?.id,
        metric,
        name,
        period,
        target: targetNumber,
      });
      toast.success(goal ? "Objetivo actualizado" : "Objetivo creado");
      onClose();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo guardar",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!goal) return;
    setBusy(true);
    try {
      await deleteGoal(goal.id);
      toast.success("Objetivo eliminado");
      onClose();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo eliminar",
      );
    } finally {
      setBusy(false);
    }
  }

  const isMoney = goalMetricFormat(metric) === "money";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{goal ? "Editar objetivo" : "Nuevo objetivo"}</DialogTitle>
            <DialogDescription>
              El progreso se calcula con tus datos del periodo en curso.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-1.5">
            <Label>Métrica</Label>
            <select
              className={selectClass}
              value={metric}
              onChange={(event) => setMetric(event.target.value as GoalMetric)}
            >
              {GOAL_METRICS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} ({option.group})
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Periodo</Label>
              <select
                className={selectClass}
                value={period}
                onChange={(event) =>
                  setPeriod(event.target.value as GoalPeriod)
                }
              >
                {GOAL_PERIODS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label>Objetivo {isMoney ? "(€)" : ""}</Label>
              <Input
                type="number"
                min={1}
                step={isMoney ? 100 : 1}
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                placeholder={isMoney ? "10000" : "20"}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Nombre (opcional)</Label>
            <Input
              value={name}
              maxLength={120}
              onChange={(event) => setName(event.target.value)}
              placeholder="p. ej. Cierre Q3"
            />
          </div>

          <DialogFooter className="sm:justify-between">
            {goal ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={busy}
                onClick={remove}
              >
                <Trash2 />
                Eliminar
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <DialogClose render={<Button type="button" variant="outline" />}>
                Cancelar
              </DialogClose>
              <Button type="submit" disabled={busy}>
                <Target />
                {busy ? "Guardando…" : goal ? "Guardar" : "Crear objetivo"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
