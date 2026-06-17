import { ListChecks } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { cn } from "@/lib/utils";
import {
  ACTIVITY_FILTERS,
  getActivityCounts,
  listActivities,
  normalizeFilter,
  type ActivityFilter,
} from "@/server/queries/activities";
import {
  listOrganizationOptions,
  listPersonOptions,
} from "@/server/queries/contacts";
import { ActivityRow } from "@/components/activities/activity-row";
import { NewActivityButton } from "@/components/activities/new-activity-button";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Actividades" };

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const active = normalizeFilter(filter);

  const [items, persons, organizations, counts] = await Promise.all([
    listActivities(active),
    listPersonOptions(),
    listOrganizationOptions(),
    getActivityCounts(),
  ]);

  return (
    <>
      <PageHeader
        title="Actividades"
        description="Tus tareas, llamadas y reuniones, todo en un sitio."
        actions={
          <NewActivityButton persons={persons} organizations={organizations} />
        }
      />

      <div className="flex flex-wrap items-center gap-1.5">
        {ACTIVITY_FILTERS.map((tab) => {
          const count =
            tab.value === "today"
              ? counts.today
              : tab.value === "open"
                ? counts.open
                : undefined;
          const isActive = tab.value === active;
          return (
            <Link
              key={tab.value}
              href={tab.value === "open" ? "/activities" : `/activities?filter=${tab.value}`}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              {count ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-xs tabular-nums",
                    isActive
                      ? "bg-primary-foreground/20"
                      : "bg-muted text-muted-foreground",
                    tab.value === "today" && counts.overdue > 0 && !isActive
                      ? "bg-destructive/10 text-destructive"
                      : "",
                  )}
                >
                  {count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>

      {items.length === 0 ? (
        <EmptyState filter={active} />
      ) : (
        <div className="divide-y overflow-hidden rounded-xl border">
          {items.map((activity) => (
            <ActivityRow
              key={activity.id}
              activity={activity}
              showEntity
              persons={persons}
              organizations={organizations}
            />
          ))}
        </div>
      )}
    </>
  );
}

const emptyCopy: Record<ActivityFilter, { title: string; hint: string }> = {
  today: {
    title: "Nada para hoy",
    hint: "No tienes tareas vencidas ni pendientes para hoy. ¡Buen trabajo!",
  },
  open: {
    title: "Sin tareas pendientes",
    hint: "Crea una actividad para hacer seguimiento de tus contactos.",
  },
  done: {
    title: "Aún no hay nada completado",
    hint: "Cuando marques tareas como hechas, aparecerán aquí.",
  },
  all: {
    title: "Aún no hay actividades",
    hint: "Crea tu primera actividad para empezar a organizar tu día.",
  },
};

function EmptyState({ filter }: { filter: ActivityFilter }) {
  const copy = emptyCopy[filter];
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
      <div className="bg-primary/10 text-primary mb-4 flex size-12 items-center justify-center rounded-xl">
        <ListChecks className="size-6" />
      </div>
      <h3 className="font-medium">{copy.title}</h3>
      <p className="text-muted-foreground mt-1 max-w-xs text-sm">{copy.hint}</p>
    </div>
  );
}
