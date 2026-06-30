"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Printer, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { formatMoney } from "@/lib/format";
import { QUOTE_STATUSES, computeQuoteTotals } from "@/lib/quotes";
import { saveQuote } from "@/server/actions/quotes";
import type {
  QuoteEditorData,
  QuoteEditorItem,
} from "@/server/queries/quotes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const selectClass =
  "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none transition focus-visible:ring-[3px]";

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function QuoteEditor({ data }: { data: QuoteEditorData }) {
  const router = useRouter();
  const [title, setTitle] = React.useState(data.quote.title);
  const [dealId, setDealId] = React.useState(data.quote.dealId ?? "");
  const [status, setStatus] = React.useState(data.quote.status);
  const [taxRate, setTaxRate] = React.useState(String(data.quote.taxRate));
  const [notes, setNotes] = React.useState(data.quote.notes);
  const [items, setItems] = React.useState<QuoteEditorItem[]>(data.items);
  const [busy, setBusy] = React.useState(false);

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        description: "",
        id: newId(),
        name: "",
        productId: null,
        quantity: 1,
        unitPrice: 0,
      },
    ]);
  }
  function update(id: string, patch: Partial<QuoteEditorItem>) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }
  function remove(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }
  function pickProduct(id: string, productId: string) {
    const product = data.productOptions.find((p) => p.id === productId);
    update(
      id,
      product
        ? { name: product.name, productId, unitPrice: product.unitPrice }
        : { productId: null },
    );
  }

  const totals = computeQuoteTotals(
    items.map((i) => ({
      quantity: Number(i.quantity) || 0,
      unitPrice: Number(i.unitPrice) || 0,
    })),
    Number(taxRate) || 0,
  );

  async function save() {
    setBusy(true);
    try {
      await saveQuote({
        dealId,
        id: data.quote.id,
        items: items
          .filter((i) => i.name.trim())
          .map((i) => ({
            description: i.description,
            name: i.name,
            productId: i.productId,
            quantity: Number(i.quantity) || 0,
            unitPrice: Number(i.unitPrice) || 0,
          })),
        notes,
        status,
        taxRate: Number(taxRate) || 0,
        title,
      });
      toast.success("Presupuesto guardado");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          Presupuesto Nº {data.quote.seq}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            render={
              <Link href={`/print/quote/${data.quote.id}`} target="_blank" />
            }
          >
            <Printer />
            Imprimir / PDF
          </Button>
          <Button onClick={save} disabled={busy}>
            <Save />
            {busy ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="grid gap-1.5 sm:col-span-2">
          <Label>Título</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label>Negocio</Label>
          <select
            className={selectClass}
            value={dealId}
            onChange={(e) => setDealId(e.target.value)}
          >
            <option value="">Sin vincular</option>
            {data.dealOptions.map((deal) => (
              <option key={deal.id} value={deal.id}>
                {deal.title}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label>Estado</Label>
          <select
            className={selectClass}
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as QuoteEditorData["quote"]["status"])
            }
          >
            {QUOTE_STATUSES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground border-b text-left text-xs">
            <tr>
              <th className="px-3 py-2 font-medium">Concepto</th>
              <th className="w-20 px-3 py-2 text-right font-medium">Cantidad</th>
              <th className="w-28 px-3 py-2 text-right font-medium">Precio</th>
              <th className="w-28 px-3 py-2 text-right font-medium">Total</th>
              <th className="w-10 px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="text-muted-foreground px-3 py-6 text-center text-sm"
                >
                  Añade líneas al presupuesto.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="align-top">
                  <td className="px-3 py-2">
                    <div className="grid gap-1.5">
                      {data.productOptions.length > 0 ? (
                        <select
                          className={selectClass}
                          value={item.productId ?? ""}
                          onChange={(e) => pickProduct(item.id, e.target.value)}
                        >
                          <option value="">Concepto libre</option>
                          {data.productOptions.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name}
                            </option>
                          ))}
                        </select>
                      ) : null}
                      <Input
                        value={item.name}
                        placeholder="Concepto"
                        onChange={(e) =>
                          update(item.id, { name: e.target.value })
                        }
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      className="text-right"
                      value={item.quantity}
                      onChange={(e) =>
                        update(item.id, { quantity: Number(e.target.value) })
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      className="text-right"
                      value={item.unitPrice}
                      onChange={(e) =>
                        update(item.id, { unitPrice: Number(e.target.value) })
                      }
                    />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatMoney(
                      Math.round(
                        (Number(item.quantity) || 0) *
                          (Number(item.unitPrice) || 0),
                      ),
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Quitar línea"
                      onClick={() => remove(item.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="border-t p-3">
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus />
            Añadir línea
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>Notas</Label>
          <Textarea
            value={notes}
            rows={4}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Condiciones, validez de la oferta…"
          />
        </div>
        <div className="grid content-start gap-2 rounded-xl border p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">
              {formatMoney(Math.round(totals.subtotal))}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground flex items-center gap-2">
              Impuesto
              <Input
                type="number"
                min={0}
                max={100}
                step="0.5"
                className="h-7 w-16 text-right"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
              />
              %
            </span>
            <span className="tabular-nums">
              {formatMoney(Math.round(totals.tax))}
            </span>
          </div>
          <div className="flex items-center justify-between border-t pt-2 font-semibold">
            <span>Total</span>
            <span className="tabular-nums">
              {formatMoney(Math.round(totals.total))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
