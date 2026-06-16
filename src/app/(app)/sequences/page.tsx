import { Repeat } from "lucide-react";
import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Secuencias" };

export default function SequencesPage() {
  return (
    <ComingSoon
      icon={Repeat}
      title="Secuencias"
      description="Series de correos automáticos (drip) con esperas, condiciones y parada al responder."
      phase="Fase 5"
      features={[
        "Pasos de email, espera y condición",
        "Esperas reales de días con workflows duraderos",
        "Parada automática al recibir respuesta",
        "Límite diario por buzón y ventana de envío",
        "Variantes A/B por paso",
      ]}
    />
  );
}
