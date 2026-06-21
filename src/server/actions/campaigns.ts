"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/session";
import {
  campaignComplianceErrorMessage,
  campaignIdSchema,
  type CampaignDraftValues,
  type CampaignScheduleValues,
  type CampaignTestValues,
  campaignDraftSchema,
  campaignScheduleSchema,
  campaignTestSchema,
} from "@/lib/validations/campaign";
import { db } from "@/server/db";
import { campaignRecipients, campaigns, segments } from "@/server/db/schema";
import { inngest } from "@/server/inngest/client";
import {
  type RenderedCampaignEmail,
  renderCampaignEmail,
} from "@/server/services/campaign-email";
import { appendCampaignUnsubscribeFooter } from "@/server/services/campaign-unsubscribe";
import {
  CAMPAIGN_SEND_EVENT,
  CampaignDispatchError,
  validateCampaignCanQueue,
} from "@/server/services/campaign-dispatch";
import {
  ResendServiceError,
  formatFrom,
  sendResendEmail,
} from "@/server/services/resend";

type CurrentUser = Awaited<ReturnType<typeof requireUser>>;

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function revalidateCampaigns() {
  revalidatePath("/campaigns");
}

function mergeSettings(
  settings: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return { ...settings, ...patch };
}

async function assertOwnedSegment(ownerId: string, segmentId: string | null) {
  if (!segmentId) return;
  const [row] = await db
    .select({ id: segments.id })
    .from(segments)
    .where(and(eq(segments.id, segmentId), eq(segments.ownerId, ownerId)))
    .limit(1);
  if (!row) throw new Error("Segmento no encontrado");
}

async function assertEditableCampaign(ownerId: string, id: string) {
  const [row] = await db
    .select({ id: campaigns.id, status: campaigns.status })
    .from(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.ownerId, ownerId)))
    .limit(1);

  if (!row) throw new Error("Campaña no encontrada");
  if (row.status === "sending" || row.status === "sent") {
    throw new Error("No se puede editar una campaña enviada o en envío.");
  }
}

async function renderDraftForStorage(
  data: CampaignDraftValues,
): Promise<RenderedCampaignEmail> {
  const rendered = await renderCampaignEmail({
    subject: data.subject,
    preheader: data.preheader,
    blocks: data.blocks,
    mode: "template",
  });
  return appendComplianceFooterIfReady(rendered, data);
}

function testMergeContext(
  user: CurrentUser,
  testEmail: string,
): Record<string, string> {
  const nameParts = user.name?.trim().split(/\s+/).filter(Boolean) ?? [];
  const firstName = nameParts[0] ?? "Luis";
  const lastName = nameParts.slice(1).join(" ");
  return {
    nombre: firstName,
    apellidos: lastName,
    nombre_completo: [firstName, lastName].filter(Boolean).join(" "),
    email: testEmail,
    telefono: "",
    cargo: "Responsable comercial",
    empresa: "Nexo CRM",
    "empresa.nombre_comercial": "Nexo CRM",
    "empresa.web": "https://nexo.local",
    "empresa.sector": "CRM",
  };
}

function resolveFrom(data: CampaignDraftValues): string {
  const email = clean(data.fromEmail) ?? clean(process.env.CAMPAIGN_FROM_EMAIL);
  if (!email) {
    throw new Error(
      "Configura CAMPAIGN_FROM_EMAIL o indica un remitente antes de enviar la prueba.",
    );
  }
  const name = clean(data.fromName) ?? clean(process.env.CAMPAIGN_FROM_NAME);
  return formatFrom(name, email);
}

function resendErrorMessage(error: unknown): string {
  if (error instanceof ResendServiceError) return error.message;
  if (error instanceof CampaignDispatchError) return error.message;
  if (error instanceof Error) return error.message;
  return "No se pudo enviar la prueba.";
}

function assertCampaignComplianceReady(data: CampaignDraftValues) {
  const message = campaignComplianceErrorMessage(data.compliance);
  if (message) throw new Error(message);
  return data.compliance;
}

