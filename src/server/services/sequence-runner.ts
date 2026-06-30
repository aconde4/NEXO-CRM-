import "server-only";

import { and, eq, gte, isNull, sql } from "drizzle-orm";

import {
  buildMergeContext,
  renderMergeTags,
  textToHtml,
} from "@/lib/email/merge-tags";
import {
  type SendWindow,
  isWithinSendWindow,
  nextAllowedSendAt,
  nextDayWindowOpen,
  startOfLocalDayUtc,
} from "@/lib/send-window";
import type { SendEmailValues } from "@/lib/validations/email";
import { db } from "@/server/db";
import {
  activities,
  deals,
  emailEvents,
  emailMessages,
  enrollments,
  organizations,
  persons,
  sequenceSteps,
  sequences,
  suppressions,
  type EmailEventType,
  type MarketingStatus,
  type SequenceChannel,
  type SequenceEnrollmentStatus,
  type SequenceStepCondition,
  type SequenceStepType,
  type SequenceStepVariant,
} from "@/server/db/schema";
import { inngest } from "@/server/inngest/client";
import { listAllCustomFieldDefsForOwner } from "@/server/queries/custom-fields";
import { sendGmailEmail } from "@/server/services/gmail";
import { normalizeEmail } from "@/server/services/gmail-auth";
import {
  getDefaultCampaignFrom,
  ResendServiceError,
  sendResendEmail,
} from "@/server/services/resend";
import { getOptimizedSendTimeWait } from "@/server/services/send-time-optimization";

export const SEQUENCE_RUN_EVENT = "sequence/run.requested";
export const SEQUENCE_SIGNAL_EVENT = "sequence/signal.received";

export type SequenceRunErrorCode =
  | "inactive_sequence"
  | "invalid_enrollment"
  | "invalid_recipient"
  | "not_found"
  | "not_subscribed"
  | "suppressed"
  | "transport_error";

export class SequenceRunError extends Error {
  constructor(
    message: string,
    public readonly code: SequenceRunErrorCode,
  ) {
    super(message);
    this.name = "SequenceRunError";
  }
}

export type SequenceSignalType =
  | "bounce"
  | "click"
  | "open"
  | "reply"
  | "unsubscribe";

export type SequenceSignalPayload = {
  enrollmentId: string;
  messageId?: string;
  occurredAt: string;
  ownerId: string;
  providerEventId?: string;
  recipientEmail?: string | null;
  sequenceId: string;
  stepId: string;
  trackingId?: string | null;
  type: SequenceSignalType;
  url?: string | null;
};

type SequenceMetadata = {
  channel?: SequenceChannel;
  enrollmentId: string;
  sequenceId: string;
  stepId: string;
  variantId?: string;
};

type RunPerson = {
  campaign: string | null;
  customFields: Record<string, unknown>;
  email: string | null;
  firstName: string;
  id: string;
  lastName: string | null;
  marketingStatus: MarketingStatus;
  phone: string | null;
  source: string | null;
  title: string | null;
};

type RunOrganization = {
  customFields: Record<string, unknown>;
  industry: string | null;
  name: string;
  tradeName: string | null;
  website: string | null;
} | null;

type RunStep = {
  bodyHtml: string | null;
  bodyText: string | null;
  channel: SequenceChannel | null;
  condition: SequenceStepCondition;
  id: string;
  name: string | null;
  position: number;
  preheader: string | null;
  settings: Record<string, unknown>;
  subject: string | null;
  templateId: string | null;
  type: SequenceStepType;
  variants: SequenceStepVariant[];
  waitDays: number;
  waitHours: number;
};

export type SequenceRunState =
  | { reason: string; state: "noop" }
  | {
      currentStepPosition: number;
      dealId: string | null;
      enrollmentId: string;
      org: RunOrganization;
      orgId: string | null;
      ownerId: string;
      person: RunPerson;
      sequence: {
        channel: SequenceChannel;
        dailyLimit: number;
        id: string;
        name: string;
        stopOnReply: boolean;
        timeZone: string;
        windowEnd: string;
        windowStart: string;
      };
      state: "ready";
      steps: RunStep[];
      variantAssignments: Record<string, string>;
    };

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function sequenceMetadata(
  value: Record<string, unknown> | null | undefined,
): SequenceMetadata | null {
  const raw = value?.sequence;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const metadata = raw as Record<string, unknown>;
  const enrollmentId = metadata.enrollmentId;
  const sequenceId = metadata.sequenceId;
  const stepId = metadata.stepId;
  if (
    typeof enrollmentId !== "string" ||
    typeof sequenceId !== "string" ||
    typeof stepId !== "string"
  ) {
    return null;
  }

  return {
    channel:
      metadata.channel === "gmail_1to1" || metadata.channel === "resend"
        ? metadata.channel
        : undefined,
    enrollmentId,
    sequenceId,
    stepId,
  };
}

