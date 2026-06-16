import { Handshake } from "lucide-react";
import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Negocios" };

export default function DealsPage() {
  return (
    <ComingSoon
      icon={Handshake}
      title="Negocios"
      description="Tu embudo de ventas visual con arrastrar y soltar entre etapas."
      phase="Fase 2"
      features={[
        "Tablero Kanban con arrastrar y soltar",
        "Varios embudos (pipelines) configurables",
        "Probabilidad por etapa y previsión ponderada",
        "Detección de negocios estancados",
        "Marcar como ganado/perdido con motivo",
      ]}
    />
  );
}
