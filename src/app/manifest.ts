import type { MetadataRoute } from "next";

/** Manifest PWA (Fase 10.3): hace la app instalable en escritorio y móvil. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nexo CRM",
    short_name: "Nexo",
    description:
      "CRM personal: contactos, embudos, email, secuencias y automatizaciones con IA.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#0b0b0c",
    theme_color: "#7c3aed",
    lang: "es",
    icons: [
      {
        src: "/icon.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
