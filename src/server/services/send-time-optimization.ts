import "server-only";

import {
  type SQL,
  and,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  or,
  sql,
} from "drizzle-orm";

import {
  SEND_TIME_SIGNAL_TYPES,
  buildSendTimeAdvice,
  effectiveSendTimeForWindow,
  sendTimeLabel,
  shouldApplySendTimeAdvice,
  type SendTimeAdvice,
  type SendTimeSignal,
  type SendTimeSignalType,
} from "@/lib/send-time-optimization";
import {
  localMinutesOfDay,
  nextLocalTimeAtOrAfter,
  validTimeZone,
  type SendWindow,
} from "@/lib/send-window";
import { db } from "@/server/db";
import {
  emailEvents,
  emailMessages,
  emailThreads,
  enrollments,
  persons,
  type EmailEventType,
} from "@/server/db/schema";

const POSITIVE_EVENT_TYPES = [...SEND_TIME_SIGNAL_TYPES] as EmailEventType[];

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeEmail(value: string | null | undefined): string | null {
  return clean(value)?.toLowerCase() ?? null;
}

function clampInt(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function optimizationConfig() {
  return {
    enabled: process.env.SEND_TIME_OPTIMIZATION_ENABLED !== "false",
    fallbackHour: clampInt(
      process.env.SEND_TIME_OPTIMIZATION_FALLBACK_HOUR,
      10,
      0,
      23,
    ),
    lookbackDays: clampInt(
      process.env.SEND_TIME_OPTIMIZATION_LOOKBACK_DAYS,
      180,
      30,
      730,
    ),
    timeZone: validTimeZone(
      process.env.SEND_TIME_OPTIMIZATION_TIME_ZONE ??
        process.env.CAMPAIGN_SEND_TIME_ZONE,
    ),
  };
}

function lookbackStart(days: number, now: Date) {
  return new Date(now.getTime() - days * 86_400_000);
}

function rowsToSignals(
  rows: { occurredAt: Date; type: EmailEventType }[],
): SendTimeSignal[] {
  return rows
    .filter((row): row is { occurredAt: Date; type: SendTimeSignalType } =>
      SEND_TIME_SIGNAL_TYPES.includes(row.type as SendTimeSignalType),
    )
    .map((row) => ({ occurredAt: row.occurredAt, type: row.type }));
}

async function loadPerson(ownerId: string, personId: string) {
  const [person] = await db
    .select({
      email: persons.email,
      firstName: persons.firstName,
      id: persons.id,
      lastName: persons.lastName,
    })
    .from(persons)
    .where(
      and(
        eq(persons.id, personId),
        eq(persons.ownerId, ownerId),
        isNull(persons.deletedAt),
      ),
    )
    .limit(1);
  return person ?? null;
}

async function loadPersonSignals(input: {
  email: string | null;
  now: Date;
  ownerId: string;
  personId: string;
}): Promise<SendTimeSignal[]> {
  const config = optimizationConfig();
  const links: SQL[] = [
    eq(emailThreads.personId, input.personId),
    eq(enrollments.personId, input.personId),
  ];
  if (input.email) {
    links.push(sql`lower(${emailEvents.recipientEmail}) = ${input.email}`);
  }

  const link = or(...links);
  if (!link) return [];

  const rows = await db
    .select({
      occurredAt: emailEvents.occurredAt,
      type: emailEvents.type,
    })
    .from(emailEvents)
    .leftJoin(emailMessages, eq(emailEvents.messageId, emailMessages.id))
    .leftJoin(emailThreads, eq(emailMessages.threadId, emailThreads.id))
    .leftJoin(
      enrollments,
      sql`${emailEvents.meta}->'sequence'->>'enrollmentId' = ${enrollments.id}::text`,
    )
    .where(
      and(
        eq(emailEvents.ownerId, input.ownerId),
        inArray(emailEvents.type, POSITIVE_EVENT_TYPES),
        gte(
          emailEvents.occurredAt,
          lookbackStart(config.lookbackDays, input.now),
        ),
        link,
      ),
    )
    .orderBy(desc(emailEvents.occurredAt))
    .limit(500);

  return rowsToSignals(rows);
}

async function loadGlobalSignals(input: {
  now: Date;
  ownerId: string;
}): Promise<SendTimeSignal[]> {
  const config = optimizationConfig();
  const rows = await db
    .select({
      occurredAt: emailEvents.occurredAt,
      type: emailEvents.type,
    })
    .from(emailEvents)
    .where(
      and(
        eq(emailEvents.ownerId, input.ownerId),
        inArray(emailEvents.type, POSITIVE_EVENT_TYPES),
        gte(
          emailEvents.occurredAt,
          lookbackStart(config.lookbackDays, input.now),
        ),
      ),
    )
    .orderBy(desc(emailEvents.occurredAt))
    .limit(5000);

  return rowsToSignals(rows);
}

export async function getPersonSendTimeAdviceForOwner(
  ownerId: string,
  personId: string,
  now = new Date(),
  timeZoneOverride?: string,
): Promise<SendTimeAdvice | null> {
  const config = optimizationConfig();
  const timeZone = validTimeZone(timeZoneOverride ?? config.timeZone);
  const person = await loadPerson(ownerId, personId);
  if (!person) return null;

  const contactSignals = await loadPersonSignals({
    email: normalizeEmail(person.email),
    now,
    ownerId,
    personId,
  });
  const contactAdvice = buildSendTimeAdvice({
    fallbackHour: config.fallbackHour,
    now,
    signals: contactSignals,
    source: contactSignals.length > 0 ? "contact" : "default",
    timeZone,
  });
  if (shouldApplySendTimeAdvice(contactAdvice)) return contactAdvice;

  const globalSignals = await loadGlobalSignals({ now, ownerId });
  const globalAdvice = buildSendTimeAdvice({
    fallbackHour: config.fallbackHour,
    now,
    signals: globalSignals,
    source: globalSignals.length > 0 ? "global" : "default",
    timeZone,
  });

  return shouldApplySendTimeAdvice(globalAdvice) ? globalAdvice : contactAdvice;
}

export type OptimizedSendTimeWait = {
  advice: SendTimeAdvice;
  effectiveLabel: string;
  until: Date;
};

export async function getOptimizedSendTimeWait(input: {
  now?: Date;
  ownerId: string;
  personId: string;
  window: SendWindow;
}): Promise<OptimizedSendTimeWait | null> {
  const config = optimizationConfig();
  if (!config.enabled) return null;

  const now = input.now ?? new Date();
  const window = {
    ...input.window,
    timeZone: validTimeZone(input.window.timeZone),
  };
  const advice = await getPersonSendTimeAdviceForOwner(
    input.ownerId,
    input.personId,
    now,
    window.timeZone,
  );
  if (!advice || !shouldApplySendTimeAdvice(advice)) return null;

  const effective = effectiveSendTimeForWindow(advice.recommendedHour, window);
  const currentMinute = localMinutesOfDay(now, window.timeZone);
  const targetMinute = effective.hour * 60 + effective.minute;
  if (currentMinute >= targetMinute && currentMinute < targetMinute + 60) {
    return null;
  }

  return {
    advice,
    effectiveLabel: sendTimeLabel(effective.hour, effective.minute),
    until: nextLocalTimeAtOrAfter({
      date: now,
      hour: effective.hour,
      minute: effective.minute,
      timeZone: window.timeZone,
    }),
  };
}
