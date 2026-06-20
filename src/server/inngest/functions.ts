import { inngest } from "./client";
import {
  GmailServiceError,
  listGmailSyncCandidates,
} from "@/server/services/gmail-auth";
import { syncGmailMailbox } from "@/server/services/gmail-sync";
import {
  CAMPAIGN_SEND_EVENT,
  CampaignDispatchError,
  getCampaignDeliveryConfig,
  nextAllowedCampaignSendAt,
  prepareCampaignForSend,
  sendNextCampaignBatch,
} from "@/server/services/campaign-dispatch";

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

const NON_RETRYABLE_CAMPAIGN_CODES = new Set([
  "cancelled",
  "invalid_campaign",
  "not_configured",
  "not_found",
  "transport_error",
]);

function gmailSyncUserId(event: { data?: unknown }) {
  if (!event.data || typeof event.data !== "object") return null;
  const data = event.data as Record<string, unknown>;
  return typeof data.userId === "string" ? data.userId : null;
}

function campaignIdFromEvent(event: { data?: unknown }) {
  if (!event.data || typeof event.data !== "object") return null;
  const data = event.data as Record<string, unknown>;
  return typeof data.campaignId === "string" ? data.campaignId : null;
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

export const sendCampaign = inngest.createFunction(
  { id: "send-campaign", triggers: [{ event: CAMPAIGN_SEND_EVENT }] },
  async ({ event, step }) => {
    const campaignId = campaignIdFromEvent(event);
    if (!campaignId) return { ok: false, reason: "missing_campaign_id" };

    let preparation = await step.run("preparar-campana", async () => {
      try {
        return {
          ok: true as const,
          result: await prepareCampaignForSend(campaignId),
        };
      } catch (error) {
        if (
          error instanceof CampaignDispatchError &&
          NON_RETRYABLE_CAMPAIGN_CODES.has(error.code)
        ) {
          return {
            code: error.code,
            message: error.message,
            ok: false as const,
          };
        }
        throw error;
      }
    });

    if (!preparation.ok) return preparation;
    if (preparation.result.state === "waiting") {
      await step.sleepUntil(
        "esperar-programacion",
        new Date(preparation.result.waitUntil),
      );
      preparation = await step.run("preparar-campana-tras-espera", async () => {
        try {
          return {
            ok: true as const,
            result: await prepareCampaignForSend(campaignId),
          };
        } catch (error) {
          if (
            error instanceof CampaignDispatchError &&
            NON_RETRYABLE_CAMPAIGN_CODES.has(error.code)
          ) {
            return {
              code: error.code,
              message: error.message,
              ok: false as const,
            };
          }
          throw error;
        }
      });
      if (!preparation.ok) return preparation;
    }

    if (preparation.result.state !== "ready") return preparation.result;

    const config = getCampaignDeliveryConfig();
    let totalFailed = 0;
    let totalSent = 0;

    for (
      let batchIndex = 1;
      batchIndex <= config.maxBatchesPerRun;
      batchIndex += 1
    ) {
      const now = new Date();
      const nextAllowed = nextAllowedCampaignSendAt(now, config);
      if (nextAllowed.getTime() > now.getTime() + 1000) {
        await step.sleepUntil(
          `esperar-ventana-envio-${batchIndex}`,
          nextAllowed,
        );
      }

      const batch = await step.run(`enviar-lote-${batchIndex}`, async () => {
        try {
          return {
            ok: true as const,
            result: await sendNextCampaignBatch(campaignId, batchIndex),
          };
        } catch (error) {
          if (
            error instanceof CampaignDispatchError &&
            NON_RETRYABLE_CAMPAIGN_CODES.has(error.code)
          ) {
            return {
              code: error.code,
              message: error.message,
              ok: false as const,
            };
          }
          throw error;
        }
      });

      if (!batch.ok) return batch;
      totalFailed += batch.result.failed;
      totalSent += batch.result.sent;
      if (batch.result.done) {
        return {
          ok: true,
          result: batch.result,
          totalFailed,
          totalSent,
        };
      }

      if (config.batchDelaySeconds > 0) {
        await step.sleep(
          `pausa-limite-resend-${batchIndex}`,
          `${config.batchDelaySeconds}s`,
        );
      }
    }

    return {
      ok: false,
      reason: "max_batches_reached",
      totalFailed,
      totalSent,
    };
  },
);

/** Todas las funciones registradas en el endpoint /api/inngest. */
export const functions = [helloWorld, syncGmailMailboxes, sendCampaign];
