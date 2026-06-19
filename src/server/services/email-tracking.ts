import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { eq, sql } from "drizzle-orm";

import { escapeHtml, textToHtml } from "@/lib/email/merge-tags";
import { db } from "@/server/db";
import { emailEvents, emailMessages } from "@/server/db/schema";
import { sanitizeEmailHtml } from "@/server/services/email-html";

const LOCAL_APP_URL = "http://localhost:3000";

export const TRACKING_PIXEL = Buffer.from(
  "R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==",
  "base64",
);

export const TRACKING_NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
  Expires: "0",
  Pragma: "no-cache",
} as const;

function normalizeBaseUrl(value: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const url = new URL(withProtocol);
    return url.origin.replace(/\/+$/g, "");
  } catch {
    return null;
  }
}

export function getEmailTrackingBaseUrl(): string {
  return (
    normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL) ??
    normalizeBaseUrl(process.env.APP_URL) ??
    normalizeBaseUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
    normalizeBaseUrl(process.env.VERCEL_URL) ??
    LOCAL_APP_URL
  );
}

function getTrackingSecret(): string {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_SECRET es obligatorio para firmar tracking de email.",
    );
  }
  return "nexo-crm-email-tracking-dev-secret";
}

function signTargetUrl(trackingId: string, targetUrl: string): string {
  return createHmac("sha256", getTrackingSecret())
    .update(trackingId)
    .update("\0")
    .update(targetUrl)
    .digest("base64url");
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function encodeTargetUrl(targetUrl: string): string {
  return Buffer.from(targetUrl, "utf8").toString("base64url");
}

function decodeTargetUrl(value: string): string | null {
  try {
    return Buffer.from(value, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

function isTrackableUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function createTrackedClickUrl(
  trackingId: string,
  targetUrl: string,
): string {
  if (!isTrackableUrl(targetUrl)) return targetUrl;
  const baseUrl = getEmailTrackingBaseUrl();
  const encodedTarget = encodeTargetUrl(targetUrl);
  const signature = signTargetUrl(trackingId, targetUrl);
  const url = new URL(`/api/email/track/click/${trackingId}`, baseUrl);
  url.searchParams.set("u", encodedTarget);
  url.searchParams.set("s", signature);
  return url.toString();
}

export function verifyTrackedClickUrl(
  trackingId: string,
  encodedTarget: string | null,
  signature: string | null,
): string | null {
  if (!encodedTarget || !signature) return null;
  const targetUrl = decodeTargetUrl(encodedTarget);
  if (!targetUrl || !isTrackableUrl(targetUrl)) return null;
  const expected = signTargetUrl(trackingId, targetUrl);
  return constantTimeEqual(signature, expected) ? targetUrl : null;
}

export function instrumentEmailHtml(input: {
  bodyHtml: string | null;
  bodyText: string | null;
  trackingId: string;
}): string | null {
  const sourceHtml =
    input.bodyHtml?.trim() ||
    (input.bodyText?.trim() ? textToHtml(input.bodyText) : "");
  if (!sourceHtml) return null;

  const html = sanitizeEmailHtml(sourceHtml, {
    transformHref: (href) => createTrackedClickUrl(input.trackingId, href),
  });
  const openUrl = new URL(
    `/api/email/track/open/${input.trackingId}`,
    getEmailTrackingBaseUrl(),
  ).toString();
  const pixel = `<img src="${escapeHtml(
    openUrl,
  )}" width="1" height="1" alt="" style="display:none!important;opacity:0;width:1px;height:1px;border:0;" />`;

  return `${html}\n${pixel}`;
}

function clientIp(request: Request): string | null {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    null
  );
}

function userAgent(request: Request): string | null {
  return request.headers.get("user-agent")?.slice(0, 1000) ?? null;
}

async function getTrackedMessage(trackingId: string) {
  const [message] = await db
    .select({
      clickedAt: emailMessages.clickedAt,
      id: emailMessages.id,
      mailboxId: emailMessages.mailboxId,
      openedAt: emailMessages.openedAt,
      ownerId: emailMessages.ownerId,
      toRecipients: emailMessages.toRecipients,
    })
    .from(emailMessages)
    .where(eq(emailMessages.trackingId, trackingId))
    .limit(1);
  return message ?? null;
}

function primaryRecipient(
  recipients: { email: string; name?: string | null }[],
): string | null {
  return recipients[0]?.email ?? null;
}

export async function recordEmailOpen(
  trackingId: string,
  request: Request,
): Promise<boolean> {
  const message = await getTrackedMessage(trackingId);
  if (!message) return false;

  const now = new Date();
  await db
    .update(emailMessages)
    .set({
      openedAt: message.openedAt ?? now,
      openCount: sql`${emailMessages.openCount} + 1`,
    })
    .where(eq(emailMessages.id, message.id));

  await db.insert(emailEvents).values({
    ipAddress: clientIp(request),
    mailboxId: message.mailboxId,
    messageId: message.id,
    meta: { source: "pixel" },
    occurredAt: now,
    ownerId: message.ownerId,
    provider: "gmail",
    recipientEmail: primaryRecipient(message.toRecipients),
    trackingId,
    type: "open",
    userAgent: userAgent(request),
  });

  return true;
}

export async function recordEmailClick(input: {
  request: Request;
  targetUrl: string;
  trackingId: string;
}): Promise<boolean> {
  const message = await getTrackedMessage(input.trackingId);
  if (!message) return false;

  const now = new Date();
  await db
    .update(emailMessages)
    .set({
      clickedAt: message.clickedAt ?? now,
      clickCount: sql`${emailMessages.clickCount} + 1`,
    })
    .where(eq(emailMessages.id, message.id));

  await db.insert(emailEvents).values({
    ipAddress: clientIp(input.request),
    mailboxId: message.mailboxId,
    messageId: message.id,
    meta: { source: "redirect" },
    occurredAt: now,
    ownerId: message.ownerId,
    provider: "gmail",
    recipientEmail: primaryRecipient(message.toRecipients),
    trackingId: input.trackingId,
    type: "click",
    url: input.targetUrl,
    userAgent: userAgent(input.request),
  });

  return true;
}
