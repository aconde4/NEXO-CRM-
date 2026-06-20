import "server-only";

import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import type { CampaignEmailBlock } from "@/lib/campaign-blocks";
import { buildMergeContext } from "@/lib/email/merge-tags";
import { campaignEmailBlocksSchema } from "@/lib/validations/campaign";
import { db } from "@/server/db";
import {
  type CampaignRecipientStatus,
  type CampaignStats,
  type CampaignStatus,
  type SegmentDefinition,
  campaignRecipients,
  campaigns,
  organizations,
  persons,
  segments,
  suppressions,
} from "@/server/db/schema";
import { listAllCustomFieldDefsForOwner } from "@/server/queries/custom-fields";
import {
  type SegmentRecipient,
  resolveSegmentRecipientsForOwner,
} from "@/server/queries/segments";
import { renderCampaignEmail } from "@/server/services/campaign-email";
import {
  RESEND_BATCH_MAX,
  ResendServiceError,
  formatFrom,
  isResendConfigured,
  sendResendBatch,
} from "@/server/services/resend";

export const CAMPAIGN_SEND_EVENT = "campaign/send.requested";

export type CampaignDispatchErrorCode =
  | "cancelled"
  | "invalid_campaign"
  | "not_configured"
  | "not_found"
  | "transport_error";

export class CampaignDispatchError extends Error {
  constructor(
    message: string,
    public readonly code: CampaignDispatchErrorCode,
  ) {
    super(message);
    this.name = "CampaignDispatchError";
  }
}

type CampaignWithSegment = {
  fromEmail: string | null;
  fromName: string | null;
  id: string;
  ownerId: string;
  preheader: string | null;
  replyTo: string | null;
  scheduledAt: Date | null;
  segmentDefinition: SegmentDefinition | null;
  segmentId: string | null;
  settings: Record<string, unknown>;
  status: CampaignStatus;
  subject: string;
};

type PendingRecipient = typeof campaignRecipients.$inferSelect;

type DeliveryConfig = {
  batchDelaySeconds: number;
  batchSize: number;
  maxBatchesPerRun: number;
  timeZone: string;
  windowEnd: string;
  windowStart: string;
};

type TimeParts = {
  day: number;
  hour: number;
  minute: number;
  month: number;
  second: number;
  year: number;
};

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
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

function parseTime(value: string | undefined, fallback: string): string {
  const candidate = value?.trim() || fallback;
  return /^\d{2}:\d{2}$/.test(candidate) ? candidate : fallback;
}

function validTimeZone(value: string | undefined): string {
  const timeZone = value?.trim() || "Europe/Madrid";
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return "Europe/Madrid";
  }
}

function timeToMinutes(value: string): number {
  const [hour = "0", minute = "0"] = value.split(":");
  return Number(hour) * 60 + Number(minute);
}

function getTimeParts(date: Date, timeZone: string): TimeParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    month: value("month"),
    second: value("second"),
    year: value("year"),
  };
}

function zonedTimeToUtc(
  parts: Omit<TimeParts, "second">,
  timeZone: string,
): Date {
  const guess = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
  );
  const rendered = getTimeParts(new Date(guess), timeZone);
  const renderedAsUtc = Date.UTC(
    rendered.year,
    rendered.month - 1,
    rendered.day,
    rendered.hour,
    rendered.minute,
    rendered.second,
  );
  return new Date(guess - (renderedAsUtc - guess));
}

function nextLocalDay(parts: TimeParts): Omit<TimeParts, "second"> {
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));
  return {
    day: next.getUTCDate(),
    hour: 0,
    minute: 0,
    month: next.getUTCMonth() + 1,
    year: next.getUTCFullYear(),
  };
}

