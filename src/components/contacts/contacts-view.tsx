"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  Download,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Tag,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import type { CustomFieldDef } from "@/lib/custom-fields";
import { fullName } from "@/lib/format";
import { deletePerson } from "@/server/actions/contacts";
import type { SavedView } from "@/server/queries/saved-views";
import { SavedViewsBar } from "@/components/saved-views/saved-views-bar";
import { EntityAvatar } from "@/components/entity-avatar";
import { LabelChips, type LabelChip } from "@/components/label-chips";
import {
  ContactFormDialog,
  type ContactInitial,
  type OrgOption,
} from "@/components/contacts/contact-form-dialog";
import { Button } from "@/components/ui/button";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

export type ContactRow = ContactInitial & {
  organization: { id: string; name: string } | null;
  labels: LabelChip[];
};

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "recent", label: "Recientes" },
  { value: "oldest", label: "Más antiguos" },
  { value: "name", label: "Nombre A–Z" },
];

const sortSelectClass =
  "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-9 shrink-0 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none transition focus-visible:ring-[3px]";

export function ContactsView({
  contacts,
  organizations,
  labels,
  query,
  activeLabel,
  sort,
  savedViews,
  customFieldDefs = [],
}: {
  contacts: ContactRow[];
  organizations: OrgOption[];
  labels: LabelChip[];
  query: string;
  activeLabel: string;
  sort: string;
  savedViews: SavedView[];
  customFieldDefs?: CustomFieldDef[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = React.useState(query);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ContactInitial | null>(null);
  const [deleting, setDeleting] = React.useState<ContactRow | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeLabelObj = labels.find((l) => l.id === activeLabel);

  const exportParams = new URLSearchParams();
  if (query) exportParams.set("q", query);
  if (activeLabel) exportParams.set("label", activeLabel);
  if (sort && sort !== "recent") exportParams.set("sort", sort);
  const exportHref = `/api/contacts/export${
    exportParams.size ? `?${exportParams}` : ""
  }`;

  function pushParams(next: { q?: string; label?: string; sort?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.replace(`/contacts${params.size ? `?${params}` : ""}`);
  }

  function onSearchChange(value: string) {
    setSearch(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => pushParams({ q: value }), 300);
  }

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(row: ContactRow) {
    setEditing(row);
    setDialogOpen(true);
  }

  async function confirmDelete() {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      await deletePerson(deleting.id);
      toast.success("Contacto eliminado");
      setDeleting(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <SavedViewsBar
        entityType="person"
        basePath="/contacts"
        views={savedViews}
        current={{ q: query, label: activeLabel, sort }}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative w-full sm:max-w-xs">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar por nombre, email o campaña..."
              className="pl-9"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" className="shrink-0" />}
            >
              {activeLabelObj ? (
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: activeLabelObj.color }}
                />
              ) : (
                <Tag className="size-4" />
              )}
              <span className="hidden sm:inline">
                {activeLabelObj ? activeLabelObj.name : "Etiqueta"}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuItem onClick={() => pushParams({ label: "" })}>
                <Tag />
                Todas las etiquetas
                {!activeLabel ? <Check className="ml-auto size-4" /> : null}
              </DropdownMenuItem>
              {labels.length > 0 ? <DropdownMenuSeparator /> : null}
              {labels.map((label) => (
                <DropdownMenuItem
                  key={label.id}
                  onClick={() => pushParams({ label: label.id })}
                >
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: label.color }}
                  />
                  <span className="truncate">{label.name}</span>
                  {activeLabel === label.id ? (
                    <Check className="ml-auto size-4" />
                  ) : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <select
            className={sortSelectClass}
            value={sort || "recent"}
            onChange={(e) =>
              pushParams({
                sort: e.target.value === "recent" ? "" : e.target.value,
              })
            }
            aria-label="Ordenar"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="shrink-0"
            render={<Link href="/contacts/import" />}
          >
            <Upload />
            <span className="hidden sm:inline">Importar</span>
          </Button>
          <Button
            variant="outline"
            className="shrink-0"
            render={<a href={exportHref} />}
          >
            <Download />
            <span className="hidden sm:inline">Exportar</span>
          </Button>
          <Button onClick={openCreate} className="shrink-0">
            <Plus />
            <span className="hidden sm:inline">Nuevo contacto</span>
            <span className="sm:hidden">Nuevo</span>
          </Button>
        </div>
      </div>

      {contacts.length === 0 ? (
        <EmptyState
          hasFilter={Boolean(query || activeLabel)}
          onCreate={openCreate}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-muted-foreground border-b text-left text-xs">
                <th className="px-4 py-2.5 font-medium">Contacto</th>
                <th className="hidden px-4 py-2.5 font-medium md:table-cell">
                  Empresa
                </th>
                <th className="hidden px-4 py-2.5 font-medium xl:table-cell">
                  Campaña
                </th>
                <th className="hidden px-4 py-2.5 font-medium lg:table-cell">
                  Teléfono
                </th>
                <th className="hidden px-4 py-2.5 font-medium lg:table-cell">
                  Cargo
                </th>
                <th className="w-12 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {contacts.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-muted/30 border-b transition-colors last:border-0"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/contacts/${row.id}`}
                      className="flex items-center gap-3"
                    >
                      <EntityAvatar name={fullName(row.firstName, row.lastName)} />
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="truncate font-medium">
                            {fullName(row.firstName, row.lastName)}
                          </span>
                          <LabelChips labels={row.labels} />
                        </span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {row.email ?? "Sin email"}
                        </span>
                        {row.campaign ? (
                          <span className="text-muted-foreground/80 block truncate text-xs xl:hidden">
                            Campaña: {row.campaign}
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  </td>
                  <td className="text-muted-foreground hidden px-4 py-2.5 md:table-cell">
                    {row.organization?.name ?? "—"}
                  </td>
                  <td className="text-muted-foreground hidden px-4 py-2.5 xl:table-cell">
                    {row.campaign ?? "—"}
                  </td>
                  <td className="text-muted-foreground hidden px-4 py-2.5 lg:table-cell">
                    {row.phone ?? "—"}
                  </td>
                  <td className="text-muted-foreground hidden px-4 py-2.5 lg:table-cell">
                    {row.title ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
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
                          render={<Link href={`/contacts/${row.id}`} />}
                        >
                          <Users />
                          Ver ficha
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(row)}>
                          <Pencil />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleting(row)}
                        >
                          <Trash2 />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ContactFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        organizations={organizations}
        contact={editing}
        customFieldDefs={customFieldDefs}
      />

      <Dialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>¿Eliminar contacto?</DialogTitle>
            <DialogDescription>
              Se eliminará{" "}
              <span className="text-foreground font-medium">
                {deleting ? fullName(deleting.firstName, deleting.lastName) : ""}
              </span>
              . Podrás recuperarlo más adelante (borrado reversible).
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
    </>
  );
}

function EmptyState({
  hasFilter,
  onCreate,
}: {
  hasFilter: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
      <div className="bg-primary/10 text-primary mb-4 flex size-12 items-center justify-center rounded-xl">
        <Users className="size-6" />
      </div>
      <h3 className="font-medium">
        {hasFilter ? "Sin resultados" : "Aún no tienes contactos"}
      </h3>
      <p className="text-muted-foreground mt-1 max-w-xs text-sm">
        {hasFilter
          ? "Prueba con otra búsqueda o quita el filtro."
          : "Crea tu primer contacto para empezar a gestionar tu cartera."}
      </p>
      {!hasFilter ? (
        <Button onClick={onCreate} className="mt-4">
          <Plus />
          Nuevo contacto
        </Button>
      ) : null}
    </div>
  );
}
