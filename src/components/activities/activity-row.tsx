"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  CalendarClock,
  MoreHorizontal,
  Pencil,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { formatDue, isOverdue, metaForType } from "@/lib/activities";
import { fullName, relativeDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { deleteActivity, setActivityDone } from "@/server/actions/activities";
import {
  ActivityFormDialog,
  type ActivityInitial,
  type EntityOption,
} from "@/components/activities/activity-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

export type ActivityRowData = {
  id: string;
  type: string;
  subject: string;
  notes: string | null;
  dueAt: Date | string | null;
  done: boolean;
  doneAt: Date | string | null;
  person?: { id: string; firstName: string; lastName: string | null } | null;
  organization?: { id: string; name: string } | null;
};

export function ActivityRow({
  activity,
  showEntity = false,
  persons = [],
  organizations = [],
  lockedPersonId,
  lockedOrgId,
}: {
  activity: ActivityRowData;
  showEntity?: boolean;
  persons?: EntityOption[];
  organizations?: EntityOption[];
  lockedPersonId?: string;
  lockedOrgId?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  // Estado optimista: se revierte solo al valor real si la acción falla.
  const [done, setDone] = React.useOptimistic(activity.done);

  const meta = metaForType(activity.type);
  const Icon = meta.icon;
  const overdue = !done && isOverdue(activity.dueAt, false);

  function toggle(next: boolean) {
    startTransition(async () => {
      setDone(next);
      try {
        await setActivityDone(activity.id, next);
        if (next) toast.success("Tarea completada");
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "No se pudo actualizar",
        );
      }
    });
  }

  async function confirmDelete() {
    setIsDeleting(true);
    try {
      await deleteActivity(activity.id);
      toast.success("Actividad eliminada");
      setDeleting(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="group hover:bg-muted/30 flex items-start gap-3 px-4 py-3 transition-colors">
      <Checkbox
        checked={done}
        onCheckedChange={(checked) => toggle(Boolean(checked))}
        disabled={pending}
        className="mt-0.5"
        aria-label={done ? "Marcar como pendiente" : "Marcar como hecha"}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Icon
            className={cn(
              "size-3.5 shrink-0",
              overdue ? "text-destructive" : "text-muted-foreground",
            )}
          />
          <p
            className={cn(
              "min-w-0 truncate text-sm font-medium",
              done && "text-muted-foreground line-through",
            )}
          >
            {activity.subject}
          </p>
        </div>

        <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="text-muted-foreground/80">{meta.label}</span>

          {activity.dueAt ? (
            done ? (
              <Badge variant="secondary" className="font-normal">
                <CalendarClock />
                Hecha {relativeDate(activity.doneAt)}
              </Badge>
            ) : (
              <Badge
                variant={overdue ? "destructive" : "secondary"}
                className="font-normal"
              >
                <CalendarClock />
                {formatDue(activity.dueAt)}
              </Badge>
            )
          ) : null}

          {showEntity && activity.person ? (
            <Link
              href={`/contacts/${activity.person.id}`}
              className="hover:text-foreground inline-flex items-center gap-1 underline-offset-2 hover:underline"
            >
              <User className="size-3" />
              {fullName(activity.person.firstName, activity.person.lastName)}
            </Link>
          ) : null}

          {showEntity && activity.organization ? (
            <Link
              href={`/organizations/${activity.organization.id}`}
              className="hover:text-foreground inline-flex items-center gap-1 underline-offset-2 hover:underline"
            >
              <Building2 className="size-3" />
              {activity.organization.name}
            </Link>
          ) : null}
        </div>

        {activity.notes ? (
          <p className="text-muted-foreground mt-1 line-clamp-2 text-xs whitespace-pre-wrap">
            {activity.notes}
          </p>
        ) : null}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Acciones"
              className="opacity-0 transition-opacity group-hover:opacity-100 data-[popup-open]:opacity-100"
            />
          }
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditing(true)}>
            <Pencil />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDeleting(true)}
          >
            <Trash2 />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ActivityFormDialog
        open={editing}
        onOpenChange={setEditing}
        activity={toInitial(activity)}
        persons={persons}
        organizations={organizations}
        lockedPersonId={lockedPersonId}
        lockedOrgId={lockedOrgId}
      />

      <Dialog open={deleting} onOpenChange={(o) => !o && setDeleting(false)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>¿Eliminar actividad?</DialogTitle>
            <DialogDescription>
              Se eliminará{" "}
              <span className="text-foreground font-medium">
                {activity.subject}
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
    </div>
  );
}

function toInitial(a: ActivityRowData): ActivityInitial {
  return {
    id: a.id,
    type: a.type as ActivityInitial["type"],
    subject: a.subject,
    notes: a.notes,
    dueAt: a.dueAt,
    personId: a.person?.id ?? null,
    orgId: a.organization?.id ?? null,
  };
}
