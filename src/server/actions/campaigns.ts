"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/session";
import {
  type CampaignDraftValues,
  type CampaignTestValues,
  campaignDraftSchema,
  campaignTestSchema,
} from "@/lib/validations/campaign";
import { db } from "@/server/db";
import { campaigns, segments } from "@/server/db/schema";
import {
  type RenderedCampaignEmail,
  renderCampaignEmail,
} from "@/server/services/campaign-email";
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
  return renderCampaignEmail({
    subject: data.subject,
    preheader: data.preheader,
    blocks: data.blocks,
    mode: "template",
  });
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
  if (error instanceof Error) return error.message;
  return "No se pudo enviar la prueba.";
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
    },
  };

  if (data.id) {
    await assertEditableCampaign(user.id, data.id);
    const [row] = await db
      .update(campaigns)
      .set(values)
      .where(and(eq(campaigns.id, data.id), eq(campaigns.ownerId, user.id)))
      .returning({ id: campaigns.id });
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

  try {
    const result = await sendResendEmail({
      from: resolveFrom(data),
      to: data.testEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
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
