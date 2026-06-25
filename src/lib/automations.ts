/**
 * Catálogo del motor de automatizaciones (Fase 6.2). Define los disparadores, los
 * tipos de nodo (condición/espera/acción) y las acciones disponibles para el
 * constructor visual, además de helpers para crear y describir nodos. Módulo agnóstico
 * (cliente/servidor); los tipos del esquema viven en `@/server/db/schema/automations`.
 */
import type {
  AutomationNode,
  AutomationNodeType,
  AutomationTriggerType,
} from "@/server/db/schema/automations";

export type AutomationTriggerMeta = {
  type: AutomationTriggerType;
  label: string;
  description: string;
  /** Entidad sobre la que aplica (para configurar/saber el contexto). */
  entity?: "person" | "organization" | "deal" | "any";
};

export const AUTOMATION_TRIGGERS: AutomationTriggerMeta[] = [
  {
    type: "record_created",
    label: "Registro creado",
    description: "Cuando se crea un contacto, empresa o negocio.",
    entity: "any",
  },
  {
    type: "record_updated",
    label: "Registro actualizado",
    description: "Cuando se edita un contacto, empresa o negocio.",
    entity: "any",
  },
  {
    type: "record_deleted",
    label: "Registro eliminado",
    description: "Cuando se borra un contacto, empresa o negocio.",
    entity: "any",
  },
  {
    type: "deal_stage_changed",
    label: "Negocio cambia de etapa",
    description: "Cuando un negocio se mueve de etapa en el embudo.",
    entity: "deal",
  },
  {
    type: "field_changed",
    label: "Cambia un campo",
    description: "Cuando cambia el valor de un campo concreto.",
    entity: "any",
  },
  {
    type: "email_opened",
    label: "Email abierto",
    description: "Cuando un destinatario abre un email.",
    entity: "person",
  },
  {
    type: "email_replied",
    label: "Email respondido",
    description: "Cuando un contacto responde a un email.",
    entity: "person",
  },
  {
    type: "form_submitted",
    label: "Formulario enviado",
    description: "Cuando llega un envío de un formulario de captación.",
    entity: "person",
  },
  {
    type: "sequence_enrolled",
    label: "Inscrito en secuencia",
    description: "Cuando un contacto entra en una secuencia.",
    entity: "person",
  },
  {
    type: "scheduled",
    label: "Programado",
    description: "En un horario recurrente (cron).",
  },
];

export type AutomationActionKind =
  | "create_task"
  | "send_email"
  | "enroll_sequence"
  | "add_label"
  | "move_stage"
  | "update_field"
  | "webhook"
  | "notify"
  | "ai_summary";

export type AutomationActionMeta = {
  kind: AutomationActionKind;
  label: string;
  description: string;
  /** Campo de configuración principal que pide la acción en el constructor. */
  primary?: {
    key: string;
    label: string;
    /** Tipo de control: opciones cargadas o texto libre. */
    control: "text" | "labels" | "sequences" | "templates" | "stages";
  };
};

export const AUTOMATION_ACTIONS: AutomationActionMeta[] = [
  {
    kind: "create_task",
    label: "Crear tarea",
    description: "Crea una actividad/tarea para el registro.",
    primary: { key: "subject", label: "Asunto de la tarea", control: "text" },
  },
  {
    kind: "send_email",
    label: "Enviar email",
    description: "Envía un email con una plantilla.",
    primary: { key: "templateId", label: "Plantilla", control: "templates" },
  },
  {
    kind: "enroll_sequence",
    label: "Inscribir en secuencia",
    description: "Inscribe al contacto en una secuencia.",
    primary: { key: "sequenceId", label: "Secuencia", control: "sequences" },
  },
  {
    kind: "add_label",
    label: "Añadir etiqueta",
    description: "Asigna una etiqueta al registro.",
    primary: { key: "labelId", label: "Etiqueta", control: "labels" },
  },
  {
    kind: "move_stage",
    label: "Mover de etapa",
    description: "Mueve el negocio a otra etapa.",
    primary: { key: "stageId", label: "Etapa destino", control: "stages" },
  },
  {
    kind: "update_field",
    label: "Actualizar campo",
    description: "Cambia el valor de un campo del registro.",
    primary: { key: "field", label: "Campo (clave)", control: "text" },
  },
  {
    kind: "webhook",
    label: "Llamar webhook",
    description: "Hace una petición HTTP a una URL.",
    primary: { key: "url", label: "URL del webhook", control: "text" },
  },
  {
    kind: "notify",
    label: "Notificar",
    description: "Envía una notificación interna.",
    primary: { key: "message", label: "Mensaje", control: "text" },
  },
  {
    kind: "ai_summary",
    label: "Resumen con IA",
    description: "Resume el historial del registro con la IA (Fase 8).",
  },
];

export type ConditionOperator =
  | "eq"
  | "neq"
  | "contains"
  | "is_set"
  | "is_empty"
  | "gt"
  | "lt";

export const CONDITION_OPERATORS: { op: ConditionOperator; label: string }[] = [
  { op: "eq", label: "es" },
  { op: "neq", label: "no es" },
  { op: "contains", label: "contiene" },
  { op: "is_set", label: "tiene valor" },
  { op: "is_empty", label: "está vacío" },
  { op: "gt", label: "mayor que" },
  { op: "lt", label: "menor que" },
];

export const NODE_TYPE_LABELS: Record<AutomationNodeType, string> = {
  trigger: "Disparador",
  condition: "Condición",
  wait: "Espera",
  action: "Acción",
};

export function getTriggerMeta(
  type: AutomationTriggerType | null | undefined,
): AutomationTriggerMeta | undefined {
  return AUTOMATION_TRIGGERS.find((t) => t.type === type);
}

export function getActionMeta(
  kind: string | null | undefined,
): AutomationActionMeta | undefined {
  return AUTOMATION_ACTIONS.find((a) => a.kind === kind);
}

export function opNeedsValue(op: ConditionOperator): boolean {
  return op !== "is_set" && op !== "is_empty";
}

let nodeCounter = 0;
/** Id local estable para nodos nuevos del constructor. */
export function createNodeId(prefix = "node"): string {
  nodeCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${nodeCounter}`;
}

export function createNode(type: AutomationNodeType): AutomationNode {
  if (type === "wait") {
    return {
      id: createNodeId("wait"),
      type: "wait",
      kind: "wait",
      config: { waitDays: 1, waitHours: 0 },
    };
  }
  if (type === "condition") {
    return {
      id: createNodeId("cond"),
      type: "condition",
      kind: "condition",
      config: {
        falseBranch: "stop",
        field: "",
        op: "eq",
        trueBranch: "continue",
        value: "",
      },
    };
  }
  return {
    id: createNodeId("action"),
    type: "action",
    kind: "create_task",
    config: { subject: "" },
  };
}

/** Texto legible de un nodo para resúmenes y la lista. */
export function describeNode(node: AutomationNode): string {
  if (node.type === "wait") {
    const days = Number(node.config?.waitDays ?? 0);
    const hours = Number(node.config?.waitHours ?? 0);
    const parts = [days ? `${days} d` : "", hours ? `${hours} h` : ""].filter(
      Boolean,
    );
    return `Esperar ${parts.join(" ") || "0"}`;
  }
  if (node.type === "condition") {
    const op = CONDITION_OPERATORS.find((o) => o.op === node.config?.op)?.label;
    const field = String(node.config?.field ?? "campo");
    const value = node.config?.value ? ` ${String(node.config.value)}` : "";
    return `Si ${field} ${op ?? "es"}${value}`;
  }
  return getActionMeta(node.kind)?.label ?? "Acción";
}
