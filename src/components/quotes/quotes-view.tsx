"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { formatMoney } from "@/lib/format";
import { quoteStatusLabel } from "@/lib/quotes";
import { createQuote, deleteQuote } from "@/server/actions/quotes";
import type { QuoteListItem } from "@/server/queries/quotes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function QuotesView({ quotes }: { quotes: QuoteListItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function create() {
    setBusy(true);
    try {
      const result = await createQuote();
      if (result.id) router.push(`/quotes/${result.id}`);
    } catch {
      toast.error("No se pudo crear el presupuesto");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await deleteQuote(id);
      toast.success("Presupuesto eliminado");
      router.refresh();
    } catch {
      toast.error("No se pudo eliminar");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={create} disabled={busy}>
          <Plus />
          Nuevo presupuesto
        </Button>
      </div>

      {quotes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="bg-muted flex size-12 items-center justify-center rounded-full">
              <FileSpreadsheet className="text-muted-foreground size-6" />
            </div>
            <p className="text-muted-foreground text-sm">
              Crea presupuestos con líneas de producto y expórtalos en PDF.
            </p>
            <Button variant="outline" onClick={create} disabled={busy}>
              <Plus />
              Crear el primero
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="divide-y overflow-hidden rounded-xl border">
          {quotes.map((quote) => (
            <div key={quote.id} className="flex items-center gap-3 px-4 py-3">
              <Link
                href={`/quotes/${quote.id}`}
                className="min-w-0 flex-1 hover:underline"
              >
                <p className="truncate text-sm font-medium">
                  Nº {quote.seq} · {quote.title}
                </p>
                <p className="text-muted-foreground text-xs">
                  {quote.dealTitle ? `${quote.dealTitle} · ` : ""}
                  {new Date(quote.createdAt).toLocaleDateString("es-ES")}
                </p>
              </Link>
              <Badge variant="outline">{quoteStatusLabel(quote.status)}</Badge>
              <span className="w-28 text-right text-sm font-semibold tabular-nums">
                {formatMoney(Math.round(quote.total))}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Eliminar presupuesto"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => remove(quote.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
