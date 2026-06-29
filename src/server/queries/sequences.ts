import "server-only";

import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { fullName } from "@/lib/format";
import { requireUser } from "@/lib/session";
import type { CrmActionConfig } from "@/lib/validations/sequence";
import { db } from "@/server/db";
import {
  type MarketingStatus,
  type SequenceChannel,
  type SequenceEnrollmentStatus,
  type SequenceStatus,
  type SequenceStepCondition,
  type SequenceStepType,
  type SequenceStepVariant,
  emailEvents,
  enrollments,
  labels,
  persons,
  pipelines,
  sequenceSteps,
  sequences,
  stages,
} from "@/server/db/schema";
import { ensureDefaultPipeline } from "@/server/queries/deals";

export type SequenceStepListItem = {
  id: string;
  localId: string;
  type: SequenceStepType;
  position: number;
  name: string;
  channel: SequenceChannel | null;
  waitDays: number;
  waitHours: number;
  templateId: string | null;
  subject: string;
  preheader: string;
  bodyHtml: string;
  bodyText: string;
  condition: SequenceStepCondition;
  variants: SequenceStepVariant[];
  taskSubject: string;
  taskNotes: string;
  action: CrmActionConfig | null;
};

export type SequenceEnrollmentSummary = {
  total: number;
  active: number;
  completed: number;
  stopped: number;
  replied: number;
  bounced: number;
  unsubscribed: number;
  failed: number;
};

export type SequenceListItem = {
  id: string;
  name: string;
  description: string;
  status: SequenceStatus;
  channel: SequenceChannel;
  stopOnReply: boolean;
  dailyLimit: number;
  windowStart: string;
  windowEnd: string;
  timeZone: string;
  steps: SequenceStepListItem[];
  enrollmentSummary: SequenceEnrollmentSummary;
  updatedAt: string;
  createdAt: string;
};

export type SequenceEnrollmentSequenceOption = {
  canEnroll: boolean;
  id: string;
  name: string;
  status: SequenceStatus;
  stepCount: number;
};

export type SequenceEnrollmentPersonOption = {
  email: string | null;
  id: string;
  marketingStatus: MarketingStatus;
  name: string;
};

type EnrollmentSummaryRow = {
  sequenceId: string;
  total: number;
  active: number;
  completed: number;
  stopped: number;
  replied: number;
  bounced: number;
  unsubscribed: number;
  failed: number;
};

const EMPTY_SUMMARY: SequenceEnrollmentSummary = {
  active: 0,
  bounced: 0,
  completed: 0,
  failed: 0,
  replied: 0,
  stopped: 0,
  total: 0,
  unsubscribed: 0,
};

function textSetting(settings: Record<string, unknown>, key: string): string {
  const value = settings[key];
  return typeof value === "string" ? value : "";
}

function stepLocalId(id: string): string {
  return `step-${id}`;
}

function enrollmentSummaryByStatus(
  rows: EnrollmentSummaryRow[],
): Map<string, SequenceEnrollmentSummary> {
  return new Map(
    rows.map((row) => [
      row.sequenceId,
      {
        active: row.active,
        bounced: row.bounced,
        completed: row.completed,
        failed: row.failed,
        replied: row.replied,
        stopped: row.stopped,
        total: row.total,
        unsubscribed: row.unsubscribed,
      },
    ]),
  );
}

