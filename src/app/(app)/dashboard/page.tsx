import {
  AlarmClock,
  ArrowRight,
  Building2,
  CircleDot,
  ListChecks,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ActivityRow } from "@/components/activities/activity-row";
import { NewActivityButton } from "@/components/activities/new-activity-button";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getActivityCounts, listAgenda } from "@/server/queries/activities";
import {
  countOrganizations,
  countPersons,
  listOrganizationOptions,
  listPersonOptions,
} from "@/server/queries/contacts";

export const metadata: Metadata = { title: "Panel" };

const quickLinks = [
  {
    title: "Gestionar contactos",
    description: "Crea, busca y organiza personas.",
    href: "/contacts",
    icon: Users,
  },
  {
    title: "Gestionar empresas",
    description: "Agrupa contactos por empresa.",
    href: "/organizations",
    icon: Building2,
  },
  {
    title: "Ver actividades",
    description: "Tareas, llamadas y reuniones.",
    href: "/activities",
    icon: ListChecks,
  },
];

export default async function DashboardPage() {
  const [contactCount, orgCount, counts, agenda, persons, organizations] =
    await Promise.all([
      countPersons(),
      countOrganizations(),
      getActivityCounts(),
      listAgenda(),
      listPersonOptions(),
      listOrganizationOptions(),
    ]);

  const stats = [
    {
      label: "Contactos",
      value: String(contactCount),
      hint: "En tu CRM",
      icon: Users,
    },
    {
      label: "Empresas",
      value: String(orgCount),
      hint: "En tu CRM",
      icon: Building2,
    },
    {
      label: "Tareas para hoy",
      value: String(counts.today),
      hint: "Pendientes y vencidas",
      icon: ListChecks,
    },
    {
      label: "Vencidas",
      value: String(counts.overdue),
      hint: counts.overdue > 0 ? "Requieren atención" : "Todo al día",
      icon: AlarmClock,
    },
  ];

  return (
    <>
      <PageHeader
        title="Panel"
        description="Bienvenido a Nexo CRM. Aquí verás un resumen de tu actividad comercial."
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="text-primary size-4" />
              Agenda de hoy
            </CardTitle>
            <CardDescription>Tus tareas pendientes y vencidas.</CardDescription>
            <CardAction>
              <NewActivityButton
                size="sm"
                variant="outline"
                label="Nueva"
                persons={persons}
                organizations={organizations}
              />
            </CardAction>
          </CardHeader>
          <CardContent className="px-0">
            {agenda.length === 0 ? (
              <p className="text-muted-foreground px-6 py-8 text-center text-sm">
                No tienes tareas pendientes para hoy. ¡Buen trabajo! 🎉
              </p>
            ) : (
              <>
                <div className="divide-y border-t">
                  {agenda.map((activity) => (
                    <ActivityRow
                      key={activity.id}
                      activity={activity}
                      showEntity
                      persons={persons}
                      organizations={organizations}
                    />
                  ))}
                </div>
                <div className="px-6 pt-3">
                  <Link
                    href="/activities"
                    className="text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline"
                  >
                    Ver todas las actividades
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CircleDot className="text-primary size-4" />
              Estado del proyecto
            </CardTitle>
            <CardDescription>Fase actual de construcción.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Fase</span>
              <span className="font-medium">3 · Email 1:1</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Siguiente</span>
              <span className="font-medium">3.2 · Modelo de email</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Login</span>
              <span className="font-medium">Google + Gmail OAuth</span>
            </div>
            <p className="text-muted-foreground/80 border-t pt-3 text-xs">
              El plan completo está en <code>docs/</code>. Retoma siempre por{" "}
              <code>docs/ESTADO-ACTUAL.md</code>.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Accesos rápidos</CardTitle>
          <CardDescription>Empieza por aquí.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:border-primary/40 hover:bg-accent/40 group flex items-center gap-3 rounded-lg border p-4 transition-colors"
            >
              <div className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
                <link.icon className="size-[1.15rem]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{link.title}</p>
                <p className="text-muted-foreground text-xs">
                  {link.description}
                </p>
              </div>
              <ArrowRight className="text-muted-foreground group-hover:text-foreground size-4 transition-colors" />
            </Link>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
