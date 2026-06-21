import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import type { CampaignEmailBlock } from "@/lib/campaign-blocks";
import { campaignEmailBlocksSchema } from "@/lib/validations/campaign";
import { requireUser } from "@/lib/session";
import { db } from "@/server/db";
import {
  type CampaignRecipientStatus,
  type CampaignStats,
  type CampaignStatus,
  type EmailEventType,
  campaignRecipients,
  campaigns,
  emailEvents,
  segments,
} from "@/server/db/schema";
import { isResendConfigured } from "@/server/services/resend";

const CAMPAIGN_RESULTS_RECIPIENT_LIMIT = 250;
const CAMPAIGN_RESULTS_EVENT_LIMIT = 100;

function cleanEnv(value: string | undefined): string {
  return value?.trim() ?? "";
}

function blocksFromSettings(
  settings: Record<string, unknown>,
): CampaignEmailBlock[] {
  const parsed = campaignEmailBlocksSchema.safeParse(settings.blocks);
  return parsed.success ? parsed.data : [];
}

export type CampaignListItem = {
  id: string;
  name: string;
  subject: string;
  preheader: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  status: "draft" | "scheduled" | "sending" | "sent" | "paused" | "failed";
  segmentId: string | null;
  segmentName: string | null;
  bodyHtml: string;
  bodyText: string;
  blocks: CampaignEmailBlock[];
  scheduledAt: string | null;
  sentAt: string | null;
  stats: CampaignStats;
  updatedAt: string;
  createdAt: string;
};

export type CampaignComposerDefaults = {
  fromName: string;
  fromEmail: string;
  resendConfigured: boolean;
};

export type CampaignResultsRecipient = {
  id: string;
  email: string;
  name: string | null;
  status: CampaignRecipientStatus;
  providerMessageId: string | null;
  error: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  bouncedAt: string | null;
  unsubscribedAt: string | null;
  updatedAt: string;
};

export type CampaignResultsEvent = {
  id: string;
  type: EmailEventType;
  recipientEmail: string | null;
  url: string | null;
  providerEventId: string | null;
  meta: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
};

export type CampaignResults = {
  campaign: {
    id: string;
    name: string;
    subject: string;
    preheader: string;
    fromName: string;
    fromEmail: string;
    replyTo: string;
    provider: "resend";
    status: CampaignStatus;
    segmentName: string | null;
    scheduledAt: string | null;
    sentAt: string | null;
    stats: CampaignStats;
    updatedAt: string;
    createdAt: string;
  };
  recipients: CampaignResultsRecipient[];
  recipientCount: number;
  recipientLimit: number;
  events: CampaignResultsEvent[];
  eventCount: number;
  eventLimit: number;
};

type CampaignResultsStats = Required<CampaignStats>;