export async function listSequences(): Promise<SequenceListItem[]> {
  const user = await requireUser();
  const rows = await db
    .select({
      id: sequences.id,
      name: sequences.name,
      description: sequences.description,
      status: sequences.status,
      channel: sequences.channel,
      stopOnReply: sequences.stopOnReply,
      dailyLimit: sequences.dailyLimit,
      windowStart: sequences.windowStart,
      windowEnd: sequences.windowEnd,
      timeZone: sequences.timeZone,
      updatedAt: sequences.updatedAt,
      createdAt: sequences.createdAt,
    })
    .from(sequences)
    .where(eq(sequences.ownerId, user.id))
    .orderBy(desc(sequences.updatedAt));

  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  const [stepRows, summaryRows] = await Promise.all([
    db
      .select({
        id: sequenceSteps.id,
        sequenceId: sequenceSteps.sequenceId,
        type: sequenceSteps.type,
        position: sequenceSteps.position,
        name: sequenceSteps.name,
        channel: sequenceSteps.channel,
        waitDays: sequenceSteps.waitDays,
        waitHours: sequenceSteps.waitHours,
        templateId: sequenceSteps.templateId,
        subject: sequenceSteps.subject,
        preheader: sequenceSteps.preheader,
        bodyHtml: sequenceSteps.bodyHtml,
        bodyText: sequenceSteps.bodyText,
        condition: sequenceSteps.condition,
        variants: sequenceSteps.variants,
        settings: sequenceSteps.settings,
      })
      .from(sequenceSteps)
      .where(inArray(sequenceSteps.sequenceId, ids))
      .orderBy(asc(sequenceSteps.sequenceId), asc(sequenceSteps.position)),
    db
      .select({
        sequenceId: enrollments.sequenceId,
        total: sql<number>`count(*)::int`,
        active: statusCount("active"),
        completed: statusCount("completed"),
        stopped: statusCount("stopped"),
        replied: statusCount("replied"),
        bounced: statusCount("bounced"),
        unsubscribed: statusCount("unsubscribed"),
        failed: statusCount("failed"),
      })
      .from(enrollments)
      .where(inArray(enrollments.sequenceId, ids))
      .groupBy(enrollments.sequenceId),
  ]);

  const stepsBySequence = new Map<string, SequenceStepListItem[]>();
  for (const step of stepRows) {
    const settings = step.settings;
    const item: SequenceStepListItem = {
      action:
        settings.action &&
        typeof settings.action === "object" &&
        !Array.isArray(settings.action)
          ? (settings.action as CrmActionConfig)
          : null,
      bodyHtml: step.bodyHtml ?? "",
      bodyText: step.bodyText ?? "",
      channel: step.channel,
      condition: step.condition,
      id: step.id,
      localId: stepLocalId(step.id),
      name: step.name ?? "",
      position: step.position,
      preheader: step.preheader ?? "",
      subject: step.subject ?? "",
      taskNotes: textSetting(settings, "taskNotes"),
      taskSubject: textSetting(settings, "taskSubject") || (step.name ?? ""),
      templateId: step.templateId,
      type: step.type,
      variants: step.variants ?? [],
      waitDays: step.waitDays,
      waitHours: step.waitHours,
    };
    const current = stepsBySequence.get(step.sequenceId) ?? [];
    current.push(item);
    stepsBySequence.set(step.sequenceId, current);
  }

  const summaries = enrollmentSummaryByStatus(summaryRows);

  return rows.map((row) => ({
    channel: row.channel,
    createdAt: row.createdAt.toISOString(),
    dailyLimit: row.dailyLimit,
    description: row.description ?? "",
    enrollmentSummary: summaries.get(row.id) ?? EMPTY_SUMMARY,
    id: row.id,
    name: row.name,
    status: row.status,
    steps: stepsBySequence.get(row.id) ?? [],
    stopOnReply: row.stopOnReply,
    timeZone: row.timeZone,
    updatedAt: row.updatedAt.toISOString(),
    windowEnd: row.windowEnd,
    windowStart: row.windowStart,
  }));
}

function statusCount(status: SequenceEnrollmentStatus) {
  return sql<number>`count(*) filter (where ${enrollments.status} = ${status})::int`;
}

export async function listSequenceEnrollmentOptions(): Promise<
  SequenceEnrollmentSequenceOption[]
> {
  const user = await requireUser();
  const rows = await db
    .select({
      id: sequences.id,
      name: sequences.name,
      status: sequences.status,
      stepCount: sql<number>`count(${sequenceSteps.id})::int`,
    })
    .from(sequences)
    .leftJoin(sequenceSteps, eq(sequenceSteps.sequenceId, sequences.id))
    .where(eq(sequences.ownerId, user.id))
    .groupBy(sequences.id)
    .orderBy(asc(sequences.name))
    .limit(500);

  return rows.map((row) => ({
    canEnroll: row.status === "active" && row.stepCount > 0,
    id: row.id,
    name: row.name,
    status: row.status,
    stepCount: row.stepCount,
  }));
}

