import "server-only";

import { and, desc, eq } from "drizzle-orm";

import type { CampaignEmailBlock } from "@/lib/campaign-blocks";
import { campaignEmailBlocksSchema } from "@/lib/validations/campaign";
import { requireUser } from "@/lib/session";
import { db } from "@/server/db";
import { campaigns, segments } from "@/server/db/schema";
import { isResendConfigured } from "@/server/services/resend";

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
  updatedAt: string;
  createdAt: string;
};

export type CampaignComposerDefaults = {
  fromName: string;
  fromEmail: string;
  resendConfigured: boolean;
};

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
      settings: campaigns.settings,
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
    updatedAt: row.updatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function getCampaignComposerDefaults(): Promise<CampaignComposerDefaults> {
  await requireUser();
  return {
    fromName: cleanEnv(process.env.CAMPAIGN_FROM_NAME),
    fromEmail: cleanEnv(process.env.CAMPAIGN_FROM_EMAIL),
    resendConfigured: isResendConfigured(),
  };
}
