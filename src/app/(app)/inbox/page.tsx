import { Inbox } from "lucide-react";
import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Bandeja" };

export default function InboxPage() {
  return (
    <ComingSoon
      icon={Inbox}
      title="Bandeja"
      description="Envía y recibe correos 1:1 desde tu Gmail, vinculados a cada contacto y negocio."
      phase="Fase 3"
      features={[
        "Sincronización bidireccional con Gmail",
        "Plantillas y variables de combinación",
        "Seguimiento de aperturas y clics",
        "Bandeja de ventas unificada",
        "Detección de respuestas",
      ]}
    />
  );
}
