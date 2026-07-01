import { Inngest } from "inngest";

/**
 * Cliente de Inngest: motor de jobs, workflows duraderos, esperas y cron.
 * Base de las secuencias (Fase 5) y las automatizaciones (Fase 6).
 *
 * El SDK v4 arranca en modo "cloud" por defecto y ya NO deduce el modo dev desde
 * `NODE_ENV`, así que lo fijamos explícitamente: en local usa el Dev Server de Inngest
 * (localhost:8288) sin claves; en producción usa Inngest Cloud con
 * `INNGEST_EVENT_KEY`/`INNGEST_SIGNING_KEY`. (Se puede forzar con `INNGEST_DEV`.)
 */
export const inngest = new Inngest({
  id: "nexo-crm",
  isDev: process.env.NODE_ENV !== "production",
});
