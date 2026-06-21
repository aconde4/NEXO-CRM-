import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/server/db";
import {
  type CampaignRecipientStatus,
  type CampaignStats,
  campaignRecipients,
  campaigns,
} from "@/server/db/schema";

const EXACT_STATUSES = [
  "delivered",
  "opened",
  "clicked",
  "bounced",
  "complained",
  "unsubscribed",
  "suppressed",
  "failed",
] as const satisfies readonly (keyof CampaignStats & CampaignRecipientStatus)[];

const SENT_LIKE_STATUSES = [
  "sent",
  "delivered",
  "opened",
  "clicked",
  "bounced",
  "complained",
  "unsubscribed",
] as const satisfies readonly CampaignRecipientStatus[];

export async function refreshCampaignStats(
  campaignId: string,
  ownerId: string,
): Promise<CampaignStats> {
  const [audience, sent, ...counts] = await Promise.all([
    db.$count(
      campaignRecipients,
      and(
        eq(campaignRecipients.campaignId, campaignId),
        eq(campaignRecipients.ownerId, ownerId),
      ),
    ),
    db.$count(
      campaignRecipients,
      and(
        eq(campaignRecipients.campaignId, campaignId),
        eq(campaignRecipients.ownerId, ownerId),
        inArray(campaignRecipients.status, SENT_LIKE_STATUSES),
      ),
    ),
    ...EXACT_STATUSES.map((status) =>
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

  const stats: CampaignStats = { audience, sent };
  EXACT_STATUSES.forEach((status, index) => {
    stats[status] = counts[index] ?? 0;
  });

  await db
    .update(campaigns)
    .set({ stats, updatedAt: new Date() })
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.ownerId, ownerId)));

  return stats;
}
