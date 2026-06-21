import "server-only";

import { and, eq, or } from "drizzle-orm";

import {
  type ResendEmailEventType,
  type ResendWebhookEvent,
  isResendEmailEventType,
} from "@/lib/validations/resend-webhook";
import { db } from "@/server/db";
import {
  type CampaignRecipientStatus,
  type EmailEventType,
  campaignRecipients,
  emailEvents,
  enrollments,
  persons,
  suppressions,
} from "@/server/db/schema";
import { refreshCampaignStats } from "@/server/services/campaign-stats";
import {
  emitSequenceSignalSafely,
  sequenceSignalFromResendTags,
  type SequenceSignalType,
} from "@/server/services/sequence-runner";

export type ResendWebhookProcessResult =
  | {
      eventId: string;
      eventType: string;
      ok: true;
      status: "duplicate" | "ignored" | "processed" | "recipient_not_found";
    }
  | {
      eventId: string;
      eventType: string;
      ok: false;
      status: "invalid";
    };

type RecipientRow = {
  bouncedAt: Date | null;
  campaignId: string;
  clickedAt: Date | null;
  deliveredAt: Date | null;
  email: string;
  emailNormalized: string;
  id: string;
  openedAt: Date | null;
  ownerId: string;
  personId: string | null;
  providerMessageId: string | null;
  sentAt: Date | null;
  status: CampaignRecipientStatus;
};

type SequenceRecipientRow = {
  enrollmentId: string;
  ownerId: string;
  sequenceId: string;
};

type EventMapping = {
  eventType: EmailEventType;
  status?: CampaignRecipientStatus;
  suppression?: "bounce" | "complaint";
  timestampField?:
    | "bouncedAt"
    | "clickedAt"
    | "deliveredAt"
    | "openedAt"
    | "sentAt";
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const STATUS_RANK: Record<CampaignRecipientStatus, number> = {
  pending: 0,
  sent: 1,
  delivered: 2,
  opened: 3,
  clicked: 4,
  failed: 5,
  bounced: 6,
  suppressed: 6,
  unsubscribed: 6,
  complained: 7,
};

function normalizeEmail(value: string | null | undefined): string | null {
  const email = value?.trim().toLowerCase();
  return email ? email : null;
}

function primaryRecipient(event: ResendWebhookEvent): string | null {
  return event.data.to[0] ?? null;
}

function webhookEventId(svixId: string): string {
  return `resend:${svixId}`;
}

function eventOccurredAt(event: ResendWebhookEvent): Date {
  const timestamp =
    event.type === "email.clicked" && event.data.click?.timestamp
      ? event.data.click.timestamp
      : event.created_at;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function mapEvent(type: ResendEmailEventType): EventMapping {
  switch (type) {
    case "email.sent":
      return { eventType: "sent", status: "sent", timestampField: "sentAt" };
    case "email.delivered":
      return {
        eventType: "delivered",
        status: "delivered",
        timestampField: "deliveredAt",
      };
    case "email.opened":
      return {
        eventType: "open",
        status: "opened",
        timestampField: "openedAt",
      };
    case "email.clicked":
      return {
        eventType: "click",
        status: "clicked",
        timestampField: "clickedAt",
      };
    case "email.bounced":
      return {
        eventType: "bounce",
        status: "bounced",
        suppression: "bounce",
        timestampField: "bouncedAt",
      };
    case "email.complained":
      return {
        eventType: "complaint",
        status: "complained",
        suppression: "complaint",
      };
    case "email.suppressed":
      return {
        eventType: "suppressed",
        status: "suppressed",
        suppression: "bounce",
      };
    case "email.failed":
      return { eventType: "failed", status: "failed" };
    case "email.delivery_delayed":
      return { eventType: "delivery_delayed" };
  }
}

async function eventAlreadyProcessed(
  providerEventId: string,
): Promise<boolean> {
  const [existing] = await db
    .select({ id: emailEvents.id })
    .from(emailEvents)
    .where(
      and(
        eq(emailEvents.provider, "resend"),
        eq(emailEvents.providerEventId, providerEventId),
      ),
    )
    .limit(1);
  return Boolean(existing);
}

async function loadRecipient(
  event: ResendWebhookEvent,
): Promise<RecipientRow | null> {
  const tags = event.data.tags;
  const campaignId = tags.campaignId;
  const recipientId = tags.recipientId;
  const emailNormalized = normalizeEmail(primaryRecipient(event));
  const byId =
    campaignId &&
    recipientId &&
    UUID_RE.test(campaignId) &&
    UUID_RE.test(recipientId)
      ? await db
          .select()
          .from(campaignRecipients)
          .where(
            and(
              eq(campaignRecipients.id, recipientId),
              eq(campaignRecipients.campaignId, campaignId),
              emailNormalized
                ? eq(campaignRecipients.emailNormalized, emailNormalized)
                : undefined,
            ),
          )
          .limit(1)
      : [];
  if (byId[0]) return byId[0];

  const [byMessage] = await db
    .select()
    .from(campaignRecipients)
    .where(
      and(
        eq(campaignRecipients.providerMessageId, event.data.email_id),
        emailNormalized
          ? or(
              eq(campaignRecipients.emailNormalized, emailNormalized),
              eq(campaignRecipients.email, primaryRecipient(event) ?? ""),
            )
          : undefined,
      ),
    )
    .limit(1);
  return byMessage ?? null;
}

async function loadSequenceRecipient(
  event: ResendWebhookEvent,
): Promise<SequenceRecipientRow | null> {
  const tags = event.data.tags;
  if (tags.type !== "sequence") return null;
  const { enrollmentId, sequenceId } = tags;
  if (
    !enrollmentId ||
    !sequenceId ||
    !UUID_RE.test(enrollmentId) ||
    !UUID_RE.test(sequenceId)
  ) {
    return null;
  }

  const [row] = await db
    .select({
      enrollmentId: enrollments.id,
      ownerId: enrollments.ownerId,
      sequenceId: enrollments.sequenceId,
    })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.id, enrollmentId),
        eq(enrollments.sequenceId, sequenceId),
      ),
    )
    .limit(1);

  return row ?? null;
}

