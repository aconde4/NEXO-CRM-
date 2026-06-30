"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Package, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { formatMoney } from "@/lib/format";
import { deleteProduct, saveProduct } from "@/server/actions/quotes";
import type { ProductListItem } from "@/server/queries/quotes";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ProductsView({ products }: { products: ProductListItem[] }) {
  const [dialog, setDialog] = React.useState<{
    product: ProductListItem | null;
  } | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialog({ product: null })}>
          <Plus />
          Nuevo producto
        </Button>
      </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="bg-muted flex size-12 items-center justify-center rounded-full">
              <Package className="text-muted-foreground size-6" />
            </div>
            <p className="text-muted-foreground text-sm">
              Crea tu catálogo de productos o servicios para reutilizarlos en
              los presupuestos.
            </p>
            <Button variant="outline" onClick={() => setDialog({ product: null })}>
              <Plus />
              Crear el primero
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <Card key={product.id} className="gap-0 py-0">
              <CardContent className="flex items-start justify-between gap-2 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{product.name}</p>
                  {product.description ? (
                    <p className="text-muted-foreground line-clamp-2 text-xs">
                      {product.description}
                    </p>
                  ) : null}
                  <p className="mt-1 text-sm font-semibold tabular-nums">
                    {formatMoney(product.unitPrice)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Editar producto"
                  onClick={() => setDialog({ product })}
                >
                  <Pencil className="size-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {dialog ? (
        <ProductDialog
          key={dialog.product?.id ?? "new-product"}
          product={dialog.product}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  );
}

function ProductDialog({
  product,
  onClose,
}: {
  product: ProductListItem | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = React.useState(product?.name ?? "");
  const [price, setPrice] = React.useState(
    product ? String(product.unitPrice) : "",
  );
  const [description, setDescription] = React.useState(
    product?.description ?? "",
  );
  const [busy, setBusy] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      toast.error("Ponle un nombre al producto.");
      return;
    }
    setBusy(true);
    try {
      await saveProduct({
        description,
        id: product?.id,
        name,
        unitPrice: Number(price.replace(",", ".")) || 0,
      });
      toast.success(product ? "Producto actualizado" : "Producto creado");
      onClose();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!product) return;
    setBusy(true);
    try {
      await deleteProduct(product.id);
      toast.success("Producto eliminado");
      onClose();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>
              {product ? "Editar producto" : "Nuevo producto"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label>Nombre</Label>
            <Input
              value={name}
              maxLength={200}
              onChange={(e) => setName(e.target.value)}
              placeholder="Consultoría (hora)"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Precio unitario (€)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="100"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Descripción (opcional)</Label>
            <Textarea
              value={description}
              rows={2}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <DialogFooter className="sm:justify-between">
            {product ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={busy}
                onClick={remove}
              >
                <Trash2 />
                Eliminar
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <DialogClose render={<Button type="button" variant="outline" />}>
                Cancelar
              </DialogClose>
              <Button type="submit" disabled={busy}>
                {busy ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
