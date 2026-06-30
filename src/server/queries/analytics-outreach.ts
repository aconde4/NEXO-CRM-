import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import { requireUser } from "@/lib/session";
import { db } from "@/server/db";
import {
  campaignRecipients,
  campaigns,
  emailEvents,
  enrollments,
  segments,
  sequenceSteps,
  sequences,
  type CampaignStatus,
  type SequenceChannel,
  type SequenceStatus,
  type SequenceStepVariant,
} from "@/server/db/schema";

export type OutreachRates = {
  bounceRate: number | null;
  clickRate: number | null;
  openRate: number | null;
  replyRate?: number | null;
  unsubscribeRate: number | null;
};

export type OutreachCampaignRates = OutreachRates & {
  deliveryRate: number | null;
};

export type OutreachSequenceRow = {
  activeEnrollments: number;
  bounced: number;
  channel: SequenceChannel;
  clicked: number;
  completedEnrollments: number;
  enrolled: number;
  failedEnrollments: number;
  id: string;
  name: string;
  opened: number;
  rates: OutreachRates;
  replied: number;
  sent: number;
  status: SequenceStatus;
  stepCount: number;
  unsubscribed: number;
  updatedAt: string;
};

export type OutreachCampaignRow = {
  audience: number;
  bounced: number;
  clicked: number;
  complained: number;
  delivered: number;
  failed: number;
  id: string;
  name: string;
  opened: number;
  rates: OutreachCampaignRates;
  scheduledAt: string | null;
  segmentName: string | null;
  sent: number;
  sentAt: string | null;
  status: CampaignStatus;
  subject: string;
  suppressed: number;
  unsubscribed: number;
  updatedAt: string;
};

export type OutreachVariantInsight = {
  clicked: number;
  clickRate: number | null;
  opened: number;
  openRate: number | null;
  sent: number;
  sequenceId: string;
  sequenceName: string;
  stepName: string;
  variantId: string;
  variantName: string;
};

export type OutreachMetrics = {
  campaigns: {
    rows: OutreachCampaignRow[];
    totals: {
      audience: number;
      bounced: number;
      clicked: number;
      complained: number;
      delivered: number;
      failed: number;
      opened: number;
      rates: OutreachCampaignRates;
      sent: number;
      statuses: Record<CampaignStatus, number>;
      suppressed: number;
      total: number;
      unsubscribed: number;
    };
  };
  sequences: {
    rows: OutreachSequenceRow[];
    totals: {
      activeEnrollments: number;
      bounced: number;
      clicked: number;
      completedEnrollments: number;
      enrolled: number;
      failedEnrollments: number;
      opened: number;
      rates: OutreachRates;
      replied: number;
      sent: number;
      statuses: Record<SequenceStatus, number>;
      total: number;
      unsubscribed: number;
    };
    variants: OutreachVariantInsight[];
  };
};

type SequenceBaseRow = {
  activeEnrollments: number;
  bouncedEnrollments: number;
  channel: SequenceChannel;
  completedEnrollments: number;
  enrolled: number;
  failedEnrollments: number;
  id: string;
  name: string;
  status: SequenceStatus;
  stepCount: number;
  unsubscribedEnrollments: number;
  updatedAt: Date;
};

type SequenceEventRow = {
  bounced: string | number;
  clicked: string | number;
  opened: string | number;
  replied: string | number;
  sent: string | number;
  sequenceId: string | null;
  unsubscribed: string | number;
};

type SequenceStepRow = {
  id: string;
  name: string | null;
  position: number;
  sequenceId: string;
  subject: string | null;
  variants: SequenceStepVariant[];
};

type CampaignBaseRow = {
  audience: number;
  bounced: number;
  clicked: number;
  complained: number;
  delivered: number;
  failed: number;
  id: string;
  name: string;
  opened: number;
  scheduledAt: Date | null;
  segmentName: string | null;
  sent: number;
  sentAt: Date | null;
  status: CampaignStatus;
  subject: string;
  suppressed: number;
  unsubscribed: number;
  updatedAt: Date;
};

