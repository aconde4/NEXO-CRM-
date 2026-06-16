import { Settings } from "lucide-react";
import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Ajustes" };

export default function SettingsPage() {
  return (
    <ComingSoon
      icon={Settings}
      title="Ajustes"
      description="Configura tu cuenta, buzones de correo, campos personalizados y embudos."
      phase="Fase 0–1"
      features={[
        "Perfil y preferencias (zona horaria, idioma)",
        "Buzones conectados y firma de correo",
        "Campos personalizados y etiquetas",
        "Embudos y etapas",
        "Datos del remitente para RGPD",
      ]}
    />
  );
}
