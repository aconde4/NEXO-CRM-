"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  FileText,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { formatBytes, relativeDate } from "@/lib/format";
import { deleteAttachment } from "@/server/actions/files";
import type { FileItem } from "@/server/queries/files";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function iconFor(mime: string | null) {
  if (mime?.startsWith("image/")) return ImageIcon;
  return FileText;
}

export function AttachmentsPanel({
  entityType,
  entityId,
  files,
  storageEnabled,
}: {
  entityType: "person" | "organization";
  entityId: string;
  files: FileItem[];
  storageEnabled: boolean;
}) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [deleting, setDeleting] = React.useState<FileItem | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("entityType", entityType);
      body.append("entityId", entityId);
      const res = await fetch("/api/attachments", { method: "POST", body });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "No se pudo subir el archivo");
      }
      toast.success("Archivo subido");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo subir el archivo",
      );
    } finally {
      setUploading(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      await deleteAttachment(deleting.id);
      toast.success("Adjunto eliminado");
      setDeleting(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Paperclip className="text-muted-foreground size-4" />
          Archivos
          {files.length ? (
            <span className="text-muted-foreground text-sm font-normal">
              ({files.length})
            </span>
          ) : null}
        </CardTitle>
        {storageEnabled ? (
          <CardAction>
            <input
              ref={inputRef}
              type="file"
              className="sr-only"
              onChange={onPick}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Upload />
              )}
              {uploading ? "Subiendo…" : "Subir"}
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="px-0">
        {!storageEnabled ? (
          <p className="text-muted-foreground px-6 py-6 text-center text-sm">
            El almacenamiento de archivos no está configurado. Consulta{" "}
            <code>docs/SETUP.md</code> para activarlo.
          </p>
        ) : files.length === 0 ? (
          <p className="text-muted-foreground px-6 py-6 text-center text-sm">
            Aún no hay archivos adjuntos.
          </p>
        ) : (
          <div className="divide-y">
            {files.map((file) => {
              const Icon = iconFor(file.mime);
              return (
                <div
                  key={file.id}
                  className="group hover:bg-muted/30 flex items-center gap-3 px-6 py-2.5 transition-colors"
                >
                  <Icon className="text-muted-foreground size-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <a
                      href={`/api/attachments/${file.id}`}
                      className="hover:text-foreground block truncate text-sm font-medium underline-offset-2 hover:underline"
                    >
                      {file.name}
                    </a>
                    <p className="text-muted-foreground text-xs">
                      {formatBytes(file.size)} · {relativeDate(file.createdAt)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Descargar"
                    render={<a href={`/api/attachments/${file.id}`} />}
                  >
                    <Download className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Eliminar"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleting(file)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={Boolean(deleting)} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>¿Eliminar el archivo?</DialogTitle>
            <DialogDescription>
              Se eliminará{" "}
              <span className="text-foreground font-medium">
                {deleting?.name}
              </span>
              . Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Eliminando…" : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
