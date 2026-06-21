import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";

import { escapeHtml } from "@/lib/email/merge-tags";
import { db } from "@/server/db";
import {
  campaignRecipients,
  campaigns,
  emailEvents,
  persons,
  suppressions,
} from "@/server/db/schema";
import { refreshCampaignStats } from "@/server/services/campaign-stats";
import { getEmailTrackingBaseUrl } from "@/server/services/email-tracking";

type UnsubscribePayload = {
  campaignId: string;
  email: string;
  recipientId: string;
  v: 1;
};

type UnsubscribeSource = "page" | "one_click";

export type CampaignUnsubscribePreview =
  | {
      ok: true;
      campaignName: string;
      campaignSubject: string;
      email: string;
      isUnsubscribed: boolean;
    }
  | { ok: false; reason: "invalid" | "not_found" };

export type CampaignUnsubscribeResult =
  | {
      ok: true;
      alreadyUnsubscribed: boolean;
      campaignName: string;
      campaignSubject: string;
      email: string;
    }
  | { ok: false; reason: "invalid" | "not_found" };

function getUnsubscribeSecret(): string {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET es obligatorio para firmar bajas de campaña.");
  }
  return "nexo-crm-campaign-unsubscribe-dev-secret";
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function encodePayload(payload: UnsubscribePayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodePayload(value: string): UnsubscribePayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object") return null;
    const payload = parsed as Record<string, unknown>;
    if (
      payload.v !== 1 ||
      typeof payload.campaignId !== "string" ||
      typeof payload.recipientId !== "string" ||
      typeof payload.email !== "string"
    ) {
      return null;
    }
    return {
      campaignId: payload.campaignId,
      email: payload.email,
      recipientId: payload.recipientId,
      v: 1,
    };
  } catch {
    return null;
  }
}