type VariantEventRow = {
  clicked: string | number;
  opened: string | number;
  sent: string | number;
  sequenceId: string | null;
  stepId: string | null;
  variantId: string | null;
};

const CAMPAIGN_STATUSES: CampaignStatus[] = [
  "draft",
  "scheduled",
  "sending",
  "sent",
  "paused",
  "failed",
];
const SEQUENCE_STATUSES: SequenceStatus[] = [
  "draft",
  "active",
  "paused",
  "archived",
];
const TOP_ROW_LIMIT = 8;
const VARIANT_LIMIT = 8;

function toNumber(value: number | string | null | undefined): number {
  return Number(value ?? 0);
}

function pct(numerator: number, denominator: number): number | null {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : null;
}

function zeroStatusCounts<T extends string>(statuses: T[]): Record<T, number> {
  return Object.fromEntries(statuses.map((status) => [status, 0])) as Record<
    T,
    number
  >;
}

function sequenceRates(input: {
  bounced: number;
  clicked: number;
  opened: number;
  replied: number;
  sent: number;
  unsubscribed: number;
}): OutreachRates {
  return {
    bounceRate: pct(input.bounced, input.sent),
    clickRate: pct(input.clicked, input.sent),
    openRate: pct(input.opened, input.sent),
    replyRate: pct(input.replied, input.sent),
    unsubscribeRate: pct(input.unsubscribed, input.sent),
  };
}

function campaignRates(input: {
  bounced: number;
  clicked: number;
  delivered: number;
  opened: number;
  sent: number;
  unsubscribed: number;
}): OutreachRates & { deliveryRate: number | null } {
  return {
    bounceRate: pct(input.bounced, input.sent),
    clickRate: pct(
      input.clicked,
      input.opened || input.delivered || input.sent,
    ),
    deliveryRate: pct(input.delivered, input.sent),
    openRate: pct(input.opened, input.delivered || input.sent),
    unsubscribeRate: pct(input.unsubscribed, input.sent),
  };
}

function variantLetter(alternativeIndex: number): string {
  return String.fromCharCode("B".charCodeAt(0) + alternativeIndex);
}

function stepDisplayName(step: SequenceStepRow | undefined): string {
  if (!step) return "Paso desconocido";
  const label = step.name?.trim() || step.subject?.trim() || "Email";
  return `Paso ${step.position + 1} · ${label}`;
}

function variantDisplayName(
  step: SequenceStepRow | undefined,
  variantId: string,
): string {
  if (!step || variantId === step.id) return "Variante A";
  const index = step.variants.findIndex((variant) => variant.id === variantId);
  const variant = index >= 0 ? step.variants[index] : null;
  return (
    variant?.name?.trim() || `Variante ${variantLetter(Math.max(index, 0))}`
  );
}

