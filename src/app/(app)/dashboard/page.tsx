import {
  ArrowRight,
  Building2,
  CircleDot,
  Handshake,
  TrendingUp,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { countOrganizations, countPersons } from "@/server/queries/contacts";

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
];

export default async function DashboardPage() {
  const [contactCount, orgCount] = await Promise.all([
    countPersons(),
    countOrganizations(),
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
      label: "Negocios abiertos",
      value: "—",
      hint: "Disponible en la Fase 2",
      icon: Handshake,
    },
    {
      label: "Valor del pipeline",
      value: "—",
      hint: "Disponible en la Fase 2",
      icon: TrendingUp,
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
            <CardTitle>Accesos rápidos</CardTitle>
            <CardDescription>Empieza por aquí.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
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
              <span className="font-medium">1 · Contactos y Empresas</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Siguiente</span>
              <span className="font-medium">2 · Pipeline</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Login</span>
              <span className="font-medium">Google ✓</span>
            </div>
            <p className="text-muted-foreground/80 border-t pt-3 text-xs">
              El plan completo está en <code>docs/</code>. Retoma siempre por{" "}
              <code>docs/ESTADO-ACTUAL.md</code>.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
