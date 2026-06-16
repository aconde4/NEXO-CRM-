"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { deleteOrganization } from "@/server/actions/contacts";
import { EntityAvatar } from "@/components/entity-avatar";
import {
  OrganizationFormDialog,
  type OrganizationInitial,
} from "@/components/organizations/organization-form-dialog";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

export type OrgRow = OrganizationInitial & {
  persons: { id: string }[];
};

export function OrganizationsView({
  organizations,
  query,
}: {
  organizations: OrgRow[];
  query: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = React.useState(query);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<OrganizationInitial | null>(null);
  const [deleting, setDeleting] = React.useState<OrgRow | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  function onSearchChange(value: string) {
    setSearch(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set("q", value);
      else params.delete("q");
      router.replace(`/organizations${params.size ? `?${params}` : ""}`);
    }, 300);
  }

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(row: OrgRow) {
    setEditing(row);
    setDialogOpen(true);
  }

  async function confirmDelete() {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      await deleteOrganization(deleting.id);
      toast.success("Empresa eliminada");
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar empresa…"
            className="pl-9"
          />
        </div>
        <Button onClick={openCreate}>
          <Plus />
          Nueva empresa
        </Button>
      </div>

      {organizations.length === 0 ? (
        <EmptyState hasQuery={Boolean(query)} onCreate={openCreate} />
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-muted-foreground border-b text-left text-xs">
                <th className="px-4 py-2.5 font-medium">Empresa</th>
                <th className="hidden px-4 py-2.5 font-medium md:table-cell">
                  Sector
                </th>
                <th className="hidden px-4 py-2.5 font-medium lg:table-cell">
                  Contactos
                </th>
                <th className="hidden px-4 py-2.5 font-medium lg:table-cell">
                  Teléfono
                </th>
                <th className="w-12 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {organizations.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-muted/30 border-b transition-colors last:border-0"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/organizations/${row.id}`}
                      className="flex items-center gap-3"
                    >
                      <EntityAvatar name={row.name} square />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {row.name}
                        </span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {row.domain ?? "Sin dominio"}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="text-muted-foreground hidden px-4 py-2.5 md:table-cell">
                    {row.industry ?? "—"}
                  </td>
                  <td className="text-muted-foreground hidden px-4 py-2.5 lg:table-cell">
                    {row.persons.length}
                  </td>
                  <td className="text-muted-foreground hidden px-4 py-2.5 lg:table-cell">
                    {row.phone ?? "—"}
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
                          render={<Link href={`/organizations/${row.id}`} />}
                        >
                          <Building2 />
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

      <OrganizationFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        organization={editing}
      />

      <Dialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>¿Eliminar empresa?</DialogTitle>
            <DialogDescription>
              Se eliminará{" "}
              <span className="text-foreground font-medium">
                {deleting?.name}
              </span>
              . Sus contactos no se borran. Es reversible.
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
  hasQuery,
  onCreate,
}: {
  hasQuery: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
      <div className="bg-primary/10 text-primary mb-4 flex size-12 items-center justify-center rounded-xl">
        <Building2 className="size-6" />
      </div>
      <h3 className="font-medium">
        {hasQuery ? "Sin resultados" : "Aún no tienes empresas"}
      </h3>
      <p className="text-muted-foreground mt-1 max-w-xs text-sm">
        {hasQuery
          ? "Prueba con otra búsqueda."
          : "Crea tu primera empresa para agrupar tus contactos."}
      </p>
      {!hasQuery ? (
        <Button onClick={onCreate} className="mt-4">
          <Plus />
          Nueva empresa
        </Button>
      ) : null}
    </div>
  );
}
