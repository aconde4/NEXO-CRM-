import type { Metadata } from "next";

import { buildMergeCatalog } from "@/lib/email/merge-tags";
import { listAllCustomFieldDefs } from "@/server/queries/custom-fields";
import { listPipelinesWithStages } from "@/server/queries/deals";
import { listEmailTemplates } from "@/server/queries/email-templates";
import { CustomFieldsManager } from "@/components/custom-fields/custom-fields-manager";
import { PipelinesManager } from "@/components/deals/pipelines-manager";
import { EmailTemplatesManager } from "@/components/email/email-templates-manager";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Ajustes" };

export default async function SettingsPage() {
  const [defs, pipelines, emailTemplates] = await Promise.all([
    listAllCustomFieldDefs(),
    listPipelinesWithStages(),
    listEmailTemplates(),
  ]);

  return (
    <>
      <PageHeader
        title="Ajustes"
        description="Configura tus embudos, plantillas y campos personalizados."
      />
      <PipelinesManager pipelines={pipelines} />
      <EmailTemplatesManager
        templates={emailTemplates}
        catalog={buildMergeCatalog(defs.person, defs.organization, true)}
      />
      <CustomFieldsManager
        personDefs={defs.person}
        organizationDefs={defs.organization}
      />
    </>
  );
}