function nextStatus(
  current: CampaignRecipientStatus,
  incoming: CampaignRecipientStatus | undefined,
): CampaignRecipientStatus | undefined {
  if (!incoming) return undefined;
  return STATUS_RANK[incoming] >= STATUS_RANK[current] ? incoming : current;
}

function recipientPatch(
  recipient: RecipientRow,
  mapping: EventMapping,
  occurredAt: Date,
) {
  const patch: Partial<typeof campaignRecipients.$inferInsert> = {
    error: null,
    updatedAt: new Date(),
  };

  const status = nextStatus(recipient.status, mapping.status);
  if (status) patch.status = status;
  if (mapping.timestampField) {
    const current = recipient[mapping.timestampField];
    patch[mapping.timestampField] = current ?? occurredAt;
  }

  return patch;
}

function eventMeta(event: ResendWebhookEvent, svixId: string) {
  const sequence =
    event.data.tags.type === "sequence"
      ? {
          enrollmentId: event.data.tags.enrollmentId ?? null,
          sequenceId: event.data.tags.sequenceId ?? null,
          stepId: event.data.tags.stepId ?? null,
        }
      : undefined;

  return {
    bounce: event.data.bounce ?? null,
    campaignId: event.data.tags.campaignId ?? null,
    emailId: event.data.email_id,
    rawType: event.type,
    recipientId: event.data.tags.recipientId ?? null,
    ...(sequence ? { sequence } : {}),
    svixId,
    tags: event.data.tags,
  };
}

function sequenceSignalTypeForEvent(
  eventType: EmailEventType,
): SequenceSignalType | null {
  switch (eventType) {
    case "bounce":
    case "complaint":
    case "suppressed":
      return "bounce";
    case "click":
      return "click";
    case "open":
      return "open";
    case "unsubscribe":
      return "unsubscribe";
    default:
      return null;
  }
}

function suppressionNote(
  event: ResendWebhookEvent,
  reason: "bounce" | "complaint",
) {
  if (reason === "complaint") {
    return "Queja de spam recibida por webhook de Resend.";
  }
  return (
    event.data.bounce?.message ??
    "Rebote o supresion recibida por webhook de Resend."
  );
}

function marketingStatusForSuppression(reason: "bounce" | "complaint") {
  return reason === "complaint" ? "complained" : "bounced";
}

async function refreshStatsForDuplicate(event: ResendWebhookEvent) {
  const recipient = await loadRecipient(event);
  if (!recipient) return;
  await refreshCampaignStats(recipient.campaignId, recipient.ownerId);
}

