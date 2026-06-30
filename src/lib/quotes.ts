import type { QuoteStatus } from "@/server/db/schema";

export const QUOTE_STATUSES: { value: QuoteStatus; label: string }[] = [
  { label: "Borrador", value: "draft" },
  { label: "Enviado", value: "sent" },
  { label: "Aceptado", value: "accepted" },
  { label: "Rechazado", value: "rejected" },
];

export function quoteStatusLabel(status: QuoteStatus): string {
  return QUOTE_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export type QuoteLine = { quantity: number; unitPrice: number };
export type QuoteTotals = { subtotal: number; tax: number; total: number };

/** Totales del presupuesto (puro): subtotal de líneas + impuesto (% sobre subtotal). */
export function computeQuoteTotals(
  items: QuoteLine[],
  taxRate: number,
): QuoteTotals {
  const subtotal = items.reduce(
    (sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0),
    0,
  );
  const tax = (subtotal * (taxRate || 0)) / 100;
  return { subtotal, tax, total: subtotal + tax };
}
