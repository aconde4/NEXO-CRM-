import type { Metadata } from "next";

import { listAllCustomFieldDefs } from "@/server/queries/custom-fields";
import { listPipelinesWithStages } from "@/server/queries/deals";
import { CustomFieldsManager } from "@/components/custom-fields/custom-fields-manager";
import { PipelinesManager } from "@/components/deals/pipelines-manager";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Ajustes" };

export default async function SettingsPage() {
  const [defs, pipelines] = await Promise.all([
    listAllCustomFieldDefs(),
    listPipelinesWithStages(),
  ]);

  return (
    <>
      <PageHeader
        title="Ajustes"
        description="Configura tus embudos y los campos personalizados."
      />
      <PipelinesManager pipelines={pipelines} />
      <CustomFieldsManager
        personDefs={defs.person}
        organizationDefs={defs.organization}
      />
    </>
  );
}
