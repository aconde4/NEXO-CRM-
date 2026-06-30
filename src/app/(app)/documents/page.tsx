import type { Metadata } from "next";

import { DocumentsView } from "@/components/documents/documents-view";
import { PageHeader } from "@/components/page-header";
import {
  listDealOptionsForDocuments,
  listDocuments,
} from "@/server/queries/documents";

export const metadata: Metadata = { title: "Documentos" };

export default async function DocumentsPage() {
  const [documents, dealOptions] = await Promise.all([
    listDocuments(),
    listDealOptionsForDocuments(),
  ]);

  return (
    <>
      <PageHeader
        title="Documentos"
        description="Redacta documentos y recíbelos firmados con un enlace público."
      />
      <DocumentsView documents={documents} dealOptions={dealOptions} />
    </>
  );
}