function sequenceMetadataFromTags(
  tags: Record<string, string> | null | undefined,
): SequenceMetadata | null {
  if (!tags || tags.type !== "sequence") return null;
  const { channel, enrollmentId, sequenceId, stepId } = tags;
  if (!enrollmentId || !sequenceId || !stepId) return null;
  return {
    channel:
      channel === "gmail_1to1" || channel === "resend" ? channel : undefined,
    enrollmentId,
    sequenceId,
    stepId,
  };
}

export function sequenceSignalFromMessageMetadata(input: {
  messageId?: string;
  metadata: Record<string, unknown> | null | undefined;
  occurredAt: Date;
  ownerId: string;
  providerEventId?: string;
  recipientEmail?: string | null;
  trackingId?: string | null;
  type: SequenceSignalType;
  url?: string | null;
}): SequenceSignalPayload | null {
  const metadata = sequenceMetadata(input.metadata);
  if (!metadata) return null;
  return {
    enrollmentId: metadata.enrollmentId,
    messageId: input.messageId,
    occurredAt: input.occurredAt.toISOString(),
    ownerId: input.ownerId,
    providerEventId: input.providerEventId,
    recipientEmail: input.recipientEmail,
    sequenceId: metadata.sequenceId,
    stepId: metadata.stepId,
    trackingId: input.trackingId,
    type: input.type,
    url: input.url,
  };
}

export function sequenceSignalFromResendTags(input: {
  occurredAt: Date;
  ownerId: string;
  providerEventId?: string;
  recipientEmail?: string | null;
  tags: Record<string, string> | null | undefined;
  type: SequenceSignalType;
  url?: string | null;
}): SequenceSignalPayload | null {
  const metadata = sequenceMetadataFromTags(input.tags);
  if (!metadata) return null;
  return {
    enrollmentId: metadata.enrollmentId,
    occurredAt: input.occurredAt.toISOString(),
    ownerId: input.ownerId,
    providerEventId: input.providerEventId,
    recipientEmail: input.recipientEmail,
    sequenceId: metadata.sequenceId,
    stepId: metadata.stepId,
    type: input.type,
    url: input.url,
  };
}

export async function emitSequenceSignal(payload: SequenceSignalPayload) {
  await inngest.send({
    data: payload,
    name: SEQUENCE_SIGNAL_EVENT,
  });
}

export async function emitSequenceSignalSafely(
  payload: SequenceSignalPayload | null,
) {
  if (!payload) return;
  try {
    await emitSequenceSignal(payload);
  } catch (error) {
    console.error("No se pudo emitir la señal de secuencia", error);
  }
}

export async function emitSequenceSignals(payloads: SequenceSignalPayload[]) {
  for (const payload of payloads) {
    await emitSequenceSignal(payload);
  }
}

const SEQUENCE_SIGNAL_TYPES: SequenceSignalType[] = [
  "bounce",
  "click",
  "open",
  "reply",
  "unsubscribe",
];

/** Reconstruye el payload de señal desde los datos crudos de un evento Inngest. */
export function parseSequenceSignal(
  data: unknown,
): SequenceSignalPayload | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const { enrollmentId, ownerId, sequenceId, type } = d;
  if (
    typeof enrollmentId !== "string" ||
    typeof ownerId !== "string" ||
    typeof sequenceId !== "string" ||
    typeof type !== "string" ||
    !SEQUENCE_SIGNAL_TYPES.includes(type as SequenceSignalType)
  ) {
    return null;
  }
  return {
    enrollmentId,
    messageId: typeof d.messageId === "string" ? d.messageId : undefined,
    occurredAt:
      typeof d.occurredAt === "string"
        ? d.occurredAt
        : new Date().toISOString(),
    ownerId,
    providerEventId:
      typeof d.providerEventId === "string" ? d.providerEventId : undefined,
    recipientEmail:
      typeof d.recipientEmail === "string" ? d.recipientEmail : null,
    sequenceId,
    stepId: typeof d.stepId === "string" ? d.stepId : "",
    trackingId: typeof d.trackingId === "string" ? d.trackingId : null,
    type: type as SequenceSignalType,
    url: typeof d.url === "string" ? d.url : null,
  };
}

