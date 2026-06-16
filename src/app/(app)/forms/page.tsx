import { ClipboardList } from "lucide-react";
import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Formularios" };

export default function FormsPage() {
  return (
    <ComingSoon
      icon={ClipboardList}
      title="Formularios"
      description="Formularios web embebibles que capturan leads directamente en el CRM."
      phase="Fase 7"
      features={[
        "Constructor de formularios con mapeo de campos",
        "Página pública y script para embeber",
        "Bandeja de leads y conversión a negocio",
        "Anti-spam (honeypot y límite de envíos)",
        "Disparo de automatizaciones al recibir",
      ]}
    />
  );
}
