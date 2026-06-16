import { Megaphone } from "lucide-react";
import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Campañas" };

export default function CampaignsPage() {
  return (
    <ComingSoon
      icon={Megaphone}
      title="Campañas"
      description="Envíos masivos a segmentos con plantillas, programación, bajas y métricas."
      phase="Fase 4"
      features={[
        "Segmentos dinámicos por filtros",
        "Editor de email con bloques (React Email)",
        "Programación y envío por lotes",
        "Gestión de bajas y cumplimiento RGPD",
        "Métricas: aperturas, clics, rebotes y bajas",
      ]}
    />
  );
}