function eventTypeForSignal(type: SequenceSignalType): EmailEventType {
  return type === "unsubscribe" ? "unsubscribe" : type;
}

export async function hasSequenceSignal(input: {
  enrollmentId: string;
  type: SequenceSignalType;
}) {
  const [event] = await db
    .select({ id: emailEvents.id })
    .from(emailEvents)
    .where(
      and(
        eq(emailEvents.type, eventTypeForSignal(input.type)),
        sql`${emailEvents.meta}->'sequence'->>'enrollmentId' = ${input.enrollmentId}`,
      ),
    )
    .limit(1);
  return Boolean(event);
}

function statusForSuppression(
  reason: "not_subscribed" | "suppressed",
): SequenceEnrollmentStatus {
  return reason === "not_subscribed" ? "unsubscribed" : "stopped";
}

async function stopEnrollment(
  enrollmentId: string,
  status: SequenceEnrollmentStatus,
  reason: string,
) {
  await db
    .update(enrollments)
    .set({
      lastEventAt: new Date(),
      nextRunAt: null,
      status,
      stopReason: reason,
      stoppedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(enrollments.id, enrollmentId));
}

async function assertRecipientCanReceive(
  state: Extract<SequenceRunState, { state: "ready" }>,
) {
  const email = normalizeEmail(state.person.email ?? "");
  if (!email) {
    await stopEnrollment(state.enrollmentId, "failed", "missing_email");
    throw new SequenceRunError(
      "El contacto inscrito no tiene email.",
      "invalid_recipient",
    );
  }

  if (state.person.marketingStatus !== "subscribed") {
    await stopEnrollment(
      state.enrollmentId,
      statusForSuppression("not_subscribed"),
      "marketing_status_not_subscribed",
    );
    throw new SequenceRunError(
      "El contacto no está suscrito para recibir emails.",
      "not_subscribed",
    );
  }

  const [suppression] = await db
    .select({ id: suppressions.id })
    .from(suppressions)
    .where(
      and(
        eq(suppressions.ownerId, state.ownerId),
        eq(suppressions.emailNormalized, email),
      ),
    )
    .limit(1);
  if (suppression) {
    await stopEnrollment(
      state.enrollmentId,
      statusForSuppression("suppressed"),
      "email_suppressed",
    );
    throw new SequenceRunError(
      "El email está en la lista de supresión.",
      "suppressed",
    );
  }

  return email;
}

export async function loadSequenceRun(
  enrollmentId: string,
): Promise<SequenceRunState> {
  const [row] = await db
    .select({
      currentStepPosition: enrollments.currentStepPosition,
      dealId: deals.id,
      enrollmentContext: enrollments.context,
      enrollmentId: enrollments.id,
      enrollmentStatus: enrollments.status,
      orgCustomFields: organizations.customFields,
      orgId: organizations.id,
      orgIndustry: organizations.industry,
      orgName: organizations.name,
      orgTradeName: organizations.tradeName,
      orgWebsite: organizations.website,
      ownerId: enrollments.ownerId,
      personCustomFields: persons.customFields,
      personCampaign: persons.campaign,
      personEmail: persons.email,
      personFirstName: persons.firstName,
      personId: persons.id,
      personLastName: persons.lastName,
      personMarketingStatus: persons.marketingStatus,
      personPhone: persons.phone,
      personSource: persons.source,
      personTitle: persons.title,
      sequenceChannel: sequences.channel,
      sequenceDailyLimit: sequences.dailyLimit,
      sequenceId: sequences.id,
      sequenceName: sequences.name,
      sequenceStatus: sequences.status,
      sequenceStopOnReply: sequences.stopOnReply,
      sequenceTimeZone: sequences.timeZone,
      sequenceWindowEnd: sequences.windowEnd,
      sequenceWindowStart: sequences.windowStart,
    })
    .from(enrollments)
    .innerJoin(
      sequences,
      and(
        eq(enrollments.sequenceId, sequences.id),
        eq(sequences.ownerId, enrollments.ownerId),
      ),
    )
    .innerJoin(
      persons,
      and(
        eq(enrollments.personId, persons.id),
        eq(persons.ownerId, enrollments.ownerId),
        isNull(persons.deletedAt),
      ),
    )
    .leftJoin(
      organizations,
      and(
        eq(enrollments.orgId, organizations.id),
        eq(organizations.ownerId, enrollments.ownerId),
        isNull(organizations.deletedAt),
      ),
    )
    .leftJoin(
      deals,
      and(
        eq(enrollments.dealId, deals.id),
        eq(deals.ownerId, enrollments.ownerId),
        isNull(deals.deletedAt),
      ),
    )
    .where(eq(enrollments.id, enrollmentId))
    .limit(1);

  if (!row) {
    throw new SequenceRunError("Inscripción no encontrada.", "not_found");
  }
  if (row.enrollmentStatus !== "active") {
    return { reason: row.enrollmentStatus, state: "noop" };
  }
  if (row.sequenceStatus !== "active") {
    return { reason: "inactive_sequence", state: "noop" };
  }

  const steps = await db
    .select({
      bodyHtml: sequenceSteps.bodyHtml,
      bodyText: sequenceSteps.bodyText,
      channel: sequenceSteps.channel,
      condition: sequenceSteps.condition,
      id: sequenceSteps.id,
      name: sequenceSteps.name,
      position: sequenceSteps.position,
      preheader: sequenceSteps.preheader,
      settings: sequenceSteps.settings,
      subject: sequenceSteps.subject,
      templateId: sequenceSteps.templateId,
      type: sequenceSteps.type,
      variants: sequenceSteps.variants,
      waitDays: sequenceSteps.waitDays,
      waitHours: sequenceSteps.waitHours,
    })
    .from(sequenceSteps)
    .where(
      and(
        eq(sequenceSteps.sequenceId, row.sequenceId),
        eq(sequenceSteps.ownerId, row.ownerId),
      ),
    )
    .orderBy(sequenceSteps.position);

  if (steps.length === 0) {
    await stopEnrollment(row.enrollmentId, "failed", "sequence_has_no_steps");
    throw new SequenceRunError(
      "La secuencia no tiene pasos.",
      "invalid_enrollment",
    );
  }

  return {
    currentStepPosition: row.currentStepPosition,
    dealId: row.dealId,
    enrollmentId: row.enrollmentId,
    org: row.orgName
      ? {
          customFields: row.orgCustomFields ?? {},
          industry: row.orgIndustry,
          name: row.orgName,
          tradeName: row.orgTradeName,
          website: row.orgWebsite,
        }
      : null,
    orgId: row.orgId,
    ownerId: row.ownerId,
    person: {
      campaign: row.personCampaign,
      customFields: row.personCustomFields ?? {},
      email: row.personEmail,
      firstName: row.personFirstName,
      id: row.personId,
      lastName: row.personLastName,
      marketingStatus: row.personMarketingStatus,
      phone: row.personPhone,
      source: row.personSource,
      title: row.personTitle,
    },
    sequence: {
      channel: row.sequenceChannel,
      dailyLimit: row.sequenceDailyLimit,
      id: row.sequenceId,
      name: row.sequenceName,
      stopOnReply: row.sequenceStopOnReply,
      timeZone: row.sequenceTimeZone,
      windowEnd: row.sequenceWindowEnd,
      windowStart: row.sequenceWindowStart,
    },
    state: "ready",
    steps,
    variantAssignments: row.enrollmentContext?.variantAssignments ?? {},
  };
}

export async function markEnrollmentStep(input: {
  enrollmentId: string;
  position: number;
  stepId: string;
}) {
  await db
    .update(enrollments)
    .set({
      currentStepId: input.stepId,
      currentStepPosition: input.position,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(enrollments.id, input.enrollmentId));
}

export function sequenceStepSleepDuration(
  step: Pick<RunStep, "waitDays" | "waitHours">,
) {
  const totalHours = step.waitDays * 24 + step.waitHours;
  if (totalHours <= 0) return "1s";
  if (step.waitHours === 0) return `${step.waitDays}d`;
  return `${totalHours}h`;
}

export function sequenceConditionTimeout() {
  const days = Number.parseInt(
    process.env.SEQUENCE_CONDITION_TIMEOUT_DAYS ?? "",
    10,
  );
  const safeDays = Number.isFinite(days) ? Math.min(Math.max(days, 1), 90) : 7;
  return `${safeDays}d`;
}

export function sequenceSignalMatchExpression(
  enrollmentId: string,
  type: SequenceSignalType,
) {
  return [
    `async.data.enrollmentId == ${JSON.stringify(enrollmentId)}`,
    `async.data.type == ${JSON.stringify(type)}`,
  ].join(" && ");
}

export function sequenceConditionSignalType(
  condition: SequenceStepCondition,
): SequenceSignalType | null {
  switch (condition.kind) {
    case "clicked":
      return "click";
    case "not_replied":
    case "replied":
      return "reply";
    case "opened":
      return "open";
    default:
      return null;
  }
}

function sequenceStepMetadata(
  state: Extract<SequenceRunState, { state: "ready" }>,
  step: RunStep,
): SequenceMetadata {
  return {
    channel: step.channel ?? state.sequence.channel,
    enrollmentId: state.enrollmentId,
    sequenceId: state.sequence.id,
    stepId: step.id,
  };
}

function metadataPatch(metadata: SequenceMetadata) {
  return { sequence: metadata };
}

async function tagGmailMessage(input: {
  messageId: string;
  metadata: SequenceMetadata;
}) {
  const patch = JSON.stringify(metadataPatch(input.metadata));
  await db
    .update(emailMessages)
    .set({
      metadata: sql`${emailMessages.metadata} || ${patch}::jsonb`,
      updatedAt: new Date(),
    })
    .where(eq(emailMessages.id, input.messageId));

  await db
    .update(emailEvents)
    .set({
      meta: sql`${emailEvents.meta} || ${patch}::jsonb`,
    })
    .where(
      and(
        eq(emailEvents.messageId, input.messageId),
        eq(emailEvents.type, "sent"),
      ),
    );
}

export type SequenceVariantChoice = {
  bodyHtml: string;
  bodyText: string;
  id: string;
  subject: string;
};

/** Selección ponderada entre variantes (peso entero ≥ 1). */
export function pickWeightedVariant<T extends { weight?: number | null }>(
  variants: T[],
  rand: () => number = Math.random,
): T | null {
  if (variants.length === 0) return null;
  const weights = variants.map((v) => Math.max(1, Math.floor(v.weight ?? 1)));
  const total = weights.reduce((sum, w) => sum + w, 0);
  let threshold = rand() * total;
  for (let i = 0; i < variants.length; i += 1) {
    threshold -= weights[i]!;
    if (threshold < 0) return variants[i]!;
  }
  return variants[variants.length - 1]!;
}

/**
 * Resuelve la variante A/B de un paso de email (Fase 5.7). El propio paso es la
 * "Variante A" (id = step.id, peso 1); `step.variants` son las alternativas. Si la
 * inscripción ya tenía una asignación válida la reutiliza (estable ante reintentos); si
 * no, elige una ponderada. Sin variantes, devuelve siempre el contenido base.
 */
export function resolveEmailVariant(input: {
  assignedId?: string | null;
  rand?: () => number;
  step: RunStep;
}): { alreadyAssigned: boolean; choice: SequenceVariantChoice } {
  const base: SequenceVariantChoice = {
    bodyHtml: input.step.bodyHtml ?? "",
    bodyText: input.step.bodyText ?? "",
    id: input.step.id,
    subject: input.step.subject ?? "",
  };
  const variants = input.step.variants ?? [];
  if (variants.length === 0) return { alreadyAssigned: true, choice: base };

  const pool = [
    { choice: base, weight: 1 },
    ...variants.map((variant) => ({
      choice: {
        bodyHtml: clean(variant.bodyHtml ?? null) ?? base.bodyHtml,
        bodyText: variant.bodyText ?? base.bodyText,
        id: variant.id,
        subject: clean(variant.subject ?? null) ?? base.subject,
      },
      weight: Math.max(1, Math.floor(variant.weight ?? 1)),
    })),
  ];

  if (input.assignedId) {
    const existing = pool.find((item) => item.choice.id === input.assignedId);
    if (existing) return { alreadyAssigned: true, choice: existing.choice };
  }

  const picked = pickWeightedVariant(pool, input.rand) ?? pool[0]!;
  return { alreadyAssigned: false, choice: picked.choice };
}

/** Persiste la variante elegida en `enrollments.context.variantAssignments`. */
async function persistVariantAssignment(input: {
  assignments: Record<string, string>;
  enrollmentId: string;
  stepId: string;
  variantId: string;
}) {
  const variantAssignments = {
    ...input.assignments,
    [input.stepId]: input.variantId,
  };
  const patch = JSON.stringify({ variantAssignments });
  await db
    .update(enrollments)
    .set({
      context: sql`${enrollments.context} || ${patch}::jsonb`,
      updatedAt: new Date(),
    })
    .where(eq(enrollments.id, input.enrollmentId));
}

function mergedBodies(
  content: SequenceVariantChoice,
  fallbackSubject: string,
  ctx: Record<string, string>,
) {
  const htmlSource =
    clean(content.bodyHtml) ??
    (clean(content.bodyText) ? textToHtml(content.bodyText) : "");
  return {
    bodyHtml: htmlSource
      ? renderMergeTags(htmlSource, ctx, { escapeValues: true })
      : "",
    bodyText: renderMergeTags(content.bodyText, ctx),
    subject: renderMergeTags(content.subject || fallbackSubject, ctx),
  };
}

export async function sendSequenceEmailStep(input: {
  enrollmentId: string;
  stepId: string;
}) {
  const state = await loadSequenceRun(input.enrollmentId);
  if (state.state !== "ready") return state;
  const step = state.steps.find((item) => item.id === input.stepId);
  if (!step || step.type !== "email") {
    throw new SequenceRunError("Paso de email no encontrado.", "not_found");
  }

  const email = await assertRecipientCanReceive(state);
  const defs = await listAllCustomFieldDefsForOwner(state.ownerId);
  const ctx = buildMergeContext(
    state.person,
    state.org,
    defs.person,
    defs.organization,
  );

  // Variante A/B: elige (o reutiliza) y registra la asignación de la inscripción.
  const variant = resolveEmailVariant({
    assignedId: state.variantAssignments[step.id],
    step,
  });
  if (!variant.alreadyAssigned) {
    await persistVariantAssignment({
      assignments: state.variantAssignments,
      enrollmentId: state.enrollmentId,
      stepId: step.id,
      variantId: variant.choice.id,
    });
  }

  const body = mergedBodies(variant.choice, state.sequence.name, ctx);
  const channel = step.channel ?? state.sequence.channel;
  const metadata: SequenceMetadata = {
    ...sequenceStepMetadata(state, step),
    variantId: variant.choice.id,
  };

  if (channel === "gmail_1to1") {
    const message: SendEmailValues = {
      bodyHtml: body.bodyHtml,
      bodyText: body.bodyText,
      dealId: state.dealId ?? undefined,
      orgId: state.orgId ?? undefined,
      personId: state.person.id,
      subject: body.subject,
      to: [{ email }],
    };
    const result = await sendGmailEmail(state.ownerId, message);
    await tagGmailMessage({ messageId: result.id, metadata });
    await db
      .update(enrollments)
      .set({
        lastMessageId: result.id,
        updatedAt: new Date(),
      })
      .where(eq(enrollments.id, state.enrollmentId));
    return {
      channel,
      messageId: result.id,
      providerMessageId: result.providerMessageId,
      state: "sent" as const,
    };
  }

  const from = getDefaultCampaignFrom();
  if (!from) {
    throw new SequenceRunError(
      "Configura CAMPAIGN_FROM_EMAIL para enviar por Resend.",
      "transport_error",
    );
  }

  try {
    const result = await sendResendEmail(
      {
        from,
        html: body.bodyHtml,
        subject: body.subject,
        tags: [
          { name: "type", value: "sequence" },
          { name: "channel", value: "resend" },
          { name: "sequenceId", value: state.sequence.id },
          { name: "enrollmentId", value: state.enrollmentId },
          { name: "stepId", value: step.id },
          { name: "variantId", value: variant.choice.id },
        ],
        text: body.bodyText,
        to: email,
      },
      {
        idempotencyKey: `sequence:${state.enrollmentId}:${step.id}`,
      },
    );

    await db
      .insert(emailEvents)
      .values({
        meta: { providerMessageId: result.id, sequence: metadata },
        occurredAt: new Date(),
        ownerId: state.ownerId,
        provider: "resend",
        providerEventId: `resend:sequence:${result.id}`,
        recipientEmail: email,
        type: "sent",
      })
      .onConflictDoNothing();

    return {
      channel,
      providerMessageId: result.id,
      state: "sent" as const,
    };
  } catch (error) {
    if (error instanceof ResendServiceError) {
      throw new SequenceRunError(error.message, "transport_error");
    }
    throw error;
  }
}

export type SequenceSendDecision =
  | { action: "send" }
  | { action: "wait"; reason: "daily_limit" | "window"; until: string }
  | {
      action: "wait";
      confidence: "high" | "medium";
      label: string;
      reason: "best_time";
      source: "contact" | "global";
      until: string;
    };

export type SequenceSendGate =
  | { reason: string; state: "noop" }
  | { decision: SequenceSendDecision; state: "ready" };

/** Cuenta los emails que la secuencia ya ha enviado desde `since` (eventos `sent`). */
async function countSequenceEmailsSentSince(
  ownerId: string,
  sequenceId: string,
  since: Date,
): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`count(*)` })
    .from(emailEvents)
    .where(
      and(
        eq(emailEvents.ownerId, ownerId),
        eq(emailEvents.type, "sent"),
        gte(emailEvents.occurredAt, since),
        sql`${emailEvents.meta}->'sequence'->>'sequenceId' = ${sequenceId}`,
      ),
    );
  return Number(row?.total ?? 0);
}

