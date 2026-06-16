import { Building2 } from "lucide-react";
import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Empresas" };

export default function OrganizationsPage() {
  return (
    <ComingSoon
      icon={Building2}
      title="Empresas"
      description="Organiza las empresas y vincúlalas con sus contactos y negocios."
      phase="Fase 1"
      features={[
        "Ficha de empresa con sus contactos asociados",
        "Campos personalizados y etiquetas",
        "Negocios y actividad relacionados",
        "Detección de duplicados por dominio",
      ]}
    />
  );
}