function appendComplianceFooterIfReady(
  rendered: RenderedCampaignEmail,
  data: CampaignDraftValues,
): RenderedCampaignEmail {
  if (campaignComplianceErrorMessage(data.compliance)) return rendered;
  const body = appendCampaignUnsubscribeFooter({
    compliance: data.compliance,
    html: rendered.html,
    text: rendered.text,
  });
  return { ...rendered, html: body.html, text: body.text };
}

async function queueCampaignDispatch(campaignId: string) {
  await inngest.send({
    data: { campaignId },
    name: CAMPAIGN_SEND_EVENT,
  });
}

async function markQueueError(
  ownerId: string,
  campaignId: string,
  settings: Record<string, unknown>,
  message: string,
) {
  await db
    .update(campaigns)
    .set({
      settings: mergeSettings(settings, {
        delivery: {
          error: message,
          queueFailedAt: new Date().toISOString(),
        },
        lastError: message,
      }),
      status: "failed",
      updatedAt: new Date(),
    })
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.ownerId, ownerId)));
}

export async function previewCampaignEmail(raw: CampaignDraftValues) {
  await requireUser();
  const data = campaignDraftSchema.parse(raw);
  return renderDraftForStorage(data);
}

export async function saveCampaignDraft(raw: CampaignDraftValues) {
  const user = await requireUser();
  const data = campaignDraftSchema.parse(raw);
  await assertOwnedSegment(user.id, data.segmentId);

  const rendered = await renderDraftForStorage(data);
  const values = {
    name: data.name,
    subject: rendered.subject,
    preheader: clean(data.preheader),
    fromName: clean(data.fromName),
    fromEmail: clean(data.fromEmail),
    replyTo: clean(data.replyTo),
    segmentId: data.segmentId,
    bodyHtml: rendered.html,
    bodyText: rendered.text,
    status: "draft" as const,
    settings: {
      editor: "react-email-blocks",
      blocks: data.blocks,
      compliance: data.compliance,
    },
  };

  if (data.id) {
    const campaignId = data.id;
    await assertEditableCampaign(user.id, campaignId);
    const [row] = await db.transaction(async (tx) => {
      const updated = await tx
        .update(campaigns)
        .set({
          ...values,
          scheduledAt: null,
          sentAt: null,
          stats: {},
        })
        .where(
          and(eq(campaigns.id, campaignId), eq(campaigns.ownerId, user.id)),
        )
        .returning({ id: campaigns.id });
      await tx
        .delete(campaignRecipients)
        .where(eq(campaignRecipients.campaignId, campaignId));
      return updated;
    });
    if (!row) throw new Error("No se pudo guardar la campaña");
    revalidateCampaigns();
    return { id: row.id };
  }

  const [row] = await db
    .insert(campaigns)
    .values({
      ...values,
      ownerId: user.id,
      provider: "resend",
    })
    .returning({ id: campaigns.id });
  if (!row) throw new Error("No se pudo crear la campaña");
  revalidateCampaigns();
  return { id: row.id };
}

export async function sendCampaignTest(raw: CampaignTestValues) {
  const user = await requireUser();
  const data = campaignTestSchema.parse(raw);
  await assertOwnedSegment(user.id, data.segmentId);

  const rendered = await renderCampaignEmail({
    subject: data.subject,
    preheader: data.preheader,
    blocks: data.blocks,
    mode: "personalized",
    mergeContext: testMergeContext(user, data.testEmail),
  });
  const compliance = assertCampaignComplianceReady(data);
  const body = appendCampaignUnsubscribeFooter({
    compliance,
    html: rendered.html,
    recipientSource: "prueba interna",
    text: rendered.text,
  });

  try {
    const result = await sendResendEmail({
      from: resolveFrom(data),
      to: data.testEmail,
      subject: rendered.subject,
      html: body.html,
      text: body.text,
      replyTo: clean(data.replyTo) ?? undefined,
      tags: [{ name: "type", value: "campaign_test" }],
    });
    return { id: result.id };
  } catch (error) {
    throw new Error(resendErrorMessage(error));
  }
}

