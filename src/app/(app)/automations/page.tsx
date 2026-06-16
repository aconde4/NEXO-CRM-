import { Workflow } from "lucide-react";
import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Automatizaciones" };

export default function AutomationsPage() {
  return (
    <ComingSoon
      icon={Workflow}
      title="Automatizaciones"
      description="Constructor visual de flujos: disparadores, condiciones, esperas y acciones."
      phase="Fase 6"
      features={[
        "Canvas visual con ramas if/else",
        "Disparadores por cambio de etapa, campo o email",
        "Acciones: enviar email, crear tarea, etiquetar, webhook…",
        "Esperas reales y reintentos fiables",
        "Registro de ejecuciones para auditar cada flujo",
      ]}
    />
  );
}