/**
 * Decide si la secuencia puede enviar ahora (Fase 5.6): respeta la ventana horaria y el
 * límite diario de la secuencia (contado en su zona). Si no, indica cuándo reintentar:
 * la apertura de la ventana (si está cerrada) o la del día siguiente (si se agotó el
 * cupo diario, que se reinicia a medianoche local).
 */
export async function getSequenceEmailSendDecision(input: {
  dailyLimit: number;
  now?: Date;
  ownerId: string;
  personId?: string;
  sequenceId: string;
  window: SendWindow;
}): Promise<SequenceSendDecision> {
  const now = input.now ?? new Date();

  if (!isWithinSendWindow(now, input.window)) {
    return {
      action: "wait",
      reason: "window",
      until: nextAllowedSendAt(now, input.window).toISOString(),
    };
  }

  if (input.dailyLimit > 0) {
    const since = startOfLocalDayUtc(now, input.window.timeZone);
    const sentToday = await countSequenceEmailsSentSince(
      input.ownerId,
      input.sequenceId,
      since,
    );
    if (sentToday >= input.dailyLimit) {
      return {
        action: "wait",
        reason: "daily_limit",
        until: nextDayWindowOpen(now, input.window).toISOString(),
      };
    }
  }

  if (input.personId) {
    const optimized = await getOptimizedSendTimeWait({
      now,
      ownerId: input.ownerId,
      personId: input.personId,
      window: input.window,
    });
    if (optimized) {
      return {
        action: "wait",
        confidence: optimized.advice.confidence === "high" ? "high" : "medium",
        label: optimized.effectiveLabel,
        reason: "best_time",
        source: optimized.advice.source === "contact" ? "contact" : "global",
        until: optimized.until.toISOString(),
      };
    }
  }

  return { action: "send" };
}

