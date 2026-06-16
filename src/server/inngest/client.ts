import { Inngest } from "inngest";

/**
 * Cliente de Inngest: motor de jobs, workflows duraderos, esperas y cron.
 * Será la base de las secuencias (Fase 5) y las automatizaciones (Fase 6).
 */
export const inngest = new Inngest({ id: "nexo-crm" });
