import "server-only";

import { and, desc, eq, gte, inArray, isNull, or } from "drizzle-orm";

import { requireUser } from "@/lib/session";
import { db } from "@/server/db";
import {
  activities,
  deals,
  emailEvents,
  stages,
  type DealStatus,
  type EmailEventType,
  type EmailProvider,
} from "@/server/db/schema";

// --- Tipos ------------------------------------------------------------------
export type ForecastMonthPoint = {
  key: string;
  label: string;
  /** Ingreso ponderado por la probabilidad de la etapa. */
  weighted: number;
  /** Valor total (sin ponderar) de los negocios con cierre previsto ese mes. */
  value: number;
  count: number;
};

export type ActivityDayPoint = {
  key: string;
  label: string;
  completed: number;
  created: number;
};

export type WonMonthPoint = {
  key: string;
  label: string;
  count: number;
  value: number;
};

export type AnalyticsOverview = {
  kpis: {
    openDeals: number;
    openValue: number;
    forecast: number;
    wonThisMonth: { count: number; value: number };
    lostThisMonth: { count: number };
    /** % de victorias sobre los negocios cerrados en los últimos 90 días. */
    winRate: number | null;
  };
  forecastByMonth: ForecastMonthPoint[];
  activityByDay: ActivityDayPoint[];
  wonByMonth: WonMonthPoint[];
};

export type AnalyticsRawData = {
  openDeals: {
    value: number;
    probability: number;
    expectedCloseDate: Date | null;
  }[];
  closedDeals: {
    status: DealStatus;
    value: number;
    wonAt: Date | null;
    lostAt: Date | null;
  }[];
  activities: { createdAt: Date; doneAt: Date | null }[];
};

export type EmailPerformanceCounts = {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replied: number;
  unsubscribed: number;
  bounced: number;
  failed: number;
};

export type EmailPerformanceRates = {
  openRate: number | null;
  clickRate: number | null;
  replyRate: number | null;
  unsubscribeRate: number | null;
  bounceRate: number | null;
};

export type EmailPerformanceChannelKey =
  | "gmail"
  | "sequences"
  | "campaigns"
  | "other";

export type EmailPerformanceChannel = {
  key: EmailPerformanceChannelKey;
  label: string;
  counts: EmailPerformanceCounts;
  rates: EmailPerformanceRates;
};

export type EmailPerformanceDayPoint = {
  key: string;
  label: string;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  unsubscribed: number;
  bounced: number;
  totalSignals: number;
};

export type EmailPerformanceTopLink = {
  clicks: number;
  uniqueRecipients: number;
  url: string;
};

export type EmailPerformanceRecentSignal = {
  channel: EmailPerformanceChannelKey;
  channelLabel: string;
  id: string;
  occurredAt: string;
  recipientEmail: string | null;
  type: EmailEventType;
  url: string | null;
};

export type EmailPerformance = {
  activityByDay: EmailPerformanceDayPoint[];
  channels: EmailPerformanceChannel[];
  period: {
    days: number;
    end: string;
    start: string;
  };
  rates: EmailPerformanceRates;
  recentSignals: EmailPerformanceRecentSignal[];
  topLinks: EmailPerformanceTopLink[];
  totals: EmailPerformanceCounts;
};

export type EmailPerformanceRawEvent = {
  id: string;
  messageId: string | null;
  meta: Record<string, unknown>;
  occurredAt: Date;
  provider: EmailProvider;
  providerEventId: string | null;
  recipientEmail: string | null;
  trackingId: string | null;
  type: EmailEventType;
  url: string | null;
};

const FORECAST_MONTHS = 6;
const WON_MONTHS = 6;
const ACTIVITY_DAYS = 14;
const WIN_RATE_DAYS = 90;
const EMAIL_PERFORMANCE_DAYS = 30;
const EMAIL_ACTIVITY_DAYS = 14;
const EMAIL_RECENT_SIGNAL_LIMIT = 8;
const EMAIL_TOP_LINK_LIMIT = 5;
const EMAIL_PERFORMANCE_EVENT_TYPES: EmailEventType[] = [
  "sent",
  "delivered",
  "failed",
  "open",
  "click",
  "bounce",
  "complaint",
  "suppressed",
  "unsubscribe",
  "reply",
];
const EMAIL_RECENT_SIGNAL_TYPES = new Set<EmailEventType>([
  "open",
  "click",
  "reply",
  "unsubscribe",
  "bounce",
  "complaint",
  "suppressed",
  "failed",
]);
const EMAIL_COUNT_KEYS = [
  "sent",
  "delivered",
  "opened",
  "clicked",
  "replied",
  "unsubscribed",
  "bounced",
  "failed",
] as const;
type EmailPerformanceCountKey = (typeof EMAIL_COUNT_KEYS)[number];