function minuteIsInsideWindow(
  current: number,
  start: number,
  end: number,
): boolean {
  if (start === end) return true;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

export function getCampaignDeliveryConfig(): DeliveryConfig {
  return {
    batchDelaySeconds: clampInt(
      process.env.CAMPAIGN_SEND_BATCH_DELAY_SECONDS,
      60,
      0,
      3600,
    ),
    batchSize: clampInt(
      process.env.CAMPAIGN_SEND_BATCH_SIZE,
      Math.min(50, RESEND_BATCH_MAX),
      1,
      RESEND_BATCH_MAX,
    ),
    maxBatchesPerRun: clampInt(
      process.env.CAMPAIGN_SEND_MAX_BATCHES_PER_RUN,
      500,
      1,
      5000,
    ),
    timeZone: validTimeZone(process.env.CAMPAIGN_SEND_TIME_ZONE),
    windowEnd: parseTime(process.env.CAMPAIGN_SEND_WINDOW_END, "18:00"),
    windowStart: parseTime(process.env.CAMPAIGN_SEND_WINDOW_START, "09:00"),
  };
}

export function isWithinCampaignSendWindow(
  date = new Date(),
  config = getCampaignDeliveryConfig(),
): boolean {
  const parts = getTimeParts(date, config.timeZone);
  return minuteIsInsideWindow(
    parts.hour * 60 + parts.minute,
    timeToMinutes(config.windowStart),
    timeToMinutes(config.windowEnd),
  );
}

export function nextAllowedCampaignSendAt(
  date = new Date(),
  config = getCampaignDeliveryConfig(),
): Date {
  if (isWithinCampaignSendWindow(date, config)) return date;

  const parts = getTimeParts(date, config.timeZone);
  const current = parts.hour * 60 + parts.minute;
  const start = timeToMinutes(config.windowStart);
  const end = timeToMinutes(config.windowEnd);
  const [startHour = "0", startMinute = "0"] = config.windowStart.split(":");

  let target = {
    day: parts.day,
    hour: Number(startHour),
    minute: Number(startMinute),
    month: parts.month,
    year: parts.year,
  };

  if (start < end && current >= end) {
    target = {
      ...nextLocalDay(parts),
      hour: Number(startHour),
      minute: Number(startMinute),
    };
  }

  if (start > end && current < start && current >= end) {
    target = {
      day: parts.day,
      hour: Number(startHour),
      minute: Number(startMinute),
      month: parts.month,
      year: parts.year,
    };
  }

  return zonedTimeToUtc(target, config.timeZone);
}

function normalizeEmail(value: string | null | undefined): string | null {
  const email = value?.trim().toLowerCase();
  return email ? email : null;
}

function fullName(
  person: Pick<SegmentRecipient, "firstName" | "lastName">,
): string {
  return [person.firstName, person.lastName].filter(Boolean).join(" ").trim();
}

function blocksFromSettings(
  settings: Record<string, unknown>,
): CampaignEmailBlock[] {
  const parsed = campaignEmailBlocksSchema.safeParse(settings.blocks);
  return parsed.success ? parsed.data : [];
}

function mergeSettings(
  settings: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return { ...settings, ...patch };
}

function deliveryPatch(
  settings: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const current =
    settings.delivery &&
    typeof settings.delivery === "object" &&
    !Array.isArray(settings.delivery)
      ? (settings.delivery as Record<string, unknown>)
      : {};
  return {
    delivery: {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    },
  };
}

function resolveCampaignFrom(
  campaign: Pick<CampaignWithSegment, "fromEmail" | "fromName">,
) {
  const email =
    clean(campaign.fromEmail) ?? clean(process.env.CAMPAIGN_FROM_EMAIL);
  if (!email) {
    throw new CampaignDispatchError(
      "Configura CAMPAIGN_FROM_EMAIL o indica un email remitente antes de enviar.",
      "invalid_campaign",
    );
  }
  const name =
    clean(campaign.fromName) ?? clean(process.env.CAMPAIGN_FROM_NAME);
  return formatFrom(name, email);
}

async function loadCampaign(
  campaignId: string,
): Promise<CampaignWithSegment | null> {
  const [row] = await db
    .select({
      fromEmail: campaigns.fromEmail,
      fromName: campaigns.fromName,
      id: campaigns.id,
      ownerId: campaigns.ownerId,
      preheader: campaigns.preheader,
      replyTo: campaigns.replyTo,
      scheduledAt: campaigns.scheduledAt,
      segmentDefinition: segments.definition,
      segmentId: campaigns.segmentId,
      settings: campaigns.settings,
      status: campaigns.status,
      subject: campaigns.subject,
    })
    .from(campaigns)
    .leftJoin(
      segments,
      and(
        eq(campaigns.segmentId, segments.id),
        eq(campaigns.ownerId, segments.ownerId),
      ),
    )
    .where(eq(campaigns.id, campaignId))
    .limit(1);

  return row ?? null;
}

async function failCampaign(
  campaign: Pick<CampaignWithSegment, "id" | "settings">,
  message: string,
) {
  await db
    .update(campaigns)
    .set({
      settings: mergeSettings(campaign.settings, {
        lastError: message,
        ...deliveryPatch(campaign.settings, { error: message }),
      }),
      status: "failed",
      updatedAt: new Date(),
    })
    .where(eq(campaigns.id, campaign.id));
}

async function loadSuppressedEmails(
  ownerId: string,
  emails: string[],
): Promise<Set<string>> {
  const found = new Set<string>();
  for (let i = 0; i < emails.length; i += 1000) {
    const group = emails.slice(i, i + 1000);
    if (group.length === 0) continue;
    const rows = await db
      .select({ email: suppressions.emailNormalized })
      .from(suppressions)
      .where(
        and(
          eq(suppressions.ownerId, ownerId),
          inArray(suppressions.emailNormalized, group),
        ),
      );
    for (const row of rows) found.add(row.email);
  }
  return found;
}

async function insertRecipients(
  campaign: CampaignWithSegment,
  recipients: SegmentRecipient[],
  suppressedEmails: Set<string>,
) {
  const byEmail = new Map<string, SegmentRecipient>();
  for (const recipient of recipients) {
    const normalized = normalizeEmail(recipient.email);
    if (!normalized || byEmail.has(normalized)) continue;
    byEmail.set(normalized, recipient);
  }

  const values = [...byEmail.entries()].map(([emailNormalized, recipient]) => ({
    campaignId: campaign.id,
    email: recipient.email?.trim() ?? emailNormalized,
    emailNormalized,
    error: suppressedEmails.has(emailNormalized)
      ? "Email en lista de supresion o contacto no suscrito."
      : null,
    name: fullName(recipient) || null,
    ownerId: campaign.ownerId,
    personId: recipient.id,
    status: suppressedEmails.has(emailNormalized)
      ? ("suppressed" as const)
      : ("pending" as const),
  }));

  for (let i = 0; i < values.length; i += 500) {
    const group = values.slice(i, i + 500);
    if (group.length === 0) continue;
    await db.insert(campaignRecipients).values(group).onConflictDoNothing();
  }
}

async function finalizeCampaign(
  campaign: CampaignWithSegment,
  stats: CampaignStats,
) {
  const status =
    (stats.sent ?? 0) > 0 || (stats.suppressed ?? 0) > 0 ? "sent" : "failed";
  await db
    .update(campaigns)
    .set({
      sentAt: new Date(),
      settings: mergeSettings(campaign.settings, {
        ...deliveryPatch(campaign.settings, {
          completedAt: new Date().toISOString(),
        }),
      }),
      status,
      updatedAt: new Date(),
    })
    .where(eq(campaigns.id, campaign.id));
  return status;
}

async function refreshCampaignStats(
  campaignId: string,
  ownerId: string,
): Promise<CampaignStats> {
  const statuses = [
    "sent",
    "delivered",
    "opened",
    "clicked",
    "bounced",
    "complained",
    "unsubscribed",
    "suppressed",
    "failed",
  ] as const satisfies readonly (keyof CampaignStats &
    CampaignRecipientStatus)[];
  const [audience, ...counts] = await Promise.all([
    db.$count(
      campaignRecipients,
      and(
        eq(campaignRecipients.campaignId, campaignId),
        eq(campaignRecipients.ownerId, ownerId),
      ),
    ),
    ...statuses.map((status) =>
      db.$count(
        campaignRecipients,
        and(
          eq(campaignRecipients.campaignId, campaignId),
          eq(campaignRecipients.ownerId, ownerId),
          eq(campaignRecipients.status, status),
        ),
      ),
    ),
  ]);

  const stats: CampaignStats = { audience };
  statuses.forEach((status, index) => {
    stats[status] = counts[index] ?? 0;
  });

  await db
    .update(campaigns)
    .set({ stats, updatedAt: new Date() })
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.ownerId, ownerId)));

  return stats;
}

