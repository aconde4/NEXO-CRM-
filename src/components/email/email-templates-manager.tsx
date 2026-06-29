"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  SALES_EMAIL_TEMPLATES,
  SALES_TEMPLATE_CATEGORY,
} from "@/lib/email/sales-templates";
import type { MergeTag } from "@/lib/email/merge-tags";
import {
  createEmailTemplate,
  deleteEmailTemplate,
  installSalesEmailTemplates,
  updateEmailTemplate,
} from "@/server/actions/email-templates";
import type { EmailTemplateItem } from "@/server/queries/email-templates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MergeTagMenu } from "@/components/email/merge-tag-menu";
import {
  RichEmailEditor,
  type RichEmailEditorHandle,
  type RichEmailEditorValue,
} from "@/components/email/rich-email-editor";

type DialogState =
  | { mode: "create"; template: null }
  | { mode: "edit"; template: EmailTemplateItem };

function insertIntoInput(
  input: HTMLInputElement | null,
  value: string,
  token: string,
  setValue: (value: string) => void,
) {
  const start = input?.selectionStart ?? value.length;
  const end = input?.selectionEnd ?? start;
  const next = value.slice(0, start) + token + value.slice(end);
  setValue(next);
  requestAnimationFrame(() => {
    input?.focus();
    const pos = start + token.length;
    input?.setSelectionRange(pos, pos);
  });
}

function htmlHasContent(value: string): boolean {
  return value.replace(/<[^>]*>/g, "").trim().length > 0;
}

