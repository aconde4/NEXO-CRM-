import type { Metadata } from "next";

import { buildMergeCatalog } from "@/lib/email/merge-tags";
import { CampaignsView } from "@/components/campaigns/campaigns-view";
import { DeliverabilityAuditPanel } from "@/components/campaigns/deliverability-audit";
import { ResendChecklist } from "@/components/campaigns/resend-checklist";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/session";
import { listAllCustomFieldDefs } from "@/server/queries/custom-fields";
import {
  getCampaignComposerDefaults,
  getDeliverabilityAudit,
  listCampaigns,
} from "@/server/queries/campaigns";
import { countSegmentAudience, listSegments } from "@/server/queries/segments";

export const metadata: Metadata = { title: "Campañas" };

export default async function CampaignsPage() {
  const user = await requireUser();
  const [campaigns, segments, defs, defaults, audit] = await Promise.all([
    listCampaigns(),
    listSegments(),
    listAllCustomFieldDefs(),
    getCampaignComposerDefaults(),
    getDeliverabilityAudit(),
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
      <ResendChecklist readiness={audit.resend} />
      <DeliverabilityAuditPanel audit={audit} />
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
