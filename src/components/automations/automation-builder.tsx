"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Bolt,
  Clock,
  GitBranch,
  Plus,
  Save,
  Trash2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import {
  AUTOMATION_ACTIONS,
  AUTOMATION_TRIGGERS,
  CONDITION_OPERATORS,
  type ConditionOperator,
  createNode,
  getActionMeta,
  getTriggerMeta,
  opNeedsValue,
} from "@/lib/automations";
import {
  type AutomationFormValues,
  automationFormSchema,
} from "@/lib/validations/automation";
import type {
  AutomationNode,
  AutomationNodeType,
  AutomationTrigger,
  AutomationTriggerType,
} from "@/server/db/schema/automations";
import type {
  AutomationBuilderOptions,
  AutomationDetail,
  AutomationOption,
} from "@/server/queries/automations";
import { updateAutomation } from "@/server/actions/automations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const selectClass =
  "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none transition focus-visible:ring-[3px]";

const ENTITY_OPTIONS = [
  { value: "person", label: "Contacto" },
  { value: "organization", label: "Empresa" },
  { value: "deal", label: "Negocio" },
];

export function AutomationBuilder({
  automation,
  options,
}: {
  automation: AutomationDetail;
  options: AutomationBuilderOptions;
}) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AutomationFormValues>({
    resolver: zodResolver(automationFormSchema),
    defaultValues: {
      name: automation.name,
      description: automation.description,
      status: automation.status,
    },
  });

  const [trigger, setTrigger] = React.useState<AutomationTrigger | null>(
    automation.trigger ?? null,
  );
  const [nodes, setNodes] = React.useState<AutomationNode[]>(
    automation.graph.nodes ?? [],
  );

  function setTriggerType(type: string) {
    if (!type) return setTrigger(null);
    setTrigger({ config: {}, type: type as AutomationTriggerType });
  }

  function setTriggerConfig(key: string, value: string) {
    setTrigger((prev) =>
      prev ? { ...prev, config: { ...prev.config, [key]: value } } : prev,
    );
  }

  function addNode(type: AutomationNodeType) {
    setNodes((prev) => [...prev, createNode(type)]);
  }

  function updateNode(id: string, next: AutomationNode) {
    setNodes((prev) => prev.map((node) => (node.id === id ? next : node)));
  }

  function removeNode(id: string) {
    setNodes((prev) => prev.filter((node) => node.id !== id));
  }

  function moveNode(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= nodes.length) return;
    const next = [...nodes];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setNodes(next);
  }

  async function onSubmit(values: AutomationFormValues) {
    const edges = nodes.flatMap((node, index) => {
      const next = nodes[index + 1];
      if (!next) return [];
      if (node.type !== "condition") {
        return [
          {
            id: `edge-${node.id}-${next.id}`,
            source: node.id,
            target: next.id,
          },
        ];
      }

      const out = [];
      if (node.config?.trueBranch !== "stop") {
        out.push({
          branch: "true" as const,
          id: `edge-${node.id}-true-${next.id}`,
          source: node.id,
          target: next.id,
        });
      }
      if (node.config?.falseBranch === "continue") {
        out.push({
          branch: "false" as const,
          id: `edge-${node.id}-false-${next.id}`,
          source: node.id,
          target: next.id,
        });
      }
      return out;
    });
    // Normaliza al shape que valida el action (config siempre objeto; sin nodo trigger).
    const graphNodes = nodes.map((node) => ({
      config: node.config ?? {},
      id: node.id,
      kind: node.kind ?? "action",
      type: node.type as "action" | "wait" | "condition",
    }));
    const payloadTrigger = trigger
      ? { config: trigger.config ?? {}, type: trigger.type }
      : null;
    try {
      await updateAutomation(automation.id, {
        name: values.name,
        description: values.description,
        status: values.status,
        trigger: payloadTrigger,
        graph: { edges, nodes: graphNodes },
      });
      toast.success("Automatización guardada");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar");
    }
  }

  const triggerMeta = getTriggerMeta(trigger?.type);
  const showEntity = triggerMeta?.entity === "any";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          render={<Link href="/automations" />}
        >
          <ArrowLeft />
        </Button>
        <span className="text-muted-foreground text-sm">Automatizaciones</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        {/* Ajustes generales */}
        <div className="grid content-start gap-4">
          <div className="grid gap-3 rounded-lg border p-3">
            <div className="grid gap-1.5">
              <Label>
                Nombre<span className="text-destructive"> *</span>
              </Label>
              <Input {...register("name")} placeholder="Bienvenida a leads" />
              {errors.name ? (
                <p className="text-destructive text-xs">{errors.name.message}</p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label>Descripción</Label>
              <Textarea
                {...register("description")}
                rows={2}
                placeholder="Para qué sirve este flujo"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Estado</Label>
              <select className={selectClass} {...register("status")}>
                <option value="draft">Borrador</option>
                <option value="active">Activa</option>
                <option value="paused">Pausada</option>
                <option value="archived">Archivada</option>
              </select>
              <p className="text-muted-foreground text-xs">
                Para activarla necesitas un disparador.
              </p>
            </div>
          </div>
        </div>

        {/* Flujo */}
        <div className="grid content-start gap-3">
          {/* Disparador */}
          <div className="border-primary/40 grid gap-3 rounded-lg border-2 p-3">
            <div className="flex items-center gap-2">
              <div className="bg-primary/10 flex size-8 items-center justify-center rounded-md">
                <Zap className="text-primary size-4" />
              </div>
              <div>
                <p className="text-sm font-medium">Disparador</p>
                <p className="text-muted-foreground text-xs">
                  Qué inicia el flujo
                </p>
              </div>
            </div>
            <select
              className={selectClass}
              value={trigger?.type ?? ""}
              onChange={(e) => setTriggerType(e.target.value)}
            >
              <option value="">— Sin disparador —</option>
              {AUTOMATION_TRIGGERS.map((t) => (
                <option key={t.type} value={t.type}>
                  {t.label}
                </option>
              ))}
            </select>
            {triggerMeta ? (
              <p className="text-muted-foreground text-xs">
                {triggerMeta.description}
              </p>
            ) : null}

            {showEntity ? (
              <div className="grid gap-1.5">
                <Label className="text-xs">Aplica a</Label>
                <select
                  className={selectClass}
                  value={String(trigger?.config?.entity ?? "")}
                  onChange={(e) => setTriggerConfig("entity", e.target.value)}
                >
                  <option value="">Cualquier registro</option>
                  {ENTITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {trigger?.type === "field_changed" ? (
              <div className="grid gap-1.5">
                <Label className="text-xs">Campo a vigilar</Label>
                <Input
                  value={String(trigger.config?.field ?? "")}
                  onChange={(e) => setTriggerConfig("field", e.target.value)}
                  placeholder="p. ej. title, marketingStatus"
                />
              </div>
            ) : null}

            {trigger?.type === "deal_stage_changed" ? (
              <div className="grid gap-1.5">
                <Label className="text-xs">Etapa (opcional)</Label>
                <select
                  className={selectClass}
                  value={String(trigger.config?.stageId ?? "")}
                  onChange={(e) => setTriggerConfig("stageId", e.target.value)}
                >
                  <option value="">Cualquier etapa</option>
                  {options.stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {trigger?.type === "scheduled" ? (
              <div className="grid gap-1.5">
                <Label className="text-xs">Cron</Label>
                <Input
                  value={String(trigger.config?.cron ?? "")}
                  onChange={(e) => setTriggerConfig("cron", e.target.value)}
                  placeholder="0 9 * * 1  (lunes a las 9:00)"
                />
              </div>
            ) : null}
          </div>

          {/* Nodos */}
          {nodes.map((node, index) => (
            <NodeCard
              key={node.id}
              node={node}
              index={index}
              total={nodes.length}
              options={options}
              onChange={(next) => updateNode(node.id, next)}
              onRemove={() => removeNode(node.id)}
              onMove={(dir) => moveNode(index, dir)}
            />
          ))}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addNode("action")}
            >
              <Plus className="size-4" />
              Acción
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addNode("wait")}
            >
              <Plus className="size-4" />
              Espera
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addNode("condition")}
            >
              <Plus className="size-4" />
              Condición
            </Button>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" render={<Link href="/automations" />}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          <Save />
          {isSubmitting ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}

function NodeCard({
  node,
  index,
  total,
  options,
  onChange,
  onRemove,
  onMove,
}: {
  node: AutomationNode;
  index: number;
  total: number;
  options: AutomationBuilderOptions;
  onChange: (next: AutomationNode) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const Icon =
    node.type === "wait" ? Clock : node.type === "condition" ? GitBranch : Bolt;

  function setConfig(key: string, value: unknown) {
    onChange({ ...node, config: { ...node.config, [key]: value } });
  }

  return (
    <div className="grid gap-3 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="bg-muted flex size-8 items-center justify-center rounded-md">
            <Icon className="text-muted-foreground size-4" />
          </div>
          <p className="text-sm font-medium">
            {index + 1}.{" "}
            {node.type === "action"
              ? "Acción"
              : node.type === "wait"
                ? "Espera"
                : "Condición"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Subir"
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            <ArrowUp className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Bajar"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
          >
            <ArrowDown className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Eliminar"
            className="text-muted-foreground hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {node.type === "action" ? (
        <ActionNodeFields node={node} options={options} setConfig={setConfig} onChange={onChange} />
      ) : null}

      {node.type === "wait" ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label className="text-xs">Días</Label>
            <Input
              type="number"
              min={0}
              max={365}
              value={Number(node.config?.waitDays ?? 0)}
              onChange={(e) => setConfig("waitDays", Number(e.target.value))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Horas</Label>
            <Input
              type="number"
              min={0}
              max={23}
              value={Number(node.config?.waitHours ?? 0)}
              onChange={(e) => setConfig("waitHours", Number(e.target.value))}
            />
          </div>
        </div>
      ) : null}

      {node.type === "condition" ? (
        <ConditionNodeFields node={node} setConfig={setConfig} />
      ) : null}
    </div>
  );
}

function ActionNodeFields({
  node,
  options,
  setConfig,
  onChange,
}: {
  node: AutomationNode;
  options: AutomationBuilderOptions;
  setConfig: (key: string, value: unknown) => void;
  onChange: (next: AutomationNode) => void;
}) {
  const meta = getActionMeta(node.kind);
  const primary = meta?.primary;

  function optionList(control: string): AutomationOption[] {
    if (control === "labels") return options.labels;
    if (control === "sequences") return options.sequences;
    if (control === "templates") return options.templates;
    if (control === "stages") return options.stages;
    return [];
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label className="text-xs">Tipo de acción</Label>
        <select
          className={selectClass}
          value={node.kind}
          onChange={(e) =>
            // Al cambiar de acción, reiniciamos su config.
            onChange({ ...node, kind: e.target.value, config: {} })
          }
        >
          {AUTOMATION_ACTIONS.map((a) => (
            <option key={a.kind} value={a.kind}>
              {a.label}
            </option>
          ))}
        </select>
        {meta ? (
          <p className="text-muted-foreground text-xs">{meta.description}</p>
        ) : null}
      </div>

      {primary ? (
        <div className="grid gap-1.5">
          <Label className="text-xs">{primary.label}</Label>
          {primary.control === "text" ? (
            <Input
              value={String(node.config?.[primary.key] ?? "")}
              onChange={(e) => setConfig(primary.key, e.target.value)}
            />
          ) : (
            <select
              className={selectClass}
              value={String(node.config?.[primary.key] ?? "")}
              onChange={(e) => setConfig(primary.key, e.target.value)}
            >
              <option value="">— Elige —</option>
              {optionList(primary.control).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ConditionNodeFields({
  node,
  setConfig,
}: {
  node: AutomationNode;
  setConfig: (key: string, value: unknown) => void;
}) {
  const op = (node.config?.op as ConditionOperator) ?? "eq";
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1.2fr]">
        <div className="grid gap-1.5">
          <Label className="text-xs">Campo</Label>
          <Input
            value={String(node.config?.field ?? "")}
            onChange={(e) => setConfig("field", e.target.value)}
            placeholder="p. ej. marketingStatus"
          />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Operador</Label>
          <select
            className={selectClass}
            value={op}
            onChange={(e) => setConfig("op", e.target.value)}
          >
            {CONDITION_OPERATORS.map((o) => (
              <option key={o.op} value={o.op}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {opNeedsValue(op) ? (
          <div className="grid gap-1.5">
            <Label className="text-xs">Valor</Label>
            <Input
              value={String(node.config?.value ?? "")}
              onChange={(e) => setConfig("value", e.target.value)}
            />
          </div>
        ) : (
          <div />
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label className="text-xs">Si se cumple</Label>
          <select
            className={selectClass}
            value={String(node.config?.trueBranch ?? "continue")}
            onChange={(e) => setConfig("trueBranch", e.target.value)}
          >
            <option value="continue">Continuar</option>
            <option value="stop">Detener flujo</option>
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Si no se cumple</Label>
          <select
            className={selectClass}
            value={String(node.config?.falseBranch ?? "stop")}
            onChange={(e) => setConfig("falseBranch", e.target.value)}
          >
            <option value="stop">Detener flujo</option>
            <option value="continue">Continuar</option>
          </select>
        </div>
      </div>
    </div>
  );
}
