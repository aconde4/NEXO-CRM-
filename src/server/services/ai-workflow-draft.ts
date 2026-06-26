import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";

import {
  AUTOMATION_ACTIONS,
  AUTOMATION_TRIGGERS,
  CONDITION_OPERATORS,
} from "@/lib/automations";
import { textToHtml } from "@/lib/email/merge-tags";
import {
  generatedAutomationDraftSchema,
  generatedSequenceDraftSchema,
  type GeneratedAutomationDraftValues,
  type GeneratedSequenceDraftValues,
  type GenerateWorkflowDraftValues,
} from "@/lib/validations/ai-workflow";
import {
  type AutomationInputValues,
  automationInputSchema,
} from "@/lib/validations/automation";
import {
  type SequenceBuilderStepValues,
  type SequenceBuilderValues,
  sequenceBuilderSchema,
} from "@/lib/validations/sequence";
import { completeAI, type AIUsage } from "@/server/services/ai";
import { db } from "@/server/db";
import {
  customFieldDefs,
  emailTemplates,
  labels,
  sequences,
  stages,
} from "@/server/db/schema";

type CatalogOption = {
  id: string;
  name: string;
  status?: string;
};

type TemplateOption = CatalogOption & {
  subject: string;
};

type FieldOption = {
  conditionField: string;
  label: string;
  updateField?: string;
};

type WorkflowCatalog = {
  fields: FieldOption[];
  labels: CatalogOption[];
  sequences: CatalogOption[];
  stages: CatalogOption[];
  templates: TemplateOption[];
};

export type AIWorkflowDraft = {
  automation?: AutomationInputValues;
  catalogStats: {
    fields: number;
    labels: number;
    sequences: number;
    stages: number;
    templates: number;
  };
  estimatedCostUsd: number;
  generatedAt: string;
  kind: GenerateWorkflowDraftValues["kind"];
  model: string;
  provider: string;
  rationale: string;
  runId: string;
  sequence?: SequenceBuilderValues;
  usage: AIUsage;
  warnings: string[];
};

