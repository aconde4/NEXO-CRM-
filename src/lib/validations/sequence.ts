import { z } from "zod";

function htmlHasContent(value: string): boolean {
  return value.replace(/<[^>]*>/g, "").trim().length > 0;
}

const optionalUuidSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" ? value.trim() : ""))
  .refine(
    (value) => !value || z.string().uuid().safeParse(value).success,
    "Identificador no válido",
  )
  .transform((value) => (value ? value : null));

const timeSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Usa formato HH:mm");

const nonNegativeDelaySchema = z
  .number()
  .int("Debe ser un número entero")
  .min(0, "No puede ser negativo")
  .max(365, "Demasiada espera");

const sequenceStepBaseSchema = z.object({
  id: z.string().uuid().optional(),
  localId: z.string().trim().min(1).max(80),
  name: z.string().trim().max(160).default(""),
});

export const sequenceStatusSchema = z.enum([
  "draft",
  "active",
  "paused",
  "archived",
]);

export const sequenceChannelSchema = z.enum(["gmail_1to1", "resend"]);

export const sequenceConditionKindSchema = z.enum([
  "opened",
  "clicked",
  "replied",
  "not_replied",
]);

/**
 * Variante A/B alternativa de un paso de email (Fase 5.7). El propio paso es la
 * "Variante A" (peso 1 implícito); estas son las alternativas (B, C, D) con su peso.
 */
export const sequenceVariantSchema = z
  .object({
    id: z.string().trim().min(1).max(80),
    name: z.string().trim().max(120).default(""),
    weight: z
      .number()
      .int("Debe ser un número entero")
      .min(1, "Mínimo 1")
      .max(100, "Máximo 100")
      .default(1),
    subject: z.string().trim().min(1, "El asunto es obligatorio").max(500),
    bodyHtml: z.string().trim().max(500_000).default(""),
    bodyText: z.string().trim().max(200_000).default(""),
  })
  .refine(
    (data) => Boolean(data.bodyText.trim() || htmlHasContent(data.bodyHtml)),
    {
      message: "La variante necesita contenido",
      path: ["bodyText"],
    },
  );

export const sequenceEmailStepSchema = sequenceStepBaseSchema
  .extend({
    type: z.literal("email"),
    channel: sequenceChannelSchema,
    templateId: optionalUuidSchema.default(null),
    subject: z.string().trim().min(1, "El asunto es obligatorio").max(500),
    preheader: z.string().trim().max(180).default(""),
    bodyHtml: z.string().trim().max(500_000).default(""),
    bodyText: z.string().trim().max(200_000).default(""),
    variants: z.array(sequenceVariantSchema).max(3).default([]),
  })
  .refine(
    (data) => Boolean(data.bodyText.trim() || htmlHasContent(data.bodyHtml)),
    {
      message: "El email necesita contenido",
      path: ["bodyText"],
    },
  );

export const sequenceWaitStepSchema = sequenceStepBaseSchema
  .extend({
    type: z.literal("wait"),
    waitDays: nonNegativeDelaySchema,
    waitHours: z
      .number()
      .int("Debe ser un número entero")
      .min(0, "No puede ser negativo")
      .max(23, "Usa 0-23 horas"),
  })
  .refine((data) => data.waitDays > 0 || data.waitHours > 0, {
    message: "Indica días u horas de espera",
    path: ["waitDays"],
  });

export const sequenceConditionStepSchema = sequenceStepBaseSchema.extend({
  type: z.literal("condition"),
  condition: z.object({
    kind: sequenceConditionKindSchema,
    value: z.string().trim().max(500).default(""),
  }),
});

export const sequenceTaskStepSchema = sequenceStepBaseSchema.extend({
  type: z.literal("task"),
  taskSubject: z.string().trim().min(1, "La tarea necesita asunto").max(180),
  taskNotes: z.string().trim().max(2_000).default(""),
  waitDays: nonNegativeDelaySchema.default(0),
  waitHours: z
    .number()
    .int("Debe ser un número entero")
    .min(0, "No puede ser negativo")
    .max(23, "Usa 0-23 horas")
    .default(0),
});

/**
 * Acción CRM dentro de una secuencia (Fase T.3). Cada `kind` es una acción interna
 * ejecutable hoy por el motor. Unión discriminada por `kind` para validar la config
 * propia de cada acción. Se guarda en `sequence_steps.settings.action`.
 */
const requiredUuid = z.string().uuid("Selecciona una opción");

export const crmActionMoveStageSchema = z.object({
  kind: z.literal("move_stage"),
  pipelineId: requiredUuid,
  stageId: requiredUuid,
  /**
   * Si el contacto aún no tiene negocio en el embudo destino: `true` crea la entrada
   * (etapa inicial) y la mueve; `false` omite la acción y lo registra (decisión de
   * producto documentada en docs/08, recomendado = crear).
   */
  createIfMissing: z.boolean().default(true),
});

export const crmActionAddLabelSchema = z.object({
  kind: z.literal("add_label"),
  labelId: requiredUuid,
});

export const crmActionRemoveLabelSchema = z.object({
  kind: z.literal("remove_label"),
  labelId: requiredUuid,
});

export const crmActionUpdateFieldSchema = z.object({
  kind: z.literal("update_field"),
  scope: z.enum(["person", "organization", "deal"]).default("person"),
  field: z.string().trim().min(1, "Indica el campo").max(120),
  value: z.string().trim().max(500).default(""),
});

export const crmActionCreateTaskSchema = z.object({
  kind: z.literal("create_task"),
  taskSubject: z.string().trim().min(1, "La tarea necesita asunto").max(180),
  taskNotes: z.string().trim().max(2_000).default(""),
});

