import type { Metadata } from "next";

import { listForms } from "@/server/queries/forms";
import { FormsView } from "@/components/forms/forms-view";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Formularios" };

export default async function FormsPage() {
  const forms = await listForms();

  return (
    <>
      <PageHeader
        title="Formularios"
        description="Formularios web embebibles que captan leads directamente en el CRM."
      />
      <FormsView forms={forms} />
    </>
  );
}
