import { CheckCircle2, ListChecks } from "lucide-react";

import { ActivityRow, type ActivityRowData } from "@/components/activities/activity-row";
import { NewActivityButton } from "@/components/activities/new-activity-button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** Ordena por vencimiento ascendente (sin fecha al final), luego por creación. */
function byDue(a: ActivityRowData, b: ActivityRowData): number {
  const ta = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
  const tb = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
  return ta - tb;
}

export function ActivitiesPanel({
  activities,
  lockedPersonId,
  lockedOrgId,
}: {
  activities: ActivityRowData[];
  lockedPersonId?: string;
  lockedOrgId?: string;
}) {
  const open = activities.filter((a) => !a.done).sort(byDue);
  const done = activities
    .filter((a) => a.done)
    .sort(
      (a, b) =>
        new Date(b.doneAt ?? 0).getTime() - new Date(a.doneAt ?? 0).getTime(),
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="text-muted-foreground size-4" />
          Tareas
          {open.length ? (
            <span className="text-muted-foreground text-sm font-normal">
              ({open.length})
            </span>
          ) : null}
        </CardTitle>
        <CardAction>
          <NewActivityButton
            size="sm"
            variant="outline"
            label="Nueva"
            lockedPersonId={lockedPersonId}
            lockedOrgId={lockedOrgId}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        {activities.length === 0 ? (
          <p className="text-muted-foreground px-6 py-6 text-center text-sm">
            No hay tareas. Crea una para no perder el seguimiento.
          </p>
        ) : (
          <div className="divide-y">
            {open.map((a) => (
              <ActivityRow
                key={a.id}
                activity={a}
                lockedPersonId={lockedPersonId}
                lockedOrgId={lockedOrgId}
              />
            ))}

            {done.length ? (
              <div className="text-muted-foreground flex items-center gap-1.5 px-4 pt-3 pb-1 text-xs font-medium">
                <CheckCircle2 className="size-3.5" />
                Completadas
              </div>
            ) : null}
            {done.map((a) => (
              <ActivityRow
                key={a.id}
                activity={a}
                lockedPersonId={lockedPersonId}
                lockedOrgId={lockedOrgId}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