export const crmActionEnrollSequenceSchema = z.object({
  kind: z.literal("enroll_sequence"),
  sequenceId: requiredUuid,
});

export const crmActionStopSequenceSchema = z.object({
  kind: z.literal("stop_sequence"),
  sequenceId: requiredUuid,
});

export const crmActionNotifySchema = z.object({
  kind: z.literal("notify"),
  message: z.string().trim().min(1, "Escribe el aviso").max(500),
});

export const crmActionWebhookSchema = z.object({
  kind: z.literal("webhook"),
  url: z
    .string()
    .trim()
    .max(2_000)
    .refine(
      (value) => /^https?:\/\//i.test(value),
      "Usa una URL http(s) válida",
    ),
});

export const crmActionConfigSchema = z.discriminatedUnion("kind", [
  crmActionMoveStageSchema,
  crmActionAddLabelSchema,
  crmActionRemoveLabelSchema,
  crmActionUpdateFieldSchema,
  crmActionCreateTaskSchema,
  crmActionEnrollSequenceSchema,
  crmActionStopSequenceSchema,
  crmActionNotifySchema,
  crmActionWebhookSchema,
]);

export const sequenceCrmActionStepSchema = sequenceStepBaseSchema.extend({
  type: z.literal("crm_action"),
  action: crmActionConfigSchema,
});

export const sequenceStepSchema = z.discriminatedUnion("type", [
  sequenceEmailStepSchema,
  sequenceWaitStepSchema,
  sequenceConditionStepSchema,
  sequenceTaskStepSchema,
  sequenceCrmActionStepSchema,
]);

export const sequenceBuilderSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1, "Ponle un nombre").max(120),
    description: z.string().trim().max(500).default(""),
    status: sequenceStatusSchema,
    channel: sequenceChannelSchema,
    stopOnReply: z.boolean(),
    dailyLimit: z
      .number()
      .int("Debe ser un número entero")
      .min(1, "Debe ser al menos 1")
      .max(500, "Límite demasiado alto"),
    windowStart: timeSchema,
    windowEnd: timeSchema,
    timeZone: z.string().trim().min(1, "Indica zona horaria").max(80),
    steps: z
      .array(sequenceStepSchema)
      .min(1, "Añade al menos un paso")
      .max(30, "Demasiados pasos"),
  })
  .refine((data) => data.steps.some((step) => step.type === "email"), {
    message: "Añade al menos un paso de email",
    path: ["steps"],
  })
  .refine((data) => data.windowStart < data.windowEnd, {
    message: "La ventana de envío debe terminar después de empezar",
    path: ["windowEnd"],
  });

/** Envío de prueba de un paso/variante de email (Fase T.5): a tu propio correo. */
export const sequenceStepTestSchema = z
  .object({
    channel: sequenceChannelSchema,
    subject: z.string().trim().min(1, "El asunto es obligatorio").max(500),
    bodyHtml: z.string().trim().max(500_000).default(""),
    bodyText: z.string().trim().max(200_000).default(""),
  })
  .refine(
    (data) => Boolean(data.bodyText.trim() || htmlHasContent(data.bodyHtml)),
    {
      message: "El email necesita contenido",
      path: ["bodyText"],
    },
  );

export const sequenceIdSchema = z.string().uuid("Secuencia no válida");

const MAX_SEQUENCE_ENROLLMENT_PERSON_IDS = 5_000;

const enrollmentOptionalUuidSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" ? value.trim() : ""))
  .refine(
    (value) => !value || z.string().uuid().safeParse(value).success,
    "Identificador no válido",
  )
  .transform((value) => value || null);

export const sequenceEnrollmentSchema = z
  .object({
    personId: enrollmentOptionalUuidSchema,
    personIds: z
      .array(z.string().uuid("Contacto no válido"))
      .max(
        MAX_SEQUENCE_ENROLLMENT_PERSON_IDS,
        `Selecciona como máximo ${MAX_SEQUENCE_ENROLLMENT_PERSON_IDS} contactos.`,
      )
      .optional(),
    segmentId: enrollmentOptionalUuidSchema,
    sequenceId: sequenceIdSchema,
    source: z.enum(["person", "persons", "segment"]),
  })
  .superRefine((data, ctx) => {
    if (data.source === "person" && !data.personId) {
      ctx.addIssue({
        code: "custom",
        message: "Elige un contacto.",
        path: ["personId"],
      });
    }
    if (data.source === "persons" && (data.personIds ?? []).length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Selecciona al menos un contacto.",
        path: ["personIds"],
      });
    }
    if (data.source === "segment" && !data.segmentId) {
      ctx.addIssue({
        code: "custom",
        message: "Elige un segmento.",
        path: ["segmentId"],
      });
    }
  });

export type SequenceBuilderValues = z.infer<typeof sequenceBuilderSchema>;
export type SequenceBuilderStepValues = z.infer<typeof sequenceStepSchema>;
export type SequenceEmailStepValues = z.infer<typeof sequenceEmailStepSchema>;
export type SequenceVariantValues = z.infer<typeof sequenceVariantSchema>;
export type SequenceWaitStepValues = z.infer<typeof sequenceWaitStepSchema>;
export type SequenceConditionStepValues = z.infer<
  typeof sequenceConditionStepSchema
>;
export type SequenceTaskStepValues = z.infer<typeof sequenceTaskStepSchema>;
export type SequenceCrmActionStepValues = z.infer<
  typeof sequenceCrmActionStepSchema
>;
export type CrmActionConfig = z.infer<typeof crmActionConfigSchema>;
export type CrmActionKind = CrmActionConfig["kind"];
export type SequenceEnrollmentValues = z.infer<typeof sequenceEnrollmentSchema>;
export type SequenceStepTestValues = z.infer<typeof sequenceStepTestSchema>;