/** Puerta de envío de un paso de email: recarga la inscripción y decide (5.6). */
export async function gateSequenceEmailSend(
  enrollmentId: string,
): Promise<SequenceSendGate> {
  const state = await loadSequenceRun(enrollmentId);
  if (state.state !== "ready") return state;
  const decision = await getSequenceEmailSendDecision({
    dailyLimit: state.sequence.dailyLimit,
    ownerId: state.ownerId,
    personId: state.person.id,
    sequenceId: state.sequence.id,
    window: {
      timeZone: state.sequence.timeZone,
      windowEnd: state.sequence.windowEnd,
      windowStart: state.sequence.windowStart,
    },
  });
  return { decision, state: "ready" };
}

function taskSetting(settings: Record<string, unknown>, key: string): string {
  const value = settings[key];
  return typeof value === "string" ? value : "";
}

export async function createSequenceTaskStep(input: {
  enrollmentId: string;
  stepId: string;
}) {
  const state = await loadSequenceRun(input.enrollmentId);
  if (state.state !== "ready") return state;
  const step = state.steps.find((item) => item.id === input.stepId);
  if (!step || step.type !== "task") {
    throw new SequenceRunError("Paso de tarea no encontrado.", "not_found");
  }

  const subject =
    taskSetting(step.settings, "taskSubject") || step.name || "Tarea";
  const notes = taskSetting(step.settings, "taskNotes") || step.bodyText;
  const [activity] = await db
    .insert(activities)
    .values({
      dealId: state.dealId,
      dueAt: new Date(),
      notes,
      orgId: state.orgId,
      ownerId: state.ownerId,
      personId: state.person.id,
      subject,
      type: "task",
    })
    .returning({ id: activities.id });
  return { activityId: activity?.id ?? null, state: "created" as const };
}