function assertLaunchable(campaign: CampaignWithSegment): CampaignEmailBlock[] {
  if (!isResendConfigured()) {
    throw new CampaignDispatchError(
      "Falta RESEND_API_KEY. Configura Resend antes de enviar campanas.",
      "not_configured",
    );
  }
  resolveCampaignFrom(campaign);
  if (!campaign.segmentId || !campaign.segmentDefinition) {
    throw new CampaignDispatchError(
      "Selecciona un segmento antes de enviar la campana.",
      "invalid_campaign",
    );
  }
  const blocks = blocksFromSettings(campaign.settings);
  if (blocks.length === 0) {
    throw new CampaignDispatchError(
      "La campana no tiene contenido guardado en bloques.",
      "invalid_campaign",
    );
  }
  return blocks;
}

export async function validateCampaignCanQueue(
  campaignId: string,
  ownerId: string,
) {
  const campaign = await loadCampaign(campaignId);
  if (!campaign || campaign.ownerId !== ownerId) {
    throw new CampaignDispatchError("Campana no encontrada.", "not_found");
  }
  if (campaign.status === "sending" || campaign.status === "sent") {
    throw new CampaignDispatchError(
      "No se puede relanzar una campana enviada o en envio.",
      "invalid_campaign",
    );
  }
  assertLaunchable(campaign);
  return campaign;
}