const EMAIL_CHANNEL_LABELS: Record<EmailPerformanceChannelKey, string> = {
  campaigns: "Campañas",
  gmail: "Gmail 1:1",
  other: "Otros envíos",
  sequences: "Secuencias",
};

type EmailPerformanceInternalDay = EmailPerformanceDayPoint & {
  seen: Map<EmailPerformanceCountKey, Set<string>>;
};

const monthLabelFmt = new Intl.DateTimeFormat("es-ES", {
  month: "short",
  year: "2-digit",
});
const dayLabelFmt = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
});

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function periodStart(now: Date, days: number): Date {
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - (days - 1),
  );
}

function emptyEmailCounts(): EmailPerformanceCounts {
  return {
    bounced: 0,
    clicked: 0,
    delivered: 0,
    failed: 0,
    opened: 0,
    replied: 0,
    sent: 0,
    unsubscribed: 0,
  };
}

function emailRates(counts: EmailPerformanceCounts): EmailPerformanceRates {
  return {
    bounceRate: pct(counts.bounced, counts.sent),
    clickRate: pct(counts.clicked, counts.sent),
    openRate: pct(counts.opened, counts.sent),
    replyRate: pct(counts.replied, counts.sent),
    unsubscribeRate: pct(counts.unsubscribed, counts.sent),
  };
}

function pct(numerator: number, denominator: number): number | null {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : null;
}

