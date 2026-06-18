import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { listCustomFieldDefs } from "@/server/queries/custom-fields";
import { ImportWizard } from "@/components/contacts/import-wizard";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Importar contactos" };

export default async function ImportContactsPage() {
  const customFieldDefs = await listCustomFieldDefs("person");

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" render={<Link href="/contacts" />}>
          <ArrowLeft />
        </Button>
        <span className="text-muted-foreground text-sm">Contactos</span>
      </div>

      <PageHeader
        title="Importar contactos"
        description="Sube un CSV o Excel, asigna las columnas y revisa antes de importar."
      />

      <ImportWizard customFieldDefs={customFieldDefs} />
    </>
  );
}