export async function listCampaigns(): Promise<CampaignListItem[]> {
  const user = await requireUser();
  const rows = await db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      subject: campaigns.subject,
      preheader: campaigns.preheader,
      fromName: campaigns.fromName,
      fromEmail: campaigns.fromEmail,
      replyTo: campaigns.replyTo,
      status: campaigns.status,
      segmentId: campaigns.segmentId,
      segmentName: segments.name,
      bodyHtml: campaigns.bodyHtml,
      bodyText: campaigns.bodyText,
      scheduledAt: campaigns.scheduledAt,
      settings: campaigns.settings,
      sentAt: campaigns.sentAt,
      stats: campaigns.stats,
      updatedAt: campaigns.updatedAt,
      createdAt: campaigns.createdAt,
    })
    .from(campaigns)
    .leftJoin(
      segments,
      and(eq(campaigns.segmentId, segments.id), eq(segments.ownerId, user.id)),
    )
    .where(eq(campaigns.ownerId, user.id))
    .orderBy(desc(campaigns.updatedAt));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    subject: row.subject,
    preheader: row.preheader ?? "",
    fromName: row.fromName ?? "",
    fromEmail: row.fromEmail ?? "",
    replyTo: row.replyTo ?? "",
    status: row.status,
    segmentId: row.segmentId,
    segmentName: row.segmentName,
    bodyHtml: row.bodyHtml ?? "",
    bodyText: row.bodyText ?? "",
    blocks: blocksFromSettings(row.settings),
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    sentAt: row.sentAt?.toISOString() ?? null,
    stats: row.stats,
    updatedAt: row.updatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function getCampaignResults(
  campaignId: string,
): Promise<CampaignResults | null> {
  const user = await requireUser();
  const [row] = await db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      subject: campaigns.subject,
      preheader: campaigns.preheader,
      fromName: campaigns.fromName,
      fromEmail: campaigns.fromEmail,
      replyTo: campaigns.replyTo,
      provider: campaigns.provider,
      status: campaigns.status,
      segmentName: segments.name,
      scheduledAt: campaigns.scheduledAt,
      sentAt: campaigns.sentAt,
      stats: campaigns.stats,
      updatedAt: campaigns.updatedAt,
      createdAt: campaigns.createdAt,
    })
    .from(campaigns)
    .leftJoin(
      segments,
      and(eq(campaigns.segmentId, segments.id), eq(segments.ownerId, user.id)),
    )
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.ownerId, user.id)))
    .limit(1);

  if (!row) return null;

  const campaignEventsFilter = and(
    eq(emailEvents.ownerId, user.id),
    eq(emailEvents.provider, "resend"),
    sql`${emailEvents.meta}->>'campaignId' = ${campaignId}`,
  );

  const [summary, recipients, events, recipientCount, eventCount] =
    await Promise.all([
      db
        .select({
          audience: sql<number>`count(*)::int`,
          sent: sql<number>`count(*) filter (where ${campaignRecipients.status} not in ('pending', 'suppressed', 'failed'))::int`,
          delivered: sql<number>`count(*) filter (where ${campaignRecipients.deliveredAt} is not null or ${campaignRecipients.status} in ('delivered', 'opened', 'clicked', 'complained', 'unsubscribed'))::int`,
          opened: sql<number>`count(*) filter (where ${campaignRecipients.openedAt} is not null or ${campaignRecipients.status} in ('opened', 'clicked'))::int`,
          clicked: sql<number>`count(*) filter (where ${campaignRecipients.clickedAt} is not null or ${campaignRecipients.status} = 'clicked')::int`,
          bounced: sql<number>`count(*) filter (where ${campaignRecipients.bouncedAt} is not null or ${campaignRecipients.status} = 'bounced')::int`,
          complained: sql<number>`count(*) filter (where ${campaignRecipients.status} = 'complained')::int`,
          unsubscribed: sql<number>`count(*) filter (where ${campaignRecipients.unsubscribedAt} is not null or ${campaignRecipients.status} = 'unsubscribed')::int`,
          suppressed: sql<number>`count(*) filter (where ${campaignRecipients.status} = 'suppressed')::int`,
          failed: sql<number>`count(*) filter (where ${campaignRecipients.status} = 'failed')::int`,
        })
        .from(campaignRecipients)
        .where(
          and(
            eq(campaignRecipients.campaignId, campaignId),
            eq(campaignRecipients.ownerId, user.id),
          ),
        ),
      db
        .select({
          id: campaignRecipients.id,
          email: campaignRecipients.email,
          name: campaignRecipients.name,
          status: campaignRecipients.status,
          providerMessageId: campaignRecipients.providerMessageId,
          error: campaignRecipients.error,
          sentAt: campaignRecipients.sentAt,
          deliveredAt: campaignRecipients.deliveredAt,
          openedAt: campaignRecipients.openedAt,
          clickedAt: campaignRecipients.clickedAt,
          bouncedAt: campaignRecipients.bouncedAt,
          unsubscribedAt: campaignRecipients.unsubscribedAt,
          updatedAt: campaignRecipients.updatedAt,
        })
        .from(campaignRecipients)
        .where(
          and(
            eq(campaignRecipients.campaignId, campaignId),
            eq(campaignRecipients.ownerId, user.id),
          ),
        )
        .orderBy(desc(campaignRecipients.updatedAt))
        .limit(CAMPAIGN_RESULTS_RECIPIENT_LIMIT),
      db
        .select({
          id: emailEvents.id,
          type: emailEvents.type,
          recipientEmail: emailEvents.recipientEmail,
          url: emailEvents.url,
          providerEventId: emailEvents.providerEventId,
          meta: emailEvents.meta,
          occurredAt: emailEvents.occurredAt,
          createdAt: emailEvents.createdAt,
        })
        .from(emailEvents)
        .where(campaignEventsFilter)
        .orderBy(desc(emailEvents.occurredAt))
        .limit(CAMPAIGN_RESULTS_EVENT_LIMIT),
      db.$count(
        campaignRecipients,
        and(
          eq(campaignRecipients.campaignId, campaignId),
          eq(campaignRecipients.ownerId, user.id),
        ),
      ),
      db.$count(emailEvents, campaignEventsFilter),
    ]);

  const computedStats: CampaignResultsStats = summary[0] ?? {
    audience: 0,
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    complained: 0,
    unsubscribed: 0,
    suppressed: 0,
    failed: 0,
  };

  return {
    campaign: {
      id: row.id,
      name: row.name,
      subject: row.subject,
      preheader: row.preheader ?? "",
      fromName: row.fromName ?? "",
      fromEmail: row.fromEmail ?? "",
      replyTo: row.replyTo ?? "",
      provider: row.provider,
      status: row.status,
      segmentName: row.segmentName,
      scheduledAt: row.scheduledAt?.toISOString() ?? null,
      sentAt: row.sentAt?.toISOString() ?? null,
      stats: { ...row.stats, ...computedStats },
      updatedAt: row.updatedAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    },
    recipients: recipients.map((recipient) => ({
      id: recipient.id,
      email: recipient.email,
      name: recipient.name,
      status: recipient.status,
      providerMessageId: recipient.providerMessageId,
      error: recipient.error,
      sentAt: recipient.sentAt?.toISOString() ?? null,
      deliveredAt: recipient.deliveredAt?.toISOString() ?? null,
      openedAt: recipient.openedAt?.toISOString() ?? null,
      clickedAt: recipient.clickedAt?.toISOString() ?? null,
      bouncedAt: recipient.bouncedAt?.toISOString() ?? null,
      unsubscribedAt: recipient.unsubscribedAt?.toISOString() ?? null,
      updatedAt: recipient.updatedAt.toISOString(),
    })),
    recipientCount,
    recipientLimit: CAMPAIGN_RESULTS_RECIPIENT_LIMIT,
    events: events.map((event) => ({
      id: event.id,
      type: event.type,
      recipientEmail: event.recipientEmail,
      url: event.url,
      providerEventId: event.providerEventId,
      meta: event.meta,
      occurredAt: event.occurredAt.toISOString(),
      createdAt: event.createdAt.toISOString(),
    })),
    eventCount,
    eventLimit: CAMPAIGN_RESULTS_EVENT_LIMIT,
  };
}

export async function getCampaignComposerDefaults(): Promise<CampaignComposerDefaults> {
  await requireUser();
  return {
    fromName: cleanEnv(process.env.CAMPAIGN_FROM_NAME),
    fromEmail: cleanEnv(process.env.CAMPAIGN_FROM_EMAIL),
    resendConfigured: isResendConfigured(),
  };
}
