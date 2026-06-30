import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { formatDate, formatMoney } from "@/lib/format";
import { computeQuoteTotals } from "@/lib/quotes";
import { getQuotePrint } from "@/server/queries/quotes";
import { PrintButton } from "@/components/quotes/print-button";

export const metadata: Metadata = { title: "Presupuesto" };

export default async function QuotePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getQuotePrint(id);
  if (!data) notFound();

  const { quote, items } = data;
  const totals = computeQuoteTotals(items, quote.taxRate);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10 print:py-0">
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>
      <article className="bg-card rounded-xl border p-8 print:border-0 print:p-0">
        <header className="flex items-start justify-between gap-4 border-b pb-4">
          <div>
            <p className="text-lg font-semibold">
              {quote.ownerName ?? "Presupuesto"}
            </p>
            <p className="text-muted-foreground text-sm">
              Presupuesto Nº {quote.seq}
            </p>
          </div>
          <div className="text-muted-foreground text-right text-sm">
            <p>{formatDate(quote.createdAt)}</p>
            {quote.dealTitle ? <p>{quote.dealTitle}</p> : null}
          </div>
        </header>

        <h1 className="mt-4 text-xl font-semibold">{quote.title}</h1>

        <table className="mt-4 w-full text-sm">
          <thead className="text-muted-foreground border-b text-left">
            <tr>
              <th className="py-2 font-medium">Concepto</th>
              <th className="py-2 text-right font-medium">Cant.</th>
              <th className="py-2 text-right font-medium">Precio</th>
              <th className="py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="text-muted-foreground py-6 text-center"
                >
                  Sin líneas.
                </td>
              </tr>
            ) : (
              items.map((item, index) => (
                <tr key={index}>
                  <td className="py-2">
                    <p className="font-medium">{item.name}</p>
                    {item.description ? (
                      <p className="text-muted-foreground text-xs">
                        {item.description}
                      </p>
                    ) : null}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {item.quantity}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {formatMoney(item.unitPrice)}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {formatMoney(Math.round(item.quantity * item.unitPrice))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="mt-4 ml-auto w-64 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">
              {formatMoney(Math.round(totals.subtotal))}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              Impuesto ({quote.taxRate}%)
            </span>
            <span className="tabular-nums">
              {formatMoney(Math.round(totals.tax))}
            </span>
          </div>
          <div className="flex justify-between border-t pt-1 font-semibold">
            <span>Total</span>
            <span className="tabular-nums">
              {formatMoney(Math.round(totals.total))}
            </span>
          </div>
        </div>

        {quote.notes ? (
          <div className="mt-6 border-t pt-4 text-sm">
            <p className="text-muted-foreground whitespace-pre-wrap">
              {quote.notes}
            </p>
          </div>
        ) : null}
      </article>
    </main>
  );
}