export async function prepareCampaignForSend(campaignId: string) {
  const campaign = await loadCampaign(campaignId);
  if (!campaign) {
    throw new CampaignDispatchError("Campana no encontrada.", "not_found");
  }

  if (campaign.status !== "scheduled" && campaign.status !== "sending") {
    return {
      campaignId,
      state: "cancelled" as const,
      status: campaign.status,
    };
  }

  if (
    campaign.status === "scheduled" &&
    campaign.scheduledAt &&
    campaign.scheduledAt.getTime() > Date.now()
  ) {
    return {
      campaignId,
      state: "waiting" as const,
      waitUntil: campaign.scheduledAt.toISOString(),
    };
  }

  let blocks: CampaignEmailBlock[];
  try {
    blocks = assertLaunchable(campaign);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Campana no valida.";
    await failCampaign(campaign, message);
    throw error;
  }

  const recipients = await resolveSegmentRecipientsForOwner(
    campaign.segmentDefinition!,
    campaign.ownerId,
    { reachableOnly: true },
  );
  const normalizedEmails = recipients
    .map((recipient) => normalizeEmail(recipient.email))
    .filter((email): email is string => Boolean(email));
  const suppressedEmails = await loadSuppressedEmails(
    campaign.ownerId,
    normalizedEmails,
  );

  await insertRecipients(campaign, recipients, suppressedEmails);
  const stats = await refreshCampaignStats(campaign.id, campaign.ownerId);

  if ((stats.audience ?? 0) === 0) {
    const message = "El segmento no tiene contactos suscritos con email.";
    await failCampaign(campaign, message);
    throw new CampaignDispatchError(message, "invalid_campaign");
  }

  await db
    .update(campaigns)
    .set({
      settings: mergeSettings(campaign.settings, {
        lastError: null,
        ...deliveryPatch(campaign.settings, {
          batchSize: getCampaignDeliveryConfig().batchSize,
          preparedAt: new Date().toISOString(),
        }),
      }),
      status: "sending",
      updatedAt: new Date(),
    })
    .where(eq(campaigns.id, campaign.id));

  return {
    audience: stats.audience ?? 0,
    blocks: blocks.length,
    campaignId,
    state: "ready" as const,
    suppressed: stats.suppressed ?? 0,
  };
}

