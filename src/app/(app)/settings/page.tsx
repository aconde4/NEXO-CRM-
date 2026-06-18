import type { Metadata } from "next";

import { listAllCustomFieldDefs } from "@/server/queries/custom-fields";
import { CustomFieldsManager } from "@/components/custom-fields/custom-fields-manager";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Ajustes" };

export default async function SettingsPage() {
  const defs = await listAllCustomFieldDefs();

  return (
    <>
      <PageHeader
        title="Ajustes"
        description="Configura los campos personalizados de tus contactos y empresas."
      />
      <CustomFieldsManager
        personDefs={defs.person}
        organizationDefs={defs.organization}
      />
    </>
  );
}
