import type { Metadata } from "next";

import { QuotesView } from "@/components/quotes/quotes-view";
import { PageHeader } from "@/components/page-header";
import { listQuotes } from "@/server/queries/quotes";

export const metadata: Metadata = { title: "Presupuestos" };

export default async function QuotesPage() {
  const quotes = await listQuotes();
  return (
    <>
      <PageHeader
        title="Presupuestos"
        description="Crea presupuestos con líneas de producto y expórtalos en PDF."
      />
      <QuotesView quotes={quotes} />
    </>
  );
}