async function loadRecipientMergeData(
  ownerId: string,
  recipients: PendingRecipient[],
) {
  const ids = recipients
    .map((recipient) => recipient.personId)
    .filter((id): id is string => Boolean(id));
  if (ids.length === 0) return new Map<string, SegmentRecipient>();

  const rows = await db
    .select({
      id: persons.id,
      firstName: persons.firstName,
      lastName: persons.lastName,
      email: persons.email,
      phone: persons.phone,
      title: persons.title,
      customFields: persons.customFields,
      marketingStatus: persons.marketingStatus,
      orgName: organizations.name,
      orgTradeName: organizations.tradeName,
      orgWebsite: organizations.website,
      orgIndustry: organizations.industry,
      orgCustomFields: organizations.customFields,
    })
    .from(persons)
    .leftJoin(
      organizations,
      and(
        eq(persons.orgId, organizations.id),
        eq(organizations.ownerId, ownerId),
        isNull(organizations.deletedAt),
      ),
    )
    .where(
      and(
        eq(persons.ownerId, ownerId),
        isNull(persons.deletedAt),
        inArray(persons.id, ids),
      ),
    );

  return new Map(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        phone: row.phone,
        title: row.title,
        customFields: row.customFields,
        marketingStatus: row.marketingStatus,
        organization: row.orgName
          ? {
              name: row.orgName,
              tradeName: row.orgTradeName,
              website: row.orgWebsite,
              industry: row.orgIndustry,
              customFields: row.orgCustomFields ?? {},
            }
          : null,
      },
    ]),
  );
}