export async function listSequencePersonOptions(): Promise<
  SequenceEnrollmentPersonOption[]
> {
  const user = await requireUser();
  const rows = await db
    .select({
      email: persons.email,
      firstName: persons.firstName,
      id: persons.id,
      lastName: persons.lastName,
      marketingStatus: persons.marketingStatus,
    })
    .from(persons)
    .where(and(eq(persons.ownerId, user.id), isNull(persons.deletedAt)))
    .orderBy(asc(persons.firstName), asc(persons.lastName))
    .limit(500);

  return rows.map((person) => ({
    email: person.email,
    id: person.id,
    marketingStatus: person.marketingStatus,
    name: fullName(person.firstName, person.lastName),
  }));
}

// --- Opciones del paso "Acción CRM" (Fase T.3) ------------------------------
export type SequenceCrmActionOptions = {
  pipelines: { id: string; name: string; stages: { id: string; name: string }[] }[];
  labels: { id: string; name: string; color: string }[];
  sequences: { id: string; name: string; canEnroll: boolean }[];
};

/** Opciones owner-aware para configurar un paso de acción CRM en el builder. */
export async function listSequenceCrmActionOptions(): Promise<SequenceCrmActionOptions> {
  const user = await requireUser();
  await ensureDefaultPipeline(user.id);

  const [pipelineRows, stageRows, labelRows, sequenceRows] = await Promise.all([
    db
      .select({ id: pipelines.id, name: pipelines.name })
      .from(pipelines)
      .where(eq(pipelines.ownerId, user.id))
      .orderBy(asc(pipelines.position), asc(pipelines.createdAt)),
    db
      .select({
        id: stages.id,
        name: stages.name,
        pipelineId: stages.pipelineId,
      })
      .from(stages)
      .where(eq(stages.ownerId, user.id))
      .orderBy(asc(stages.position), asc(stages.createdAt)),
    db
      .select({ id: labels.id, name: labels.name, color: labels.color })
      .from(labels)
      .where(eq(labels.ownerId, user.id))
      .orderBy(asc(labels.name)),
    db
      .select({
        id: sequences.id,
        name: sequences.name,
        status: sequences.status,
        stepCount: sql<number>`count(${sequenceSteps.id})::int`,
      })
      .from(sequences)
      .leftJoin(sequenceSteps, eq(sequenceSteps.sequenceId, sequences.id))
      .where(eq(sequences.ownerId, user.id))
      .groupBy(sequences.id)
      .orderBy(asc(sequences.name))
      .limit(500),
  ]);

  const stagesByPipeline = new Map<string, { id: string; name: string }[]>();
  for (const stage of stageRows) {
    const list = stagesByPipeline.get(stage.pipelineId) ?? [];
    list.push({ id: stage.id, name: stage.name });
    stagesByPipeline.set(stage.pipelineId, list);
  }

  return {
    labels: labelRows,
    pipelines: pipelineRows.map((pipeline) => ({
      id: pipeline.id,
      name: pipeline.name,
      stages: stagesByPipeline.get(pipeline.id) ?? [],
    })),
    sequences: sequenceRows.map((row) => ({
      canEnroll: row.status === "active" && row.stepCount > 0,
      id: row.id,
      name: row.name,
    })),
  };
}

// --- Panel de la secuencia (Fase 5.8) ---------------------------------------
export type SequencePanelStep = {
  id: string;
  position: number;
  type: SequenceStepType;
  name: string;
  subject: string;
  variants: SequenceStepVariant[];
};

export type SequencePanelStatusSummary = SequenceEnrollmentSummary & {
  paused: number;
};

export type SequencePanelMetrics = {
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
  unsubscribed: number;
};

export type SequencePanelVariantRow = {
  stepId: string;
  variantId: string;
  sent: number;
  opened: number;
  clicked: number;
};

