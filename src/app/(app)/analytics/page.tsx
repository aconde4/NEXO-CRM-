import { BarChart3 } from "lucide-react";
import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Analítica" };

export default function AnalyticsPage() {
  return (
    <ComingSoon
      icon={BarChart3}
      title="Analítica"
      description="Paneles e informes para entender tu pipeline y el rendimiento del email."
      phase="Fase 9"
      features={[
        "Embudo de conversión y tasa de victoria",
        "Previsión de ingresos",
        "Rendimiento de email, secuencias y campañas",
        "Objetivos y seguimiento",
        "Informes personalizados con exportación",
      ]}
    />
  );
}