function clean(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function limit(value: string, max: number): string {
  const trimmed = clean(value).replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 3).trimEnd()}...`;
}

function normalize(value: string): string {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function listLines(items: CatalogOption[], fallback: string): string {
  if (items.length === 0) return fallback;
  return items
    .slice(0, 80)
    .map((item) =>
      item.status ? `- ${item.name} (${item.status})` : `- ${item.name}`,
    )
    .join("\n");
}

function findByName<T extends CatalogOption>(
  items: T[],
  name: string | null | undefined,
): T | null {
  const key = normalize(name ?? "");
  if (!key) return null;
  const exact = items.find((item) => normalize(item.name) === key);
  if (exact) return exact;
  return (
    items.find((item) => {
      const candidate = normalize(item.name);
      return candidate.includes(key) || key.includes(candidate);
    }) ?? null
  );
}

function findField(
  fields: FieldOption[],
  raw: string | null | undefined,
  mode: "condition" | "update",
): string | null {
  const key = normalize(raw ?? "");
  if (!key) return null;

  const candidates =
    mode === "update" ? fields.filter((field) => field.updateField) : fields;
  const exact = candidates.find((field) =>
    [
      field.conditionField,
      field.label,
      field.updateField ?? "",
    ].some((value) => normalize(value) === key),
  );
  if (exact) {
    return mode === "update"
      ? (exact.updateField ?? exact.conditionField)
      : exact.conditionField;
  }

  const fuzzy = candidates.find((field) =>
    [
      field.conditionField,
      field.label,
      field.updateField ?? "",
    ].some((value) => {
      const normalized = normalize(value);
      return normalized.includes(key) || key.includes(normalized);
    }),
  );
  if (!fuzzy) return null;
  return mode === "update"
    ? (fuzzy.updateField ?? fuzzy.conditionField)
    : fuzzy.conditionField;
}

function fallbackAction(index: number, subject: string) {
  return {
    config: { subject: limit(subject, 180) || "Revisar automatizacion" },
    id: `ai-action-${index + 1}`,
    kind: "create_task",
    type: "action" as const,
  };
}

function waitConfig(waitDays: number | undefined, waitHours: number | undefined) {
  const days = Math.max(0, Math.min(365, Number(waitDays ?? 0)));
  const hours = Math.max(0, Math.min(23, Number(waitHours ?? 0)));
  if (days === 0 && hours === 0) return { waitDays: 1, waitHours: 0 };
  return { waitDays: days, waitHours: hours };
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function baseFields(): FieldOption[] {
  return [
    { conditionField: "person.firstName", label: "contacto nombre" },
    { conditionField: "person.lastName", label: "contacto apellidos" },
    { conditionField: "person.email", label: "contacto email" },
    { conditionField: "person.phone", label: "contacto telefono" },
    { conditionField: "person.title", label: "contacto cargo" },
    { conditionField: "person.campaign", label: "contacto campana" },
    {
      conditionField: "person.marketingStatus",
      label: "contacto estado marketing",
    },
    { conditionField: "organization.name", label: "empresa nombre" },
    { conditionField: "organization.industry", label: "empresa sector" },
    { conditionField: "organization.website", label: "empresa web" },
    { conditionField: "deal.title", label: "negocio titulo" },
    { conditionField: "deal.status", label: "negocio estado" },
    { conditionField: "deal.value", label: "negocio valor" },
  ];
}

async function loadWorkflowCatalog(ownerId: string): Promise<WorkflowCatalog> {
  const [sequenceRows, labelRows, templateRows, stageRows, fieldRows] =
    await Promise.all([
      db
        .select({
          id: sequences.id,
          name: sequences.name,
          status: sequences.status,
        })
        .from(sequences)
        .where(eq(sequences.ownerId, ownerId))
        .orderBy(asc(sequences.name))
        .limit(500),
      db
        .select({ id: labels.id, name: labels.name })
        .from(labels)
        .where(eq(labels.ownerId, ownerId))
        .orderBy(asc(labels.name))
        .limit(500),
      db
        .select({
          id: emailTemplates.id,
          name: emailTemplates.name,
          subject: emailTemplates.subject,
        })
        .from(emailTemplates)
        .where(and(eq(emailTemplates.ownerId, ownerId), isNull(emailTemplates.archivedAt)))
        .orderBy(asc(emailTemplates.name))
        .limit(500),
      db
        .select({ id: stages.id, name: stages.name })
        .from(stages)
        .where(eq(stages.ownerId, ownerId))
        .orderBy(asc(stages.position), asc(stages.name))
        .limit(500),
      db
        .select({
          entityType: customFieldDefs.entityType,
          key: customFieldDefs.key,
          label: customFieldDefs.label,
        })
        .from(customFieldDefs)
        .where(eq(customFieldDefs.ownerId, ownerId))
        .orderBy(asc(customFieldDefs.entityType), asc(customFieldDefs.position)),
    ]);

  return {
    fields: [
      ...baseFields(),
      ...fieldRows.map((field) => {
        const prefix =
          field.entityType === "organization" ? "organization" : "person";
        return {
          conditionField: `${prefix}.customFields.${field.key}`,
          label: `${prefix} custom ${field.label}`,
          updateField: field.key,
        };
      }),
    ],
    labels: labelRows,
    sequences: sequenceRows,
    stages: stageRows,
    templates: templateRows,
  };
}

function catalogStats(catalog: WorkflowCatalog) {
  return {
    fields: catalog.fields.length,
    labels: catalog.labels.length,
    sequences: catalog.sequences.length,
    stages: catalog.stages.length,
    templates: catalog.templates.length,
  };
}

function sequenceSystemPrompt() {
  return [
    "Eres un arquitecto senior de CRM B2B dentro de Nexo CRM.",
    "Crea una secuencia de ventas revisable, en borrador, a partir de lenguaje natural.",
    "Usa pasos utiles y realistas: emails, esperas, condiciones y tareas.",
    "No actives la secuencia. Escribe en espanol profesional.",
    "El bodyText de cada email debe ser texto plano, no HTML.",
    "Puedes usar merge tags como {{nombre}}, {{empresa}}, {{cargo}} y {{campaign}} cuando aporte personalizacion.",
    "Devuelve exclusivamente JSON valido que cumpla el esquema indicado.",
  ].join("\n");
}

function automationSystemPrompt() {
  return [
    "Eres un arquitecto senior de CRM B2B dentro de Nexo CRM.",
    "Crea una automatizacion revisable, en borrador, a partir de lenguaje natural.",
    "Usa solo acciones operativas: create_task, enroll_sequence, add_label, move_stage, update_field, webhook y notify.",
    "No uses send_email ni ai_summary porque aun no son acciones ejecutables.",
    "Cuando menciones etapas, etiquetas o secuencias, usa nombres del catalogo si existen.",
    "Devuelve exclusivamente JSON valido que cumpla el esquema indicado.",
  ].join("\n");
}

function sequencePrompt(
  instruction: string,
  catalog: WorkflowCatalog,
): string {
  return [
    `Solicitud del usuario:\n${instruction}`,
    "Variables recomendadas: {{nombre}}, {{apellidos}}, {{nombre_completo}}, {{email}}, {{telefono}}, {{cargo}}, {{campaign}}, {{empresa}}, {{empresa.web}}, {{empresa.sector}}.",
    `Plantillas existentes para inspiracion:\n${listLines(
      catalog.templates,
      "- No hay plantillas guardadas.",
    )}`,
    "Criterios: maximo 8 pasos salvo que el usuario pida mas, espera inicial solo si tiene sentido, stopOnReply normalmente true, dailyLimit prudente.",
  ].join("\n\n");
}

function automationPrompt(
  instruction: string,
  catalog: WorkflowCatalog,
): string {
  const triggers = AUTOMATION_TRIGGERS.map(
    (trigger) => `- ${trigger.type}: ${trigger.label}`,
  ).join("\n");
  const actions = AUTOMATION_ACTIONS.filter(
    (action) => action.kind !== "send_email" && action.kind !== "ai_summary",
  )
    .map((action) => `- ${action.kind}: ${action.label}`)
    .join("\n");
  const ops = CONDITION_OPERATORS.map((op) => op.op).join(", ");
  return [
    `Solicitud del usuario:\n${instruction}`,
    `Disparadores disponibles:\n${triggers}`,
    `Acciones disponibles:\n${actions}`,
    `Operadores de condicion: ${ops}`,
    `Etapas existentes:\n${listLines(catalog.stages, "- No hay etapas.")}`,
    `Etiquetas existentes:\n${listLines(catalog.labels, "- No hay etiquetas.")}`,
    `Secuencias existentes:\n${listLines(
      catalog.sequences,
      "- No hay secuencias.",
    )}`,
    `Campos para condiciones:\n${catalog.fields
      .slice(0, 80)
      .map((field) => `- ${field.conditionField}: ${field.label}`)
      .join("\n")}`,
    "Si una referencia no existe, crea una tarea o notificacion para revisarla en vez de inventar IDs.",
  ].join("\n\n");
}

function generatedWarnings(values: {
  aiWarnings?: string[];
  normalizationWarnings: string[];
}) {
  return [
    ...(values.aiWarnings ?? []),
    ...values.normalizationWarnings,
  ].flatMap((warning) => {
    const cleanWarning = limit(warning, 240);
    return cleanWarning ? [cleanWarning] : [];
  });
}

function normalizeSequenceDraft(
  draft: GeneratedSequenceDraftValues,
): { sequence: SequenceBuilderValues; warnings: string[] } {
  const warnings: string[] = [];
  const channel = draft.channel ?? "gmail_1to1";
  let emailCount = 0;

  const steps: SequenceBuilderStepValues[] = draft.steps.map((step, index) => {
    const localId = `ai-${step.type}-${index + 1}`;
    if (step.type === "email") {
      emailCount += 1;
      return {
        bodyHtml: textToHtml(step.bodyText),
        bodyText: step.bodyText,
        channel: step.channel ?? channel,
        localId,
        name: step.name ?? `Email ${emailCount}`,
        preheader: step.preheader ?? "",
        subject: step.subject,
        templateId: null,
        type: "email",
        variants: (step.variants ?? []).map((variant, variantIndex) => ({
          bodyHtml: textToHtml(variant.bodyText),
          bodyText: variant.bodyText,
          id: `${localId}-variant-${variantIndex + 1}`,
          name: variant.name ?? "",
          subject: variant.subject,
          weight: variant.weight ?? 1,
        })),
      };
    }
    if (step.type === "wait") {
      const wait = waitConfig(step.waitDays, step.waitHours);
      return {
        localId,
        name: step.name ?? "Espera",
        type: "wait",
        ...wait,
      };
    }
    if (step.type === "condition") {
      return {
        condition: {
          kind: step.condition.kind,
          value: step.condition.value ?? "",
        },
        localId,
        name: step.name ?? "Condicion",
        type: "condition",
      };
    }
    return {
      localId,
      name: step.name ?? "Tarea",
      taskNotes: step.taskNotes ?? "",
      taskSubject: step.taskSubject,
      type: "task",
      waitDays: step.waitDays ?? 0,
      waitHours: step.waitHours ?? 0,
    };
  });

  if (emailCount === 0) {
    warnings.push("La IA no propuso emails; se anadio un primer email de revision.");
    steps.unshift({
      bodyHtml: textToHtml("Hola {{nombre}},\n\nQueria retomar contigo este tema."),
      bodyText: "Hola {{nombre}},\n\nQueria retomar contigo este tema.",
      channel,
      localId: "ai-email-fallback",
      name: "Email inicial",
      preheader: "",
      subject: "Retomamos el contacto",
      templateId: null,
      type: "email",
      variants: [],
    });
  }

  const values: SequenceBuilderValues = {
    channel,
    dailyLimit: draft.dailyLimit ?? 50,
    description: draft.description ?? "",
    name: draft.name,
    status: "draft",
    steps,
    stopOnReply: draft.stopOnReply ?? true,
    timeZone: draft.timeZone ?? "Europe/Madrid",
    windowEnd: draft.windowEnd ?? "18:00",
    windowStart: draft.windowStart ?? "09:00",
  };

  return {
    sequence: sequenceBuilderSchema.parse(values),
    warnings: generatedWarnings({
      aiWarnings: draft.warnings,
      normalizationWarnings: warnings,
    }),
  };
}

function normalizeTrigger(
  draft: GeneratedAutomationDraftValues,
  catalog: WorkflowCatalog,
  warnings: string[],
): AutomationInputValues["trigger"] {
  const config: Record<string, unknown> = {};
  if (
    draft.trigger.type === "record_created" ||
    draft.trigger.type === "record_updated" ||
    draft.trigger.type === "record_deleted"
  ) {
    config.entity = draft.trigger.entity ?? "person";
  }
  if (draft.trigger.type === "field_changed") {
    config.entity = draft.trigger.entity ?? "person";
    const field = findField(catalog.fields, draft.trigger.field, "condition");
    config.field = field ?? (clean(draft.trigger.field) || "person.campaign");
    if (!field && draft.trigger.field) {
      warnings.push(`Campo no reconocido en disparador: ${draft.trigger.field}.`);
    }
  }
  if (draft.trigger.type === "deal_stage_changed") {
    const stage = findByName(catalog.stages, draft.trigger.stageName);
    if (stage) {
      config.stageId = stage.id;
    } else if (draft.trigger.stageName) {
      warnings.push(
        `Etapa no encontrada para disparador: ${draft.trigger.stageName}.`,
      );
    }
  }
  if (draft.trigger.type === "scheduled") {
    config.cron = clean(draft.trigger.cron) || "0 9 * * 1";
    if (!draft.trigger.cron) {
      warnings.push("No se indico cron; se uso lunes a las 9:00.");
    }
  }
  return { config, type: draft.trigger.type };
}

function normalizeAutomationAction(
  step: Extract<GeneratedAutomationDraftValues["steps"][number], { type: "action" }>,
  index: number,
  catalog: WorkflowCatalog,
  warnings: string[],
): AutomationInputValues["graph"]["nodes"][number] {
  if (step.kind === "create_task") {
    return fallbackAction(index, step.subject || "Revisar contacto");
  }
  if (step.kind === "notify") {
    return {
      config: { message: step.message || "Revisar automatizacion" },
      id: `ai-action-${index + 1}`,
      kind: "notify",
      type: "action" as const,
    };
  }
  if (step.kind === "enroll_sequence") {
    const sequence = findByName(catalog.sequences, step.sequenceName);
    if (!sequence) {
      warnings.push(
        `Secuencia no encontrada: ${step.sequenceName || "sin nombre"}.`,
      );
      return fallbackAction(
        index,
        `Revisar inscripcion en secuencia ${step.sequenceName ?? ""}`,
      );
    }
    if (sequence.status !== "active") {
      warnings.push(`La secuencia "${sequence.name}" no esta activa todavia.`);
    }
    return {
      config: { sequenceId: sequence.id },
      id: `ai-action-${index + 1}`,
      kind: "enroll_sequence",
      type: "action" as const,
    };
  }
  if (step.kind === "add_label") {
    const label = findByName(catalog.labels, step.labelName);
    if (!label) {
      warnings.push(`Etiqueta no encontrada: ${step.labelName || "sin nombre"}.`);
      return fallbackAction(index, `Asignar etiqueta ${step.labelName ?? ""}`);
    }
    return {
      config: { labelId: label.id },
      id: `ai-action-${index + 1}`,
      kind: "add_label",
      type: "action" as const,
    };
  }
  if (step.kind === "move_stage") {
    const stage = findByName(catalog.stages, step.stageName);
    if (!stage) {
      warnings.push(`Etapa no encontrada: ${step.stageName || "sin nombre"}.`);
      return fallbackAction(index, `Mover a etapa ${step.stageName ?? ""}`);
    }
    return {
      config: { stageId: stage.id },
      id: `ai-action-${index + 1}`,
      kind: "move_stage",
      type: "action" as const,
    };
  }
  if (step.kind === "update_field") {
    const field = findField(catalog.fields, step.field, "update");
    if (!field) {
      warnings.push(
        `Campo personalizado no encontrado para actualizar: ${
          step.field || "sin campo"
        }.`,
      );
      return fallbackAction(index, `Actualizar campo ${step.field ?? ""}`);
    }
    return {
      config: { field, value: step.value ?? "" },
      id: `ai-action-${index + 1}`,
      kind: "update_field",
      type: "action" as const,
    };
  }

  const url = clean(step.url);
  if (!isHttpUrl(url)) {
    warnings.push(`Webhook no valido: ${url || "sin URL"}.`);
    return fallbackAction(index, "Revisar webhook de automatizacion");
  }
  return {
    config: { url },
    id: `ai-action-${index + 1}`,
    kind: "webhook",
    type: "action" as const,
  };
}

function normalizeAutomationDraft(
  draft: GeneratedAutomationDraftValues,
  catalog: WorkflowCatalog,
): { automation: AutomationInputValues; warnings: string[] } {
  const warnings: string[] = [];
  const nodes = draft.steps.map((step, index) => {
    if (step.type === "action") {
      return normalizeAutomationAction(step, index, catalog, warnings);
    }
    if (step.type === "wait") {
      return {
        config: waitConfig(step.waitDays, step.waitHours),
        id: `ai-wait-${index + 1}`,
        kind: "wait",
        type: "wait" as const,
      };
    }

    const field = findField(catalog.fields, step.field, "condition");
    if (!field) {
      warnings.push(`Campo no reconocido en condicion: ${step.field}.`);
    }
    return {
      config: {
        falseBranch: step.falseBranch ?? "stop",
        field: field ?? step.field,
        op: step.op,
        trueBranch: step.trueBranch ?? "continue",
        value: step.value ?? "",
      },
      id: `ai-condition-${index + 1}`,
      kind: "condition",
      type: "condition" as const,
    };
  });

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

  const values: AutomationInputValues = {
    description: draft.description ?? "",
    graph: { edges, nodes },
    name: draft.name,
    status: "draft",
    trigger: normalizeTrigger(draft, catalog, warnings),
  };

  return {
    automation: automationInputSchema.parse(values),
    warnings: generatedWarnings({
      aiWarnings: draft.warnings,
      normalizationWarnings: warnings,
    }),
  };
}

export async function generateAIWorkflowDraft(
  ownerId: string,
  raw: GenerateWorkflowDraftValues,
): Promise<AIWorkflowDraft> {
  const catalog = await loadWorkflowCatalog(ownerId);
  const common = {
    catalogStats: catalogStats(catalog),
    generatedAt: new Date().toISOString(),
  };

  if (raw.kind === "sequence") {
    const result = await completeAI<GeneratedSequenceDraftValues>({
      feature: "workflow.sequence_draft",
      maxTokens: 2_500,
      messages: [{ content: sequencePrompt(raw.instruction, catalog), role: "user" }],
      modelPreference: "fast",
      ownerId,
      requestSummary: {
        ...common.catalogStats,
        instructionChars: raw.instruction.length,
        kind: raw.kind,
      },
      schema: generatedSequenceDraftSchema,
      schemaName: "sequence_draft",
      system: sequenceSystemPrompt(),
      temperature: 0.25,
    });
    if (!result.data) throw new Error("La IA no devolvio una secuencia valida.");

    const normalized = normalizeSequenceDraft(result.data);
    return {
      ...common,
      estimatedCostUsd: result.estimatedCostUsd,
      kind: "sequence",
      model: result.model,
      provider: result.provider,
      rationale: result.data.rationale ?? "",
      runId: result.runId,
      sequence: normalized.sequence,
      usage: result.usage,
      warnings: normalized.warnings,
    };
  }

  const result = await completeAI<GeneratedAutomationDraftValues>({
    feature: "workflow.automation_draft",
    maxTokens: 2_500,
    messages: [{ content: automationPrompt(raw.instruction, catalog), role: "user" }],
    modelPreference: "fast",
    ownerId,
    requestSummary: {
      ...common.catalogStats,
      instructionChars: raw.instruction.length,
      kind: raw.kind,
    },
    schema: generatedAutomationDraftSchema,
    schemaName: "automation_draft",
    system: automationSystemPrompt(),
    temperature: 0.2,
  });
  if (!result.data) throw new Error("La IA no devolvio una automatizacion valida.");

  const normalized = normalizeAutomationDraft(result.data, catalog);
  return {
    ...common,
    automation: normalized.automation,
    estimatedCostUsd: result.estimatedCostUsd,
    kind: "automation",
    model: result.model,
    provider: result.provider,
    rationale: result.data.rationale ?? "",
    runId: result.runId,
    usage: result.usage,
    warnings: normalized.warnings,
  };
}
