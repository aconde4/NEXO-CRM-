import {
  Building2,
  CircleDot,
  Handshake,
  Plus,
  TrendingUp,
  Users,
} from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Panel" };

const stats = [
  { label: "Contactos", value: "—", hint: "Disponible en la Fase 1", icon: Users },
  {
    label: "Empresas",
    value: "—",
    hint: "Disponible en la Fase 1",
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

const setupSteps = [
  {
    title: "Conectar la base de datos (Supabase)",
    detail: "Crear el proyecto y pegar DATABASE_URL en el entorno.",
    done: false,
  },
  {
    title: "Activar el inicio de sesión con Google",
    detail: "Crear credenciales OAuth y proteger la app.",
    done: false,
  },
  {
    title: "Desplegar en Vercel",
    detail: "Publicar la app y dejar el push-to-deploy activo.",
    done: false,
  },
];

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Panel"
        description="Bienvenido a Nexo CRM. Aquí verás un resumen de tu actividad comercial."
        actions={
          <Button disabled>
            <Plus />
            Nuevo negocio
          </Button>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Primeros pasos</CardTitle>
            <CardDescription>
              Completa la configuración inicial (Fase 0) para dejar el CRM en
              producción.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {setupSteps.map((step, index) => (
              <div
                key={step.title}
                className="flex items-start gap-3 rounded-lg border p-3"
              >
                <span className="bg-muted text-muted-foreground mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                  {index + 1}
                </span>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="text-muted-foreground text-xs">{step.detail}</p>
                </div>
                <Badge variant="outline" className="ml-auto">
                  Pendiente
                </Badge>
              </div>
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
              <span className="font-medium">0 · Fundaciones</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Siguiente</span>
              <span className="font-medium">1 · Contactos</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">Gmail + Resend</span>
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