function recordFromUnknown(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringFromUnknown(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function emailMetricForEvent(
  type: EmailEventType,
): EmailPerformanceCountKey | null {
  switch (type) {
    case "sent":
      return "sent";
    case "delivered":
      return "delivered";
    case "open":
      return "opened";
    case "click":
      return "clicked";
    case "reply":
      return "replied";
    case "unsubscribe":
      return "unsubscribed";
    case "bounce":
    case "complaint":
    case "suppressed":
      return "bounced";
    case "failed":
      return "failed";
    default:
      return null;
  }
}

function emailEventChannel(
  event: EmailPerformanceRawEvent,
): EmailPerformanceChannelKey {
  const meta = recordFromUnknown(event.meta) ?? {};
  const tags = recordFromUnknown(meta.tags);
  const sequence = recordFromUnknown(meta.sequence);
  const hasSequence =
    Boolean(sequence) || stringFromUnknown(tags?.type) === "sequence";
  if (hasSequence) return "sequences";
  if (
    stringFromUnknown(meta.campaignId) ??
    stringFromUnknown(tags?.campaignId)
  ) {
    return "campaigns";
  }
  if (event.provider === "gmail") return "gmail";
  return "other";
}

function emailSignalKey(event: EmailPerformanceRawEvent): string {
  if (event.messageId) return `message:${event.messageId}`;

  const meta = recordFromUnknown(event.meta) ?? {};
  const tags = recordFromUnknown(meta.tags);
  const sequence = recordFromUnknown(meta.sequence);
  const enrollmentId =
    stringFromUnknown(sequence?.enrollmentId) ??
    stringFromUnknown(tags?.enrollmentId);
  const stepId =
    stringFromUnknown(sequence?.stepId) ?? stringFromUnknown(tags?.stepId);
  if (enrollmentId) {
    const isStepSignal =
      event.type === "sent" || event.type === "open" || event.type === "click";
    return `sequence:${enrollmentId}${
      isStepSignal && stepId ? `:${stepId}` : ""
    }`;
  }

  const recipientId =
    stringFromUnknown(meta.recipientId) ?? stringFromUnknown(tags?.recipientId);
  if (recipientId) return `recipient:${recipientId}`;

  const providerMessageId =
    stringFromUnknown(meta.emailId) ??
    stringFromUnknown(meta.providerMessageId);
  const recipient = event.recipientEmail?.trim().toLowerCase();
  if (providerMessageId) {
    return `provider-message:${providerMessageId}${recipient ? `:${recipient}` : ""}`;
  }
  if (event.trackingId) return `tracking:${event.trackingId}`;
  if (recipient) return `email:${recipient}`;
  if (event.providerEventId) return `provider-event:${event.providerEventId}`;
  return `event:${event.id}`;
}

function incrementUnique(
  counts: EmailPerformanceCounts,
  seen: Map<EmailPerformanceCountKey, Set<string>>,
  metric: EmailPerformanceCountKey,
  key: string,
) {
  const metricSeen = seen.get(metric);
  if (!metricSeen || metricSeen.has(key)) return;
  metricSeen.add(key);
  counts[metric] += 1;
}

function emptySeenSets(): Map<EmailPerformanceCountKey, Set<string>> {
  return new Map(EMAIL_COUNT_KEYS.map((key) => [key, new Set<string>()]));
}

function incrementActivityDay(
  day: EmailPerformanceInternalDay,
  metric: EmailPerformanceCountKey,
  key: string,
) {
  const metricSeen = day.seen.get(metric);
  if (!metricSeen || metricSeen.has(key)) return;
  metricSeen.add(key);

  switch (metric) {
    case "sent":
      day.sent += 1;
      break;
    case "opened":
      day.opened += 1;
      break;
    case "clicked":
      day.clicked += 1;
      break;
    case "replied":
      day.replied += 1;
      break;
    case "unsubscribed":
      day.unsubscribed += 1;
      break;
    case "bounced":
      day.bounced += 1;
      break;
    default:
      break;
  }
}

/**
 * Agregación pura del panel de analítica (sin IO). Separada de la consulta para
 * poder verificarla con datos sintéticos y un reloj fijo (`now`). Reparte por
 * meses/días en la zona horaria del servidor, coherente con el resto del CRM.
 */
export function computeAnalyticsOverview(
  data: AnalyticsRawData,
  now: Date = new Date(),
): AnalyticsOverview {
  // --- Negocios abiertos: KPIs + previsión por mes de cierre previsto -------
  let openValue = 0;
  let forecast = 0;

  const forecastByMonth: ForecastMonthPoint[] = [];
  const forecastIndex = new Map<string, ForecastMonthPoint>();
  for (let i = 0; i < FORECAST_MONTHS; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const point: ForecastMonthPoint = {
      key: monthKey(d),
      label: monthLabelFmt.format(d),
      weighted: 0,
      value: 0,
      count: 0,
    };
    forecastByMonth.push(point);
    forecastIndex.set(point.key, point);
  }

  for (const deal of data.openDeals) {
    const weighted = deal.value * (deal.probability / 100);
    openValue += deal.value;
    forecast += weighted;
    if (deal.expectedCloseDate) {
      const point = forecastIndex.get(monthKey(deal.expectedCloseDate));
      if (point) {
        point.weighted += weighted;
        point.value += deal.value;
        point.count += 1;
      }
    }
  }

  // --- Cerrados: ganados por mes, este mes y tasa de victoria (90 días) -----
  const wonByMonth: WonMonthPoint[] = [];
  const wonIndex = new Map<string, WonMonthPoint>();
  for (let i = WON_MONTHS - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const point: WonMonthPoint = {
      key: monthKey(d),
      label: monthLabelFmt.format(d),
      count: 0,
      value: 0,
    };
    wonByMonth.push(point);
    wonIndex.set(point.key, point);
  }

  const thisMonth = monthKey(now);
  const winRateSince = new Date(now.getTime() - WIN_RATE_DAYS * 86_400_000);
  let wonThisMonthCount = 0;
  let wonThisMonthValue = 0;
  let lostThisMonthCount = 0;
  let won90 = 0;
  let lost90 = 0;

  for (const deal of data.closedDeals) {
    if (deal.status === "won" && deal.wonAt) {
      const point = wonIndex.get(monthKey(deal.wonAt));
      if (point) {
        point.count += 1;
        point.value += deal.value;
      }
      if (monthKey(deal.wonAt) === thisMonth) {
        wonThisMonthCount += 1;
        wonThisMonthValue += deal.value;
      }
      if (deal.wonAt >= winRateSince) won90 += 1;
    } else if (deal.status === "lost" && deal.lostAt) {
      if (monthKey(deal.lostAt) === thisMonth) lostThisMonthCount += 1;
      if (deal.lostAt >= winRateSince) lost90 += 1;
    }
  }

  const winRate =
    won90 + lost90 > 0 ? Math.round((won90 / (won90 + lost90)) * 100) : null;

  // --- Actividad por día (últimos 14 días) ----------------------------------
  const activityByDay: ActivityDayPoint[] = [];
  const activityIndex = new Map<string, ActivityDayPoint>();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let i = ACTIVITY_DAYS - 1; i >= 0; i--) {
    const d = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - i,
    );
    const point: ActivityDayPoint = {
      key: dayKey(d),
      label: dayLabelFmt.format(d),
      completed: 0,
      created: 0,
    };
    activityByDay.push(point);
    activityIndex.set(point.key, point);
  }
  for (const act of data.activities) {
    const created = activityIndex.get(dayKey(act.createdAt));
    if (created) created.created += 1;
    if (act.doneAt) {
      const done = activityIndex.get(dayKey(act.doneAt));
      if (done) done.completed += 1;
    }
  }

  return {
    kpis: {
      openDeals: data.openDeals.length,
      openValue,
      forecast,
      wonThisMonth: { count: wonThisMonthCount, value: wonThisMonthValue },
      lostThisMonth: { count: lostThisMonthCount },
      winRate,
    },
    forecastByMonth,
    activityByDay,
    wonByMonth,
  };
}