export async function getOutreachMetricsForOwner(
  ownerId: string,
): Promise<OutreachMetrics> {
  const eSequence = sql<string>`${emailEvents.meta}->'sequence'->>'sequenceId'`;
  const eEnrollment = sql<string>`${emailEvents.meta}->'sequence'->>'enrollmentId'`;
  const eStep = sql<string>`${emailEvents.meta}->'sequence'->>'stepId'`;
  const eVariant = sql<string>`${emailEvents.meta}->'sequence'->>'variantId'`;

  const [
    sequenceBaseRows,
    sequenceEventRows,
    sequenceStepRows,
    variantEventRows,
    campaignRows,
  ] = await Promise.all([
    db
      .select({
        activeEnrollments: sql<number>`count(distinct ${enrollments.id}) filter (where ${enrollments.status} = 'active')::int`,
        bouncedEnrollments: sql<number>`count(distinct ${enrollments.id}) filter (where ${enrollments.status} = 'bounced')::int`,
        channel: sequences.channel,
        completedEnrollments: sql<number>`count(distinct ${enrollments.id}) filter (where ${enrollments.status} = 'completed')::int`,
        enrolled: sql<number>`count(distinct ${enrollments.id})::int`,
        failedEnrollments: sql<number>`count(distinct ${enrollments.id}) filter (where ${enrollments.status} = 'failed')::int`,
        id: sequences.id,
        name: sequences.name,
        status: sequences.status,
        stepCount: sql<number>`count(distinct ${sequenceSteps.id})::int`,
        unsubscribedEnrollments: sql<number>`count(distinct ${enrollments.id}) filter (where ${enrollments.status} = 'unsubscribed')::int`,
        updatedAt: sequences.updatedAt,
      })
      .from(sequences)
      .leftJoin(
        sequenceSteps,
        and(
          eq(sequenceSteps.sequenceId, sequences.id),
          eq(sequenceSteps.ownerId, ownerId),
        ),
      )
      .leftJoin(
        enrollments,
        and(
          eq(enrollments.sequenceId, sequences.id),
          eq(enrollments.ownerId, ownerId),
        ),
      )
      .where(eq(sequences.ownerId, ownerId))
      .groupBy(sequences.id)
      .orderBy(desc(sequences.updatedAt)),
    db
      .select({
        bounced: sql<string>`count(*) filter (where ${emailEvents.type} = 'bounce')`,
        clicked: sql<string>`count(distinct (${eEnrollment}, ${eStep})) filter (where ${emailEvents.type} = 'click')`,
        opened: sql<string>`count(distinct (${eEnrollment}, ${eStep})) filter (where ${emailEvents.type} = 'open')`,
        replied: sql<string>`count(distinct ${eEnrollment}) filter (where ${emailEvents.type} = 'reply')`,
        sent: sql<string>`count(*) filter (where ${emailEvents.type} = 'sent')`,
        sequenceId: sql<string | null>`${eSequence}`,
        unsubscribed: sql<string>`count(*) filter (where ${emailEvents.type} = 'unsubscribe')`,
      })
      .from(emailEvents)
      .where(
        and(eq(emailEvents.ownerId, ownerId), sql`${eSequence} is not null`),
      )
      .groupBy(eSequence),
    db
      .select({
        id: sequenceSteps.id,
        name: sequenceSteps.name,
        position: sequenceSteps.position,
        sequenceId: sequenceSteps.sequenceId,
        subject: sequenceSteps.subject,
        variants: sequenceSteps.variants,
      })
      .from(sequenceSteps)
      .where(
        and(
          eq(sequenceSteps.ownerId, ownerId),
          eq(sequenceSteps.type, "email"),
        ),
      ),
    db
      .select({
        clicked: sql<string>`count(distinct ${eEnrollment}) filter (where ${emailEvents.type} = 'click')`,
        opened: sql<string>`count(distinct ${eEnrollment}) filter (where ${emailEvents.type} = 'open')`,
        sent: sql<string>`count(*) filter (where ${emailEvents.type} = 'sent')`,
        sequenceId: sql<string | null>`${eSequence}`,
        stepId: sql<string | null>`${eStep}`,
        variantId: sql<string | null>`${eVariant}`,
      })
      .from(emailEvents)
      .where(
        and(
          eq(emailEvents.ownerId, ownerId),
          sql`${eSequence} is not null`,
          sql`${eStep} is not null`,
          sql`${eVariant} is not null`,
        ),
      )
      .groupBy(eSequence, eStep, eVariant),
    db
      .select({
        audience: sql<number>`count(${campaignRecipients.id})::int`,
        bounced: sql<number>`count(${campaignRecipients.id}) filter (where ${campaignRecipients.bouncedAt} is not null or ${campaignRecipients.status} = 'bounced')::int`,
        clicked: sql<number>`count(${campaignRecipients.id}) filter (where ${campaignRecipients.clickedAt} is not null or ${campaignRecipients.status} = 'clicked')::int`,
        complained: sql<number>`count(${campaignRecipients.id}) filter (where ${campaignRecipients.status} = 'complained')::int`,
        delivered: sql<number>`count(${campaignRecipients.id}) filter (where ${campaignRecipients.deliveredAt} is not null or ${campaignRecipients.status} in ('delivered', 'opened', 'clicked', 'complained', 'unsubscribed'))::int`,
        failed: sql<number>`count(${campaignRecipients.id}) filter (where ${campaignRecipients.status} = 'failed')::int`,
        id: campaigns.id,
        name: campaigns.name,
        opened: sql<number>`count(${campaignRecipients.id}) filter (where ${campaignRecipients.openedAt} is not null or ${campaignRecipients.status} in ('opened', 'clicked'))::int`,
        scheduledAt: campaigns.scheduledAt,
        segmentName: segments.name,
        sent: sql<number>`count(${campaignRecipients.id}) filter (where ${campaignRecipients.status} not in ('pending', 'suppressed', 'failed'))::int`,
        sentAt: campaigns.sentAt,
        status: campaigns.status,
        subject: campaigns.subject,
        suppressed: sql<number>`count(${campaignRecipients.id}) filter (where ${campaignRecipients.status} = 'suppressed')::int`,
        unsubscribed: sql<number>`count(${campaignRecipients.id}) filter (where ${campaignRecipients.unsubscribedAt} is not null or ${campaignRecipients.status} = 'unsubscribed')::int`,
        updatedAt: campaigns.updatedAt,
      })
      .from(campaigns)
      .leftJoin(
        segments,
        and(
          eq(campaigns.segmentId, segments.id),
          eq(segments.ownerId, ownerId),
        ),
      )
      .leftJoin(
        campaignRecipients,
        and(
          eq(campaignRecipients.campaignId, campaigns.id),
          eq(campaignRecipients.ownerId, ownerId),
        ),
      )
      .where(eq(campaigns.ownerId, ownerId))
      .groupBy(campaigns.id, segments.name)
      .orderBy(desc(campaigns.updatedAt)),
  ]);

  return buildOutreachMetrics({
    campaignRows,
    sequenceBaseRows,
    sequenceEventRows,
    sequenceStepRows,
    variantEventRows,
  });
}

