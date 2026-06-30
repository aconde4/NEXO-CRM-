import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getQuote } from "@/server/queries/quotes";
import { QuoteEditor } from "@/components/quotes/quote-editor";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Presupuesto" };

export default async function QuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getQuote(id);
  if (!data) notFound();

  return (
    <>
      <PageHeader
        title={data.quote.title || "Presupuesto"}
        description={`Presupuesto Nº ${data.quote.seq}`}
      />
      <QuoteEditor data={data} />
    </>
  );
}