function signPayload(encodedPayload: string): string {
  return createHmac("sha256", getUnsubscribeSecret())
    .update("campaign-unsubscribe")
    .update("\0")
    .update(encodedPayload)
    .digest("base64url");
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function verifyCampaignUnsubscribeToken(
  token: string,
): UnsubscribePayload | null {
  const [encodedPayload, signature, ...extra] = token.split(".");
  if (!encodedPayload || !signature || extra.length > 0) return null;
  const expected = signPayload(encodedPayload);
  if (!constantTimeEqual(signature, expected)) return null;
  return decodePayload(encodedPayload);
}

export function createCampaignUnsubscribeToken(input: {
  campaignId: string;
  email: string;
  recipientId: string;
}): string {
  const encodedPayload = encodePayload({
    campaignId: input.campaignId,
    email: normalizeEmail(input.email),
    recipientId: input.recipientId,
    v: 1,
  });
  return `${encodedPayload}.${signPayload(encodedPayload)}`;
}

export function createCampaignUnsubscribeLinks(input: {
  campaignId: string;
  email: string;
  recipientId: string;
}) {
  const token = createCampaignUnsubscribeToken(input);
  const baseUrl = getEmailTrackingBaseUrl();
  return {
    confirmationUrl: new URL(`/unsubscribe/${token}`, baseUrl).toString(),
    oneClickUrl: new URL(
      `/api/campaigns/unsubscribe/${token}`,
      baseUrl,
    ).toString(),
    token,
  };
}

export function campaignUnsubscribeHeaders(input: {
  confirmationUrl: string;
  oneClickUrl: string;
}): Record<string, string> {
  return {
    "List-Unsubscribe": `<${input.oneClickUrl}>, <${input.confirmationUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

export function appendCampaignUnsubscribeFooter(input: {
  confirmationUrl: string;
  html: string;
  text: string;
}) {
  const url = escapeHtml(input.confirmationUrl);
  const footerHtml = `<hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 16px;" /><p style="color:#6b7280;font-size:12px;line-height:1.5;margin:0;">Recibes este correo porque estás suscrito a comunicaciones de Nexo CRM. <a href="${url}" style="color:#2563eb;text-decoration:underline;">Darte de baja</a>.</p>`;
  return {
    html: `${input.html}\n${footerHtml}`,
    text: `${input.text.trim()}\n\nPara dejar de recibir estas campañas: ${input.confirmationUrl}`,
  };
}

async function loadRecipient(payload: UnsubscribePayload) {
  const emailNormalized = normalizeEmail(payload.email);
  const [row] = await db
    .select({
      campaignName: campaigns.name,
      campaignSubject: campaigns.subject,
      email: campaignRecipients.email,
      emailNormalized: campaignRecipients.emailNormalized,
      id: campaignRecipients.id,
      ownerId: campaignRecipients.ownerId,
      personId: campaignRecipients.personId,
      status: campaignRecipients.status,
      unsubscribedAt: campaignRecipients.unsubscribedAt,
    })
    .from(campaignRecipients)
    .innerJoin(campaigns, eq(campaignRecipients.campaignId, campaigns.id))
    .where(
      and(
        eq(campaignRecipients.id, payload.recipientId),
        eq(campaignRecipients.campaignId, payload.campaignId),
        eq(campaignRecipients.emailNormalized, emailNormalized),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function getCampaignUnsubscribePreview(
  token: string,
): Promise<CampaignUnsubscribePreview> {
  const payload = verifyCampaignUnsubscribeToken(token);
  if (!payload) return { ok: false, reason: "invalid" };
  const recipient = await loadRecipient(payload);
  if (!recipient) return { ok: false, reason: "not_found" };
  return {
    campaignName: recipient.campaignName,
    campaignSubject: recipient.campaignSubject,
    email: recipient.email,
    isUnsubscribed:
      recipient.status === "unsubscribed" || recipient.unsubscribedAt !== null,
    ok: true,
  };
}

function clientIp(request: Request | undefined): string | null {
  return (
    request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request?.headers.get("x-real-ip")?.trim() ||
    null
  );
}

function userAgent(request: Request | undefined): string | null {
  return request?.headers.get("user-agent")?.slice(0, 1000) ?? null;
}

export async function unsubscribeCampaignRecipient(input: {
  request?: Request;
  source: UnsubscribeSource;
  token: string;
}): Promise<CampaignUnsubscribeResult> {
  const payload = verifyCampaignUnsubscribeToken(input.token);
  if (!payload) return { ok: false, reason: "invalid" };

  const recipient = await loadRecipient(payload);
  if (!recipient) return { ok: false, reason: "not_found" };

  const alreadyUnsubscribed =
    recipient.status === "unsubscribed" || recipient.unsubscribedAt !== null;
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .insert(suppressions)
      .values({
        email: recipient.email,
        emailNormalized: recipient.emailNormalized,
        note:
          input.source === "one_click"
            ? "Baja one-click desde cabecera List-Unsubscribe."
            : "Baja confirmada desde pagina publica.",
        ownerId: recipient.ownerId,
        reason: "unsubscribe",
        source: `campaign:${payload.campaignId}`,
      })
      .onConflictDoUpdate({
        target: [suppressions.ownerId, suppressions.emailNormalized],
        set: {
          email: recipient.email,
          note:
            input.source === "one_click"
              ? "Baja one-click desde cabecera List-Unsubscribe."
              : "Baja confirmada desde pagina publica.",
          reason: "unsubscribe",
          source: `campaign:${payload.campaignId}`,
        },
      });

    await tx
      .update(campaignRecipients)
      .set({
        error: null,
        status: "unsubscribed",
        unsubscribedAt: recipient.unsubscribedAt ?? now,
        updatedAt: now,
      })
      .where(eq(campaignRecipients.id, recipient.id));

    if (recipient.personId) {
      await tx
        .update(persons)
        .set({ marketingStatus: "unsubscribed", updatedAt: now })
        .where(
          and(
            eq(persons.id, recipient.personId),
            eq(persons.ownerId, recipient.ownerId),
          ),
        );
    }

    await tx
      .insert(emailEvents)
      .values({
        ipAddress: clientIp(input.request),
        meta: {
          campaignId: payload.campaignId,
          recipientId: recipient.id,
          source: input.source,
        },
        occurredAt: now,
        ownerId: recipient.ownerId,
        provider: "resend",
        providerEventId: `campaign:unsubscribe:${recipient.id}`,
        recipientEmail: recipient.email,
        type: "unsubscribe",
        userAgent: userAgent(input.request),
      })
      .onConflictDoNothing();
  });

  await refreshCampaignStats(payload.campaignId, recipient.ownerId);

  return {
    alreadyUnsubscribed,
    campaignName: recipient.campaignName,
    campaignSubject: recipient.campaignSubject,
    email: recipient.email,
    ok: true,
  };
}
