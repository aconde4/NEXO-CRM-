"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  FileText,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { formatDateTime } from "@/lib/format";
import {
  deleteDocument,
  saveDocument,
  sendDocument,
} from "@/server/actions/documents";
import type { DocumentListItem } from "@/server/queries/documents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const selectClass =
  "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none transition focus-visible:ring-[3px]";

const STATUS: Record<
  DocumentListItem["status"],
  { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }
> = {
  draft: { label: "Borrador", variant: "secondary" },
  sent: { label: "Pendiente de firma", variant: "default" },
  signed: { label: "Firmado", variant: "outline" },
};

export function DocumentsView({
  documents,
  dealOptions,
}: {
  documents: DocumentListItem[];
  dealOptions: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [dialog, setDialog] = React.useState<{
    doc: DocumentListItem | null;
  } | null>(null);

  async function copyLink(doc: DocumentListItem) {
    try {
      const result = await sendDocument(doc.id);
      const url = `${window.location.origin}/sign/${result.token}`;
      await navigator.clipboard?.writeText(url).catch(() => {});
      toast.success("Enlace de firma copiado al portapapeles");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo generar el enlace",
      );
    }
  }

  async function remove(doc: DocumentListItem) {
    try {
      await deleteDocument(doc.id);
      toast.success("Documento eliminado");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo eliminar",
      );
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialog({ doc: null })}>
          <Plus />
          Nuevo documento
        </Button>
      </div>

      {documents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="bg-muted flex size-12 items-center justify-center rounded-full">
              <FileText className="text-muted-foreground size-6" />
            </div>
            <div>
              <p className="text-sm font-medium">Aún no tienes documentos</p>
              <p className="text-muted-foreground text-sm">
                Redacta un documento, genera un enlace y recíbelo firmado.
              </p>
            </div>
            <Button variant="outline" onClick={() => setDialog({ doc: null })}>
              <Plus />
              Crear el primero
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {documents.map((doc) => (
            <Card key={doc.id} className="gap-0 py-0">
              <CardContent className="flex flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{doc.title}</p>
                    <p className="text-muted-foreground text-xs">
                      {doc.dealTitle ? `${doc.dealTitle} · ` : ""}
                      {formatDateTime(doc.createdAt)}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Acciones"
                        />
                      }
                    >
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => copyLink(doc)}>
                        <Copy />
                        {doc.token ? "Copiar enlace" : "Enviar para firmar"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDialog({ doc })}>
                        <Pencil />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => remove(doc)}
                      >
                        <Trash2 />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={STATUS[doc.status].variant}>
                    {STATUS[doc.status].label}
                  </Badge>
                  {doc.status === "signed" && doc.signerName ? (
                    <span className="text-muted-foreground text-xs">
                      por {doc.signerName}
                      {doc.signedAt ? ` · ${formatDateTime(doc.signedAt)}` : ""}
                    </span>
                  ) : doc.signerEmail ? (
                    <span className="text-muted-foreground text-xs">
                      para {doc.signerEmail}
                    </span>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {dialog ? (
        <DocumentDialog
          key={dialog.doc?.id ?? "new-document"}
          doc={dialog.doc}
          dealOptions={dealOptions}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  );
}

function DocumentDialog({
  doc,
  dealOptions,
  onClose,
}: {
  doc: DocumentListItem | null;
  dealOptions: { id: string; title: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = React.useState(doc?.title ?? "");
  const [body, setBody] = React.useState(doc?.body ?? "");
  const [dealId, setDealId] = React.useState(doc?.dealId ?? "");
  const [signerEmail, setSignerEmail] = React.useState(doc?.signerEmail ?? "");
  const [busy, setBusy] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      toast.error("Ponle un título al documento.");
      return;
    }
    setBusy(true);
    try {
      await saveDocument({ body, dealId, id: doc?.id, signerEmail, title });
      toast.success(doc ? "Documento actualizado" : "Documento creado");
      onClose();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo guardar",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>
              {doc ? "Editar documento" : "Nuevo documento"}
            </DialogTitle>
            <DialogDescription>
              Redacta el contenido; luego genera el enlace para que lo firmen.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-1.5">
            <Label>Título</Label>
            <Input
              value={title}
              maxLength={200}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Propuesta de servicios"
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Contenido</Label>
            <Textarea
              value={body}
              rows={8}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Texto del documento que firmará el cliente…"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Negocio (opcional)</Label>
              <select
                className={selectClass}
                value={dealId}
                onChange={(event) => setDealId(event.target.value)}
              >
                <option value="">Sin vincular</option>
                {dealOptions.map((deal) => (
                  <option key={deal.id} value={deal.id}>
                    {deal.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label>Email del firmante (opcional)</Label>
              <Input
                type="email"
                value={signerEmail}
                onChange={(event) => setSignerEmail(event.target.value)}
                placeholder="cliente@empresa.com"
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={busy}>
              {busy ? "Guardando…" : doc ? "Guardar" : "Crear documento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