export async function advanceEnrollment(input: {
  enrollmentId: string;
  nextPosition: number;
}) {
  await db
    .update(enrollments)
    .set({
      currentStepPosition: input.nextPosition,
      lastEventAt: new Date(),
      nextRunAt: null,
      updatedAt: new Date(),
    })
    .where(eq(enrollments.id, input.enrollmentId));
  return { nextPosition: input.nextPosition };
}

export async function completeEnrollment(enrollmentId: string) {
  await db
    .update(enrollments)
    .set({
      completedAt: new Date(),
      lastEventAt: new Date(),
      nextRunAt: null,
      status: "completed",
      updatedAt: new Date(),
    })
    .where(eq(enrollments.id, enrollmentId));
  return { status: "completed" as const };
}

export async function failEnrollment(input: {
  enrollmentId: string;
  message: string;
}) {
  await db
    .update(enrollments)
    .set({
      lastError: input.message,
      lastEventAt: new Date(),
      nextRunAt: null,
      status: "failed",
      stopReason: input.message,
      stoppedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(enrollments.id, input.enrollmentId));
}

export async function handleConditionResult(input: {
  condition: SequenceStepCondition;
  enrollmentId: string;
  matched: boolean;
}) {
  const kind = input.condition.kind;

  if (kind === "not_replied") {
    if (input.matched) {
      await stopEnrollment(input.enrollmentId, "replied", "reply_received");
      return { stop: true as const, status: "replied" as const };
    }
    return { matched: false, stop: false as const };
  }

  if (kind === "replied" || kind === "opened" || kind === "clicked") {
    if (input.matched) return { matched: true, stop: false as const };
    await stopEnrollment(input.enrollmentId, "stopped", "condition_timeout");
    return { stop: true as const, status: "stopped" as const };
  }

  return { matched: input.matched, stop: false as const };
}

/** Estado de parada asociado a cada señal que detiene una inscripción. */
const STOP_STATUS_BY_SIGNAL: Partial<
  Record<SequenceSignalType, SequenceEnrollmentStatus>
> = {
  bounce: "bounced",
  reply: "replied",
  unsubscribe: "unsubscribed",
};

export type SequenceStopOutcome =
  | { outcome: "stopped"; reason: string; status: SequenceEnrollmentStatus }
  | { outcome: "noop"; reason: string };

/**
 * Parada automática (Fase 5.5): ante una señal de respuesta/rebote/baja, detiene la
 * inscripción **activa** si la secuencia lo pide (`stop_on_reply`, o
 * `settings.stopOnBounce`/`stopOnUnsubscribe`, ambos por defecto `true`). Funciona en
 * cualquier punto del flujo (incluida una espera), no solo en pasos de condición.
 * Aperturas y clics nunca detienen. La actualización es idempotente: solo afecta a
 * inscripciones que sigan en estado `active`.
 */
export async function stopEnrollmentOnSignal(input: {
  enrollmentId: string;
  occurredAt?: string;
  ownerId: string;
  type: SequenceSignalType;
}): Promise<SequenceStopOutcome> {
  const targetStatus = STOP_STATUS_BY_SIGNAL[input.type];
  if (!targetStatus) return { outcome: "noop", reason: "non_stopping_signal" };

  const [row] = await db
    .select({
      enrollmentStatus: enrollments.status,
      sequenceSettings: sequences.settings,
      stopOnReply: sequences.stopOnReply,
    })
    .from(enrollments)
    .innerJoin(
      sequences,
      and(
        eq(enrollments.sequenceId, sequences.id),
        eq(sequences.ownerId, enrollments.ownerId),
      ),
    )
    .where(
      and(
        eq(enrollments.id, input.enrollmentId),
        eq(enrollments.ownerId, input.ownerId),
      ),
    )
    .limit(1);

  if (!row) return { outcome: "noop", reason: "not_found" };
  if (row.enrollmentStatus !== "active") {
    return { outcome: "noop", reason: `already_${row.enrollmentStatus}` };
  }

  const shouldStop =
    input.type === "reply"
      ? row.stopOnReply
      : input.type === "bounce"
        ? row.sequenceSettings.stopOnBounce ?? true
        : (row.sequenceSettings.stopOnUnsubscribe ?? true);
  if (!shouldStop) {
    return { outcome: "noop", reason: `stop_${input.type}_disabled` };
  }

  const occurred = input.occurredAt ? new Date(input.occurredAt) : new Date();
  const stoppedAt = Number.isNaN(occurred.getTime()) ? new Date() : occurred;
  const reason = `${input.type}_received`;

  const updated = await db
    .update(enrollments)
    .set({
      lastEventAt: new Date(),
      nextRunAt: null,
      status: targetStatus,
      stopReason: reason,
      stoppedAt,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(enrollments.id, input.enrollmentId),
        eq(enrollments.ownerId, input.ownerId),
        eq(enrollments.status, "active"),
      ),
    )
    .returning({ id: enrollments.id });

  if (updated.length === 0) return { outcome: "noop", reason: "race_lost" };
  return { outcome: "stopped", reason, status: targetStatus };
}