export type SequencePanelEnrollment = {
  id: string;
  personId: string;
  personName: string;
  email: string | null;
  status: SequenceEnrollmentStatus;
  currentStepPosition: number;
  enrolledAt: string;
  lastEventAt: string | null;
  stopReason: string | null;
};

export type SequencePanel = {
  sequence: {
    id: string;
    name: string;
    description: string;
    status: SequenceStatus;
    channel: SequenceChannel;
    stopOnReply: boolean;
    dailyLimit: number;
    windowStart: string;
    windowEnd: string;
    timeZone: string;
    updatedAt: string;
    steps: SequencePanelStep[];
  };
  summary: SequencePanelStatusSummary;
  metrics: SequencePanelMetrics;
  variantRows: SequencePanelVariantRow[];
  enrollments: SequencePanelEnrollment[];
  enrollmentCount: number;
  enrollmentLimit: number;
};

const SEQUENCE_PANEL_ENROLLMENT_LIMIT = 200;

/** Detalle de una secuencia con métricas e inscritos (owner-aware). */
export async function getSequencePanel(
  id: string,
): Promise<SequencePanel | null> {
  const user = await requireUser();
  return getSequencePanelForOwner(id, user.id);
}

export async function getSequencePanelForOwner(
  id: string,
  ownerId: string,
): Promise<SequencePanel | null> {
  const [sequence] = await db
    .select({
      id: sequences.id,
      name: sequences.name,
      description: sequences.description,
      status: sequences.status,
      channel: sequences.channel,
      stopOnReply: sequences.stopOnReply,
      dailyLimit: sequences.dailyLimit,
      windowStart: sequences.windowStart,
      windowEnd: sequences.windowEnd,
      timeZone: sequences.timeZone,
      updatedAt: sequences.updatedAt,
    })
    .from(sequences)
    .where(and(eq(sequences.id, id), eq(sequences.ownerId, ownerId)))
    .limit(1);
  if (!sequence) return null;

  // `enrollmentId`/`stepId`/`variantId` extraídos de la metadata de secuencia.
  const eEnrollment = sql`${emailEvents.meta}->'sequence'->>'enrollmentId'`;
  const eStep = sql`${emailEvents.meta}->'sequence'->>'stepId'`;
  const eVariant = sql`${emailEvents.meta}->'sequence'->>'variantId'`;
  const seqMatch = sql`${emailEvents.meta}->'sequence'->>'sequenceId' = ${id}`;

  const [stepRows, summaryRow, metricsRow, variantRows, enrollmentRows, countRow] =
    await Promise.all([
      db
        .select({
          id: sequenceSteps.id,
          position: sequenceSteps.position,
          type: sequenceSteps.type,
          name: sequenceSteps.name,
          subject: sequenceSteps.subject,
          variants: sequenceSteps.variants,
        })
        .from(sequenceSteps)
        .where(
          and(
            eq(sequenceSteps.sequenceId, id),
            eq(sequenceSteps.ownerId, ownerId),
          ),
        )
        .orderBy(asc(sequenceSteps.position)),
      db
        .select({
          total: sql<number>`count(*)::int`,
          active: statusCount("active"),
          paused: statusCount("paused"),
          completed: statusCount("completed"),
          stopped: statusCount("stopped"),
          replied: statusCount("replied"),
          bounced: statusCount("bounced"),
          unsubscribed: statusCount("unsubscribed"),
          failed: statusCount("failed"),
        })
        .from(enrollments)
        .where(
          and(eq(enrollments.sequenceId, id), eq(enrollments.ownerId, ownerId)),
        ),
      db
        .select({
          sent: sql<string>`count(*) filter (where ${emailEvents.type} = 'sent')`,
          opened: sql<string>`count(distinct (${eEnrollment}, ${eStep})) filter (where ${emailEvents.type} = 'open')`,
          clicked: sql<string>`count(distinct (${eEnrollment}, ${eStep})) filter (where ${emailEvents.type} = 'click')`,
          replied: sql<string>`count(distinct ${eEnrollment}) filter (where ${emailEvents.type} = 'reply')`,
          bounced: sql<string>`count(*) filter (where ${emailEvents.type} = 'bounce')`,
          unsubscribed: sql<string>`count(*) filter (where ${emailEvents.type} = 'unsubscribe')`,
        })
        .from(emailEvents)
        .where(and(eq(emailEvents.ownerId, ownerId), seqMatch)),
      db
        .select({
          stepId: sql<string>`${eStep}`,
          variantId: sql<string>`${eVariant}`,
          sent: sql<string>`count(*) filter (where ${emailEvents.type} = 'sent')`,
          opened: sql<string>`count(distinct ${eEnrollment}) filter (where ${emailEvents.type} = 'open')`,
          clicked: sql<string>`count(distinct ${eEnrollment}) filter (where ${emailEvents.type} = 'click')`,
        })
        .from(emailEvents)
        .where(
          and(
            eq(emailEvents.ownerId, ownerId),
            seqMatch,
            sql`${eVariant} is not null`,
          ),
        )
        .groupBy(eStep, eVariant),
      db
        .select({
          id: enrollments.id,
          personId: enrollments.personId,
          firstName: persons.firstName,
          lastName: persons.lastName,
          email: persons.email,
          status: enrollments.status,
          currentStepPosition: enrollments.currentStepPosition,
          enrolledAt: enrollments.enrolledAt,
          lastEventAt: enrollments.lastEventAt,
          stopReason: enrollments.stopReason,
        })
        .from(enrollments)
        .innerJoin(persons, eq(enrollments.personId, persons.id))
        .where(
          and(eq(enrollments.sequenceId, id), eq(enrollments.ownerId, ownerId)),
        )
        .orderBy(desc(enrollments.enrolledAt))
        .limit(SEQUENCE_PANEL_ENROLLMENT_LIMIT),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(enrollments)
        .where(
          and(eq(enrollments.sequenceId, id), eq(enrollments.ownerId, ownerId)),
        ),
    ]);

  const summary: SequencePanelStatusSummary = summaryRow[0] ?? {
    active: 0,
    bounced: 0,
    completed: 0,
    failed: 0,
    paused: 0,
    replied: 0,
    stopped: 0,
    total: 0,
    unsubscribed: 0,
  };

  const metrics: SequencePanelMetrics = {
    bounced: Number(metricsRow[0]?.bounced ?? 0),
    clicked: Number(metricsRow[0]?.clicked ?? 0),
    opened: Number(metricsRow[0]?.opened ?? 0),
    replied: Number(metricsRow[0]?.replied ?? 0),
    sent: Number(metricsRow[0]?.sent ?? 0),
    unsubscribed: Number(metricsRow[0]?.unsubscribed ?? 0),
  };

  return {
    enrollmentCount: countRow[0]?.total ?? 0,
    enrollmentLimit: SEQUENCE_PANEL_ENROLLMENT_LIMIT,
    enrollments: enrollmentRows.map((row) => ({
      currentStepPosition: row.currentStepPosition,
      email: row.email,
      enrolledAt: row.enrolledAt.toISOString(),
      id: row.id,
      lastEventAt: row.lastEventAt ? row.lastEventAt.toISOString() : null,
      personId: row.personId,
      personName: fullName(row.firstName, row.lastName),
      status: row.status,
      stopReason: row.stopReason,
    })),
    metrics,
    sequence: {
      channel: sequence.channel,
      dailyLimit: sequence.dailyLimit,
      description: sequence.description ?? "",
      id: sequence.id,
      name: sequence.name,
      status: sequence.status,
      steps: stepRows.map((step) => ({
        id: step.id,
        name: step.name ?? "",
        position: step.position,
        subject: step.subject ?? "",
        type: step.type,
        variants: step.variants ?? [],
      })),
      stopOnReply: sequence.stopOnReply,
      timeZone: sequence.timeZone,
      updatedAt: sequence.updatedAt.toISOString(),
      windowEnd: sequence.windowEnd,
      windowStart: sequence.windowStart,
    },
    summary,
    variantRows: variantRows.map((row) => ({
      clicked: Number(row.clicked ?? 0),
      opened: Number(row.opened ?? 0),
      sent: Number(row.sent ?? 0),
      stepId: row.stepId,
      variantId: row.variantId,
    })),
  };
}