export async function processResendWebhookEvent(input: {
  event: ResendWebhookEvent;
  svixId: string;
}): Promise<ResendWebhookProcessResult> {
  const providerEventId = webhookEventId(input.svixId);
  if (!isResendEmailEventType(input.event.type)) {
    return {
      eventId: providerEventId,
      eventType: input.event.type,
      ok: true,
      status: "ignored",
    };
  }

  if (await eventAlreadyProcessed(providerEventId)) {
    await refreshStatsForDuplicate(input.event);
    return {
      eventId: providerEventId,
      eventType: input.event.type,
      ok: true,
      status: "duplicate",
    };
  }

  const sequenceRecipient = await loadSequenceRecipient(input.event);
  if (sequenceRecipient) {
    const occurredAt = eventOccurredAt(input.event);
    const mapping = mapEvent(input.event.type);
    const [eventRow] = await db
      .insert(emailEvents)
      .values({
        ipAddress: input.event.data.click?.ipAddress ?? null,
        meta: eventMeta(input.event, input.svixId),
        occurredAt,
        ownerId: sequenceRecipient.ownerId,
        provider: "resend",
        providerEventId,
        recipientEmail: primaryRecipient(input.event),
        type: mapping.eventType,
        url: input.event.data.click?.link ?? null,
        userAgent: input.event.data.click?.userAgent?.slice(0, 1000) ?? null,
      })
      .onConflictDoNothing()
      .returning({ id: emailEvents.id });

    if (!eventRow) {
      return {
        eventId: providerEventId,
        eventType: input.event.type,
        ok: true,
        status: "duplicate",
      };
    }

    const signalType = sequenceSignalTypeForEvent(mapping.eventType);
    if (signalType) {
      await emitSequenceSignalSafely(
        sequenceSignalFromResendTags({
          occurredAt,
          ownerId: sequenceRecipient.ownerId,
          providerEventId,
          recipientEmail: primaryRecipient(input.event),
          tags: input.event.data.tags,
          type: signalType,
          url: input.event.data.click?.link ?? null,
        }),
      );
    }

    return {
      eventId: providerEventId,
      eventType: input.event.type,
      ok: true,
      status: "processed",
    };
  }

  const recipient = await loadRecipient(input.event);
  if (!recipient) {
    return {
      eventId: providerEventId,
      eventType: input.event.type,
      ok: true,
      status: "recipient_not_found",
    };
  }

  const occurredAt = eventOccurredAt(input.event);
  const mapping = mapEvent(input.event.type);
  let insertedEvent = false;

  await db.transaction(async (tx) => {
    const [eventRow] = await tx
      .insert(emailEvents)
      .values({
        ipAddress: input.event.data.click?.ipAddress ?? null,
        meta: eventMeta(input.event, input.svixId),
        occurredAt,
        ownerId: recipient.ownerId,
        provider: "resend",
        providerEventId,
        recipientEmail: primaryRecipient(input.event) ?? recipient.email,
        type: mapping.eventType,
        url: input.event.data.click?.link ?? null,
        userAgent: input.event.data.click?.userAgent?.slice(0, 1000) ?? null,
      })
      .onConflictDoNothing()
      .returning({ id: emailEvents.id });

    if (!eventRow) return;
    insertedEvent = true;

    await tx
      .update(campaignRecipients)
      .set(recipientPatch(recipient, mapping, occurredAt))
      .where(eq(campaignRecipients.id, recipient.id));

    if (mapping.suppression) {
      const note = suppressionNote(input.event, mapping.suppression);
      await tx
        .insert(suppressions)
        .values({
          email: recipient.email,
          emailNormalized: recipient.emailNormalized,
          note,
          ownerId: recipient.ownerId,
          reason: mapping.suppression,
          source: `resend:${input.event.data.email_id}`,
        })
        .onConflictDoUpdate({
          target: [suppressions.ownerId, suppressions.emailNormalized],
          set: {
            email: recipient.email,
            note,
            reason: mapping.suppression,
            source: `resend:${input.event.data.email_id}`,
          },
        });

      if (recipient.personId) {
        await tx
          .update(persons)
          .set({
            marketingStatus: marketingStatusForSuppression(mapping.suppression),
            updatedAt: occurredAt,
          })
          .where(
            and(
              eq(persons.id, recipient.personId),
              eq(persons.ownerId, recipient.ownerId),
            ),
          );
      }
    }
  });

  if (!insertedEvent) {
    await refreshCampaignStats(recipient.campaignId, recipient.ownerId);
    return {
      eventId: providerEventId,
      eventType: input.event.type,
      ok: true,
      status: "duplicate",
    };
  }

  await refreshCampaignStats(recipient.campaignId, recipient.ownerId);

  return {
    eventId: providerEventId,
    eventType: input.event.type,
    ok: true,
    status: "processed",
  };
}
