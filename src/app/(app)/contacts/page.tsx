import { Users } from "lucide-react";
import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Contactos" };

export default function ContactsPage() {
  return (
    <ComingSoon
      icon={Users}
      title="Contactos"
      description="Gestiona personas con campos personalizados, etiquetas, actividades, notas e importación desde CSV."
      phase="Fase 1"
      features={[
        "Listado con búsqueda, filtros y vistas guardadas",
        "Ficha con edición en línea y línea de tiempo",
        "Campos personalizados (texto, fecha, selección, monetario…)",
        "Importación CSV con mapeo y deduplicación",
        "Actividades, notas y adjuntos",
      ]}
    />
  );
}
