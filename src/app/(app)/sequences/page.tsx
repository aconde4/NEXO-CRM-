import type { Metadata } from "next";

import { buildMergeCatalog } from "@/lib/email/merge-tags";
import { PageHeader } from "@/components/page-header";
import { SequencesView } from "@/components/sequences/sequences-view";
import { listAllCustomFieldDefs } from "@/server/queries/custom-fields";
import { listEmailTemplates } from "@/server/queries/email-templates";
import { listSequences } from "@/server/queries/sequences";

export const metadata: Metadata = { title: "Secuencias" };

export default async function SequencesPage() {
  const [sequences, templates, defs] = await Promise.all([
    listSequences(),
    listEmailTemplates(),
    listAllCustomFieldDefs(),
  ]);

  return (
    <>
      <PageHeader
        title="Secuencias"
        description="Flujos multi-paso con emails, esperas, condiciones, tareas y parada automática al responder."
      />
      <SequencesView
        sequences={sequences}
        templates={templates}
        catalog={buildMergeCatalog(defs.person, defs.organization, true)}
      />
    </>
  );
}
