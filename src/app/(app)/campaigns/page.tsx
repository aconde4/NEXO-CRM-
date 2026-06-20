import type { Metadata } from "next";

import { buildMergeCatalog } from "@/lib/email/merge-tags";
import { CampaignsView } from "@/components/campaigns/campaigns-view";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/session";
import { listAllCustomFieldDefs } from "@/server/queries/custom-fields";
import {
  getCampaignComposerDefaults,
  listCampaigns,
} from "@/server/queries/campaigns";
import { countSegmentAudience, listSegments } from "@/server/queries/segments";

export const metadata: Metadata = { title: "Campañas" };

export default async function CampaignsPage() {
  const user = await requireUser();
  const [campaigns, segments, defs, defaults] = await Promise.all([
    listCampaigns(),
    listSegments(),
    listAllCustomFieldDefs(),
    getCampaignComposerDefaults(),
  ]);

  const segmentOptions = await Promise.all(
    segments.map(async (segment) => ({
      id: segment.id,
      name: segment.name,
      audience: await countSegmentAudience(segment.definition),
    })),
  );

  return (
    <>
      <PageHeader
        title="Campañas"
        description="Borradores de email masivo para segmentos, con bloques React Email y envío de prueba."
      />
      <CampaignsView
        campaigns={campaigns}
        segments={segmentOptions}
        defaults={defaults}
        catalog={buildMergeCatalog(defs.person, defs.organization, true)}
        testEmail={user.email ?? ""}
      />
    </>
  );
}