export async function deleteCampaignDraft(id: string) {
  const user = await requireUser();
  await assertEditableCampaign(user.id, id);
  await db
    .delete(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.ownerId, user.id)));
  revalidateCampaigns();
  return { id };
}

export async function scheduleCampaign(raw: CampaignScheduleValues) {
  const user = await requireUser();
  const data = campaignScheduleSchema.parse(raw);
  const scheduledAt = new Date(data.scheduledAt);
  if (scheduledAt.getTime() < Date.now() - 60_000) {
    throw new Error("Elige una fecha futura para programar la campaña.");
  }

  const campaign = await validateCampaignCanQueue(data.campaignId, user.id);
  await db.transaction(async (tx) => {
    await tx
      .delete(campaignRecipients)
      .where(eq(campaignRecipients.campaignId, data.campaignId));
    await tx
      .update(campaigns)
      .set({
        scheduledAt,
        sentAt: null,
        settings: mergeSettings(campaign.settings, {
          delivery: {
            queuedAt: new Date().toISOString(),
            scheduledAt: scheduledAt.toISOString(),
          },
          lastError: null,
        }),
        stats: {},
        status: "scheduled",
        updatedAt: new Date(),
      })
      .where(
        and(eq(campaigns.id, data.campaignId), eq(campaigns.ownerId, user.id)),
      );
  });

  try {
    await queueCampaignDispatch(data.campaignId);
  } catch (error) {
    const message =
      error instanceof Error
        ? `No se pudo encolar el envio en Inngest: ${error.message}`
        : "No se pudo encolar el envio en Inngest.";
    await markQueueError(user.id, data.campaignId, campaign.settings, message);
    revalidateCampaigns();
    throw new Error(message);
  }

  revalidateCampaigns();
  return { id: data.campaignId, scheduledAt: scheduledAt.toISOString() };
}

export async function sendCampaignNow(id: string) {
  const user = await requireUser();
  const campaignId = campaignIdSchema.parse(id);
  const campaign = await validateCampaignCanQueue(campaignId, user.id);
  const scheduledAt = new Date();

  await db.transaction(async (tx) => {
    await tx
      .delete(campaignRecipients)
      .where(eq(campaignRecipients.campaignId, campaignId));
    await tx
      .update(campaigns)
      .set({
        scheduledAt,
        sentAt: null,
        settings: mergeSettings(campaign.settings, {
          delivery: {
            queuedAt: scheduledAt.toISOString(),
            scheduledAt: scheduledAt.toISOString(),
          },
          lastError: null,
        }),
        stats: {},
        status: "scheduled",
        updatedAt: new Date(),
      })
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.ownerId, user.id)));
  });

  try {
    await queueCampaignDispatch(campaignId);
  } catch (error) {
    const message =
      error instanceof Error
        ? `No se pudo encolar el envio en Inngest: ${error.message}`
        : "No se pudo encolar el envio en Inngest.";
    await markQueueError(user.id, campaignId, campaign.settings, message);
    revalidateCampaigns();
    throw new Error(message);
  }

  revalidateCampaigns();
  return { id: campaignId };
}

export async function cancelScheduledCampaign(id: string) {
  const user = await requireUser();
  const campaignId = campaignIdSchema.parse(id);
  const [campaign] = await db
    .select({ settings: campaigns.settings, status: campaigns.status })
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.ownerId, user.id)))
    .limit(1);
  if (!campaign) throw new Error("Campaña no encontrada");
  if (campaign.status !== "scheduled") {
    throw new Error("Solo se puede cancelar una campaña programada.");
  }

  await db
    .update(campaigns)
    .set({
      scheduledAt: null,
      settings: mergeSettings(campaign.settings, {
        delivery: { cancelledAt: new Date().toISOString() },
      }),
      status: "draft",
      updatedAt: new Date(),
    })
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.ownerId, user.id)));
  revalidateCampaigns();
  return { id: campaignId };
}
