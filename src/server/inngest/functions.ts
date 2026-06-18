import { inngest } from "./client";
import {
  GmailServiceError,
  listGmailSyncCandidates,
} from "@/server/services/gmail-auth";
import { syncGmailMailbox } from "@/server/services/gmail-sync";

/**
 * Función de prueba para validar que Inngest está conectado (tarea 0.13).
 * Se dispara con el evento "demo/hello". En fases posteriores aquí vivirán
 * las funciones de secuencias y automatizaciones.
 */
export const helloWorld = inngest.createFunction(
  { id: "hello-world", triggers: [{ event: "demo/hello" }] },
  async ({ event, step }) => {
    await step.sleep("esperar-un-momento", "1s");
    return { mensaje: `Hola ${event.data?.nombre ?? "mundo"} desde Inngest` };
  },
);

const NON_RETRYABLE_GMAIL_SYNC_CODES = new Set([
  "missing_google_account",
  "missing_scope",
  "needs_reauth",
  "mailbox_paused",
]);

function gmailSyncUserId(event: { data?: unknown }) {
  if (!event.data || typeof event.data !== "object") return null;
  const data = event.data as Record<string, unknown>;
  return typeof data.userId === "string" ? data.userId : null;
}

export const syncGmailMailboxes = inngest.createFunction(
  {
    id: "sync-gmail-mailboxes",
    triggers: [{ cron: "*/10 * * * *" }, { event: "gmail/sync.requested" }],
  },
  async ({ event, step }) => {
    const requestedUserId = gmailSyncUserId(event);
    const candidates = requestedUserId
      ? [{ userId: requestedUserId }]
      : await step.run("listar-buzones-gmail", listGmailSyncCandidates);

    const results = [];
    for (const candidate of candidates) {
      const result = await step.run(
        `sincronizar-gmail-${candidate.userId}`,
        async () => {
          try {
            return {
              ok: true as const,
              result: await syncGmailMailbox(candidate.userId),
              userId: candidate.userId,
            };
          } catch (error) {
            if (
              error instanceof GmailServiceError &&
              NON_RETRYABLE_GMAIL_SYNC_CODES.has(error.code)
            ) {
              return {
                code: error.code,
                message: error.message,
                ok: false as const,
                userId: candidate.userId,
              };
            }
            throw error;
          }
        },
      );
      results.push(result);
    }

    return {
      count: results.length,
      results,
    };
  },
);

/** Todas las funciones registradas en el endpoint /api/inngest. */
export const functions = [helloWorld, syncGmailMailboxes];
