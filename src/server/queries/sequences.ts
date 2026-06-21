import "server-only";

import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { fullName } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { db } from "@/server/db";
import {
  type MarketingStatus,
  type SequenceChannel,
  type SequenceEnrollmentStatus,
  type SequenceStatus,
  type SequenceStepCondition,
  type SequenceStepType,
  enrollments,
  persons,
  sequenceSteps,
  sequences,
} from "@/server/db/schema";

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
  taskSubject: string;
  taskNotes: string;
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