function buildOutreachMetrics({
  campaignRows,
  sequenceBaseRows,
  sequenceEventRows,
  sequenceStepRows,
  variantEventRows,
}: {
  campaignRows: CampaignBaseRow[];
  sequenceBaseRows: SequenceBaseRow[];
  sequenceEventRows: SequenceEventRow[];
  sequenceStepRows: SequenceStepRow[];
  variantEventRows: VariantEventRow[];
}): OutreachMetrics {
  const sequenceEventsById = new Map(
    sequenceEventRows
      .filter((row) => row.sequenceId)
      .map((row) => [row.sequenceId as string, row]),
  );
  const sequencesById = new Map(sequenceBaseRows.map((row) => [row.id, row]));
  const stepsById = new Map(sequenceStepRows.map((row) => [row.id, row]));

  const sequenceStatuses = zeroStatusCounts(SEQUENCE_STATUSES);
  const sequenceTotals = {
    activeEnrollments: 0,
    bounced: 0,
    clicked: 0,
    completedEnrollments: 0,
    enrolled: 0,
    failedEnrollments: 0,
    opened: 0,
    replied: 0,
    sent: 0,
    statuses: sequenceStatuses,
    total: sequenceBaseRows.length,
    unsubscribed: 0,
  };

  const sequenceRows = sequenceBaseRows.map((row) => {
    const eventRow = sequenceEventsById.get(row.id);
    const sent = toNumber(eventRow?.sent);
    const opened = toNumber(eventRow?.opened);
    const clicked = toNumber(eventRow?.clicked);
    const replied = toNumber(eventRow?.replied);
    const bounced = toNumber(eventRow?.bounced);
    const unsubscribed = toNumber(eventRow?.unsubscribed);

    sequenceStatuses[row.status] += 1;
    sequenceTotals.activeEnrollments += row.activeEnrollments;
    sequenceTotals.completedEnrollments += row.completedEnrollments;
    sequenceTotals.enrolled += row.enrolled;
    sequenceTotals.failedEnrollments += row.failedEnrollments;
    sequenceTotals.sent += sent;
    sequenceTotals.opened += opened;
    sequenceTotals.clicked += clicked;
    sequenceTotals.replied += replied;
    sequenceTotals.bounced += bounced;
    sequenceTotals.unsubscribed += unsubscribed;

    return {
      activeEnrollments: row.activeEnrollments,
      bounced,
      channel: row.channel,
      clicked,
      completedEnrollments: row.completedEnrollments,
      enrolled: row.enrolled,
      failedEnrollments: row.failedEnrollments,
      id: row.id,
      name: row.name,
      opened,
      rates: sequenceRates({
        bounced,
        clicked,
        opened,
        replied,
        sent,
        unsubscribed,
      }),
      replied,
      sent,
      status: row.status,
      stepCount: row.stepCount,
      unsubscribed,
      updatedAt: row.updatedAt.toISOString(),
    };
  });

  const campaignStatuses = zeroStatusCounts(CAMPAIGN_STATUSES);
  const campaignTotals = {
    audience: 0,
    bounced: 0,
    clicked: 0,
    complained: 0,
    delivered: 0,
    failed: 0,
    opened: 0,
    sent: 0,
    statuses: campaignStatuses,
    suppressed: 0,
    total: campaignRows.length,
    unsubscribed: 0,
  };

  const mappedCampaignRows = campaignRows.map((row) => {
    campaignStatuses[row.status] += 1;
    campaignTotals.audience += row.audience;
    campaignTotals.sent += row.sent;
    campaignTotals.delivered += row.delivered;
    campaignTotals.opened += row.opened;
    campaignTotals.clicked += row.clicked;
    campaignTotals.bounced += row.bounced;
    campaignTotals.complained += row.complained;
    campaignTotals.unsubscribed += row.unsubscribed;
    campaignTotals.suppressed += row.suppressed;
    campaignTotals.failed += row.failed;

    return {
      ...row,
      rates: campaignRates(row),
      scheduledAt: row.scheduledAt?.toISOString() ?? null,
      sentAt: row.sentAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
    };
  });

  const variants = variantEventRows
    .filter((row) => row.sequenceId && row.stepId && row.variantId)
    .map((row) => {
      const sequence = sequencesById.get(row.sequenceId as string);
      const step = stepsById.get(row.stepId as string);
      const sent = toNumber(row.sent);
      const opened = toNumber(row.opened);
      const clicked = toNumber(row.clicked);
      return {
        clicked,
        clickRate: pct(clicked, sent),
        opened,
        openRate: pct(opened, sent),
        sent,
        sequenceId: row.sequenceId as string,
        sequenceName: sequence?.name ?? "Secuencia desconocida",
        stepName: stepDisplayName(step),
        variantId: row.variantId as string,
        variantName: variantDisplayName(step, row.variantId as string),
      };
    })
    .sort(
      (a, b) =>
        b.sent - a.sent ||
        (b.openRate ?? -1) - (a.openRate ?? -1) ||
        a.sequenceName.localeCompare(b.sequenceName),
    )
    .slice(0, VARIANT_LIMIT);

  return {
    campaigns: {
      rows: mappedCampaignRows
        .sort((a, b) => b.sent - a.sent || b.audience - a.audience)
        .slice(0, TOP_ROW_LIMIT),
      totals: {
        ...campaignTotals,
        rates: campaignRates(campaignTotals),
      },
    },
    sequences: {
      rows: sequenceRows
        .sort((a, b) => b.sent - a.sent || b.enrolled - a.enrolled)
        .slice(0, TOP_ROW_LIMIT),
      totals: {
        ...sequenceTotals,
        rates: sequenceRates(sequenceTotals),
      },
      variants,
    },
  };
}

export async function getOutreachMetrics(): Promise<OutreachMetrics> {
  const user = await requireUser();
  return getOutreachMetricsForOwner(user.id);
}