function fallbackPerson(recipient: PendingRecipient) {
  const [firstName = recipient.email, ...rest] = (recipient.name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return {
    customFields: {},
    email: recipient.email,
    firstName,
    lastName: rest.join(" ") || null,
    phone: null,
    title: null,
  };
}

export async function sendNextCampaignBatch(
  campaignId: string,
  batchIndex: number,
) {
  const campaign = await loadCampaign(campaignId);
  if (!campaign) {
    throw new CampaignDispatchError("Campana no encontrada.", "not_found");
  }
  if (campaign.status !== "sending") {
    return {
      campaignId,
      done: true,
      failed: 0,
      remaining: 0,
      sent: 0,
      state: "cancelled" as const,
    };
  }

  const config = getCampaignDeliveryConfig();
  const blocks = assertLaunchable(campaign);
  const pending = await db
    .select()
    .from(campaignRecipients)
    .where(
      and(
        eq(campaignRecipients.campaignId, campaign.id),
        eq(campaignRecipients.ownerId, campaign.ownerId),
        eq(campaignRecipients.status, "pending"),
      ),
    )
    .orderBy(asc(campaignRecipients.createdAt), asc(campaignRecipients.id))
    .limit(config.batchSize);

  if (pending.length === 0) {
    const stats = await refreshCampaignStats(campaign.id, campaign.ownerId);
    await finalizeCampaign(campaign, stats);
    return {
      campaignId,
      done: true,
      failed: stats.failed ?? 0,
      remaining: 0,
      sent: stats.sent ?? 0,
      state: "completed" as const,
    };
  }

  const suppressedEmails = await loadSuppressedEmails(
    campaign.ownerId,
    pending.map((recipient) => recipient.emailNormalized),
  );
  const suppressedNow = pending.filter((recipient) =>
    suppressedEmails.has(recipient.emailNormalized),
  );
  if (suppressedNow.length > 0) {
    await db.transaction(async (tx) => {
      for (const recipient of suppressedNow) {
        await tx
          .update(campaignRecipients)
          .set({
            error: "Email en lista de supresion.",
            status: "suppressed",
            updatedAt: new Date(),
          })
          .where(eq(campaignRecipients.id, recipient.id));
      }
    });
  }

  const sendable = pending.filter(
    (recipient) => !suppressedEmails.has(recipient.emailNormalized),
  );
  if (sendable.length === 0) {
    const remaining = await db.$count(
      campaignRecipients,
      and(
        eq(campaignRecipients.campaignId, campaign.id),
        eq(campaignRecipients.ownerId, campaign.ownerId),
        eq(campaignRecipients.status, "pending"),
      ),
    );
    const stats = await refreshCampaignStats(campaign.id, campaign.ownerId);
    if (remaining === 0) {
      await finalizeCampaign(campaign, stats);
    }
    return {
      campaignId,
      done: remaining === 0,
      failed: stats.failed ?? 0,
      remaining,
      sent: stats.sent ?? 0,
      state: "batch" as const,
    };
  }

  const [defs, mergeData] = await Promise.all([
    listAllCustomFieldDefsForOwner(campaign.ownerId),
    loadRecipientMergeData(campaign.ownerId, sendable),
  ]);
  const from = resolveCampaignFrom(campaign);
  const replyTo = clean(campaign.replyTo) ?? undefined;

  const emails = await Promise.all(
    sendable.map(async (recipient) => {
      const person =
        recipient.personId && mergeData.get(recipient.personId)
          ? mergeData.get(recipient.personId)!
          : fallbackPerson(recipient);
      const rendered = await renderCampaignEmail({
        blocks,
        mergeContext: buildMergeContext(
          person,
          "organization" in person ? person.organization : null,
          defs.person,
          defs.organization,
        ),
        mode: "personalized",
        preheader: campaign.preheader,
        subject: campaign.subject,
      });
      return {
        from,
        html: rendered.html,
        replyTo,
        subject: rendered.subject,
        tags: [
          { name: "type", value: "campaign" },
          { name: "campaignId", value: campaign.id },
          { name: "recipientId", value: recipient.id },
        ],
        text: rendered.text,
        to: recipient.email,
      };
    }),
  );

  let result;
  try {
    result = await sendResendBatch(emails, {
      idempotencyKey: `campaign:${campaign.id}:batch:${batchIndex}`,
    });
  } catch (error) {
    if (
      error instanceof ResendServiceError &&
      (error.code === "not_configured" ||
        error.status === 401 ||
        error.status === 403)
    ) {
      await failCampaign(campaign, error.message);
      throw new CampaignDispatchError(error.message, "transport_error");
    }
    throw error;
  }

  await db.transaction(async (tx) => {
    for (const [index, item] of result.results.entries()) {
      const recipient = sendable[index];
      if (!recipient) continue;
      await tx
        .update(campaignRecipients)
        .set(
          item.ok
            ? {
                error: null,
                providerMessageId: item.id,
                sentAt: new Date(),
                status: "sent",
                updatedAt: new Date(),
              }
            : {
                error: item.error,
                status: "failed",
                updatedAt: new Date(),
              },
        )
        .where(eq(campaignRecipients.id, recipient.id));
    }
  });

  const remaining = await db.$count(
    campaignRecipients,
    and(
      eq(campaignRecipients.campaignId, campaign.id),
      eq(campaignRecipients.ownerId, campaign.ownerId),
      eq(campaignRecipients.status, "pending"),
    ),
  );
  const stats = await refreshCampaignStats(campaign.id, campaign.ownerId);
  if (remaining === 0) {
    await finalizeCampaign(campaign, stats);
  }
  return {
    campaignId,
    done: remaining === 0,
    failed: result.failed,
    remaining,
    sent: result.sent,
    state: "batch" as const,
    totalFailed: stats.failed ?? 0,
    totalSent: stats.sent ?? 0,
  };
}