export function EmailTemplatesManager({
  templates,
  catalog,
}: {
  templates: EmailTemplateItem[];
  catalog: MergeTag[];
}) {
  const router = useRouter();
  const [dialog, setDialog] = React.useState<DialogState | null>(null);
  const [deleting, setDeleting] = React.useState<EmailTemplateItem | null>(
    null,
  );
  const [installingSales, setInstallingSales] = React.useState(false);
  const installedSalesTemplates = templates.filter(
    (template) =>
      template.category === SALES_TEMPLATE_CATEGORY ||
      SALES_EMAIL_TEMPLATES.some((preset) => preset.name === template.name),
  ).length;
  const missingSalesTemplates = Math.max(
    SALES_EMAIL_TEMPLATES.length - installedSalesTemplates,
    0,
  );

  async function installSalesTemplates() {
    setInstallingSales(true);
    try {
      const result = await installSalesEmailTemplates();
      if (result.inserted === 0) {
        toast.success("Las plantillas comerciales ya estaban instaladas");
      } else {
        toast.success(
          `${result.inserted} ${
            result.inserted === 1
              ? "plantilla instalada"
              : "plantillas instaladas"
          }`,
        );
      }
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudieron instalar las plantillas",
      );
    } finally {
      setInstallingSales(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Plantillas de email</CardTitle>
        <CardDescription>
          Asuntos y cuerpos reutilizables para emails 1:1.
        </CardDescription>
        <CardAction className="flex flex-wrap justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={installSalesTemplates}
            disabled={installingSales || missingSalesTemplates === 0}
          >
            <Sparkles />
            {missingSalesTemplates === 0
              ? "Comerciales listas"
              : installingSales
                ? "Instalando..."
                : "Instalar comerciales"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDialog({ mode: "create", template: null })}
          >
            <Plus />
            Añadir
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        {templates.length === 0 ? (
          <p className="text-muted-foreground px-6 py-6 text-center text-sm">
            Sin plantillas todavía.
          </p>
        ) : (
          <div className="divide-y">
            {templates.map((template) => (
              <div
                key={template.id}
                className="flex items-center gap-3 px-6 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-sm font-medium">
                      {template.name}
                    </p>
                    {template.category === SALES_TEMPLATE_CATEGORY ? (
                      <Badge variant="outline" className="shrink-0">
                        Comercial
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground truncate text-xs">
                    {template.subject}
                  </p>
                </div>
                <div className="hidden max-w-72 flex-wrap justify-end gap-1 md:flex">
                  {template.variables.slice(0, 4).map((variable) => (
                    <Badge
                      key={variable}
                      variant="secondary"
                      className="font-mono text-[11px] font-normal"
                    >
                      {variable}
                    </Badge>
                  ))}
                  {template.variables.length > 4 ? (
                    <Badge variant="secondary" className="font-normal">
                      +{template.variables.length - 4}
                    </Badge>
                  ) : null}
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
                    <DropdownMenuItem
                      onClick={() => setDialog({ mode: "edit", template })}
                    >
                      <Pencil />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setDeleting(template)}
                    >
                      <Trash2 />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {dialog ? (
        <EmailTemplateDialog
          key={dialog.template?.id ?? "new-email-template"}
          state={dialog}
          catalog={catalog}
          onClose={() => setDialog(null)}
        />
      ) : null}

      <DeleteTemplateDialog
        deleting={deleting}
        onClose={() => setDeleting(null)}
      />
    </Card>
  );
}

function EmailTemplateDialog({
  state,
  catalog,
  onClose,
}: {
  state: DialogState;
  catalog: MergeTag[];
  onClose: () => void;
}) {
  const router = useRouter();
  const template = state.template;
  const isEdit = state.mode === "edit";
  const [name, setName] = React.useState(template?.name ?? "");
  const [subject, setSubject] = React.useState(template?.subject ?? "");
  const [bodyHtml, setBodyHtml] = React.useState(template?.bodyHtml ?? "");
  const [bodyText, setBodyText] = React.useState(template?.bodyText ?? "");
  const [saving, setSaving] = React.useState(false);
  const subjectRef = React.useRef<HTMLInputElement>(null);
  const editorRef = React.useRef<RichEmailEditorHandle>(null);
  const lastFocused = React.useRef<"subject" | "body">("body");

  function insertTag(tag: string) {
    const token = `{{${tag}}}`;
    if (lastFocused.current === "subject") {
      insertIntoInput(subjectRef.current, subject, token, setSubject);
      return;
    }
    editorRef.current?.insertText(token);
  }

  function handleEditorChange(value: RichEmailEditorValue) {
    setBodyHtml(value.html);
    setBodyText(value.text);
  }

  async function submit() {
    if (
      !name.trim() ||
      !subject.trim() ||
      (!bodyText.trim() && !htmlHasContent(bodyHtml))
    ) {
      toast.error("Completa nombre, asunto y cuerpo.");
      return;
    }

    setSaving(true);
    try {
      const values = { name, subject, bodyText, bodyHtml };
      if (isEdit && template) {
        await updateEmailTemplate(template.id, values);
        toast.success("Plantilla actualizada");
      } else {
        await createEmailTemplate(values);
        toast.success("Plantilla creada");
      }
      onClose();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo guardar la plantilla",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar plantilla" : "Nueva plantilla"}
          </DialogTitle>
          <DialogDescription>
            Disponible desde el redactor de email en fichas de contacto, empresa
            y negocio.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Nombre</Label>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Primer contacto"
              autoFocus
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <MergeTagMenu catalog={catalog} onSelect={insertTag} />
          </div>

          <div className="grid gap-1.5">
            <Label>Asunto</Label>
            <Input
              ref={subjectRef}
              value={subject}
              onFocus={() => (lastFocused.current = "subject")}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Hola {{nombre}}, una idea para {{empresa}}"
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Mensaje</Label>
            <RichEmailEditor
              ref={editorRef}
              value={bodyHtml}
              onFocus={() => (lastFocused.current = "body")}
              onChange={handleEditorChange}
              placeholder={'Hola {{nombre|"amigo"}},'}
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Cancelar
          </DialogClose>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteTemplateDialog({
  deleting,
  onClose,
}: {
  deleting: EmailTemplateItem | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function confirm() {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteEmailTemplate(deleting.id);
      toast.success("Plantilla eliminada");
      onClose();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar la plantilla",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={Boolean(deleting)}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>¿Eliminar la plantilla?</DialogTitle>
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
          <Button variant="destructive" onClick={confirm} disabled={busy}>
            {busy ? "Eliminando..." : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