/** Agregación pura del rendimiento de email transversal (Gmail, secuencias y campañas). */
export function computeEmailPerformance(
  events: EmailPerformanceRawEvent[],
  now: Date = new Date(),
): EmailPerformance {
  const start = periodStart(now, EMAIL_PERFORMANCE_DAYS);
  const activityStart = periodStart(now, EMAIL_ACTIVITY_DAYS);

  const totals = emptyEmailCounts();
  const totalSeen = emptySeenSets();
  const channelEntries = (
    Object.keys(EMAIL_CHANNEL_LABELS) as EmailPerformanceChannelKey[]
  ).map((key) => ({
    counts: emptyEmailCounts(),
    key,
    seen: emptySeenSets(),
  }));
  const channelMap = new Map(channelEntries.map((entry) => [entry.key, entry]));

  const activityInternal: EmailPerformanceInternalDay[] = [];
  const activityIndex = new Map<string, EmailPerformanceInternalDay>();
  for (let i = EMAIL_ACTIVITY_DAYS - 1; i >= 0; i--) {
    const d = new Date(
      activityStart.getFullYear(),
      activityStart.getMonth(),
      activityStart.getDate() + (EMAIL_ACTIVITY_DAYS - 1 - i),
    );
    const point = {
      bounced: 0,
      clicked: 0,
      key: dayKey(d),
      label: dayLabelFmt.format(d),
      opened: 0,
      replied: 0,
      seen: emptySeenSets(),
      sent: 0,
      totalSignals: 0,
      unsubscribed: 0,
    };
    activityInternal.push(point);
    activityIndex.set(point.key, point);
  }

  const links = new Map<
    string,
    { clicks: number; uniqueRecipients: Set<string>; url: string }
  >();

  const recentSignals: EmailPerformanceRecentSignal[] = [];
  const sortedEvents = [...events].sort(
    (a, b) => b.occurredAt.getTime() - a.occurredAt.getTime(),
  );

  for (const event of sortedEvents) {
    if (event.occurredAt < start || event.occurredAt > now) continue;

    const metric = emailMetricForEvent(event.type);
    const key = emailSignalKey(event);
    const channel = emailEventChannel(event);
    const channelEntry = channelMap.get(channel);

    if (metric) {
      incrementUnique(totals, totalSeen, metric, key);
      if (channelEntry) {
        incrementUnique(channelEntry.counts, channelEntry.seen, metric, key);
      }

      const day = activityIndex.get(dayKey(event.occurredAt));
      if (day) {
        incrementActivityDay(day, metric, key);
      }
    }

    if (event.type === "click" && event.url) {
      const current = links.get(event.url) ?? {
        clicks: 0,
        uniqueRecipients: new Set<string>(),
        url: event.url,
      };
      current.clicks += 1;
      current.uniqueRecipients.add(key);
      links.set(event.url, current);
    }

    if (
      recentSignals.length < EMAIL_RECENT_SIGNAL_LIMIT &&
      EMAIL_RECENT_SIGNAL_TYPES.has(event.type)
    ) {
      recentSignals.push({
        channel,
        channelLabel: EMAIL_CHANNEL_LABELS[channel],
        id: event.id,
        occurredAt: event.occurredAt.toISOString(),
        recipientEmail: event.recipientEmail,
        type: event.type,
        url: event.url,
      });
    }
  }

  const activityByDay = activityInternal.map((entry) => {
    const totalSignals =
      entry.opened +
      entry.clicked +
      entry.replied +
      entry.unsubscribed +
      entry.bounced;
    return {
      bounced: entry.bounced,
      clicked: entry.clicked,
      key: entry.key,
      label: entry.label,
      opened: entry.opened,
      replied: entry.replied,
      sent: entry.sent,
      totalSignals,
      unsubscribed: entry.unsubscribed,
    };
  });

  const channels = channelEntries
    .map(({ counts, key }) => ({
      counts,
      key,
      label: EMAIL_CHANNEL_LABELS[key],
      rates: emailRates(counts),
    }))
    .filter((channel) =>
      EMAIL_COUNT_KEYS.some((key) => channel.counts[key] > 0),
    );

  const topLinks = Array.from(links.values())
    .map((link) => ({
      clicks: link.clicks,
      uniqueRecipients: link.uniqueRecipients.size,
      url: link.url,
    }))
    .sort(
      (a, b) =>
        b.clicks - a.clicks ||
        b.uniqueRecipients - a.uniqueRecipients ||
        a.url.localeCompare(b.url),
    )
    .slice(0, EMAIL_TOP_LINK_LIMIT);

  return {
    activityByDay,
    channels,
    period: {
      days: EMAIL_PERFORMANCE_DAYS,
      end: now.toISOString(),
      start: start.toISOString(),
    },
    rates: emailRates(totals),
    recentSignals,
    topLinks,
    totals,
  };
}

/** Carga los datos del panel de analítica para un dueño concreto (testeable). */
export async function getAnalyticsOverviewForOwner(
  ownerId: string,
  now: Date = new Date(),
): Promise<AnalyticsOverview> {
  const closedWindowStart = new Date(
    now.getFullYear(),
    now.getMonth() - (WON_MONTHS - 1),
    1,
  );
  const activityStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - (ACTIVITY_DAYS - 1),
  );

  const [openDeals, closedDeals, activityRows] = await Promise.all([
    db
      .select({
        value: deals.value,
        probability: stages.probability,
        expectedCloseDate: deals.expectedCloseDate,
      })
      .from(deals)
      .innerJoin(stages, eq(deals.stageId, stages.id))
      .where(
        and(
          eq(deals.ownerId, ownerId),
          eq(deals.status, "open"),
          isNull(deals.deletedAt),
        ),
      ),
    db
      .select({
        status: deals.status,
        value: deals.value,
        wonAt: deals.wonAt,
        lostAt: deals.lostAt,
      })
      .from(deals)
      .where(
        and(
          eq(deals.ownerId, ownerId),
          isNull(deals.deletedAt),
          inArray(deals.status, ["won", "lost"]),
          or(
            gte(deals.wonAt, closedWindowStart),
            gte(deals.lostAt, closedWindowStart),
          ),
        ),
      ),
    db
      .select({ createdAt: activities.createdAt, doneAt: activities.doneAt })
      .from(activities)
      .where(
        and(
          eq(activities.ownerId, ownerId),
          or(
            gte(activities.createdAt, activityStart),
            gte(activities.doneAt, activityStart),
          ),
        ),
      ),
  ]);

  return computeAnalyticsOverview(
    { openDeals, closedDeals, activities: activityRows },
    now,
  );
}

/** Panel de analítica del usuario en sesión (Fase 9.1). */
export async function getAnalyticsOverview(): Promise<AnalyticsOverview> {
  const user = await requireUser();
  return getAnalyticsOverviewForOwner(user.id);
}

/** Carga el rendimiento transversal de email para un dueño concreto (testeable). */
export async function getEmailPerformanceForOwner(
  ownerId: string,
  now: Date = new Date(),
): Promise<EmailPerformance> {
  const start = periodStart(now, EMAIL_PERFORMANCE_DAYS);
  const rows = await db
    .select({
      id: emailEvents.id,
      messageId: emailEvents.messageId,
      meta: emailEvents.meta,
      occurredAt: emailEvents.occurredAt,
      provider: emailEvents.provider,
      providerEventId: emailEvents.providerEventId,
      recipientEmail: emailEvents.recipientEmail,
      trackingId: emailEvents.trackingId,
      type: emailEvents.type,
      url: emailEvents.url,
    })
    .from(emailEvents)
    .where(
      and(
        eq(emailEvents.ownerId, ownerId),
        gte(emailEvents.occurredAt, start),
        inArray(emailEvents.type, EMAIL_PERFORMANCE_EVENT_TYPES),
      ),
    )
    .orderBy(desc(emailEvents.occurredAt));

  return computeEmailPerformance(rows, now);
}

/** Rendimiento transversal de email del usuario en sesión (Fase 9.3). */
export async function getEmailPerformance(): Promise<EmailPerformance> {
  const user = await requireUser();
  return getEmailPerformanceForOwner(user.id);
}
