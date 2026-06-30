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
import {
  SEQUENCE_RUN_EVENT,
  SEQUENCE_SIGNAL_EVENT,
  SequenceRunError,
  advanceEnrollment,
  completeEnrollment,
  createSequenceTaskStep,
  failEnrollment,
  gateSequenceEmailSend,
  handleConditionResult,
  hasSequenceSignal,
  loadSequenceRun,
  markEnrollmentStep,
  parseSequenceSignal,
  sendSequenceEmailStep,
  sequenceConditionSignalType,
  sequenceConditionTimeout,
  sequenceSignalMatchExpression,
  sequenceStepSleepDuration,
  stopEnrollmentOnSignal,
  type SequenceRunErrorCode,
} from "@/server/services/sequence-runner";
import {
  AUTOMATION_EVENT,
  dispatchAutomationEvent,
  parseAutomationEvent,
} from "@/server/services/automation-runner";
import { executeAutomationRun } from "@/server/services/automation-executor";
import { runSequenceCrmActionStep } from "@/server/services/crm-actions";

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

const NON_RETRYABLE_SEQUENCE_CODES = new Set<SequenceRunErrorCode>([
  "invalid_enrollment",
  "invalid_recipient",
  "not_found",
  "not_subscribed",
  "suppressed",
  "transport_error",
]);

const FAILING_SEQUENCE_CODES = new Set<SequenceRunErrorCode>([
  "invalid_enrollment",
  "invalid_recipient",
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

function enrollmentIdFromEvent(event: { data?: unknown }) {
  if (!event.data || typeof event.data !== "object") return null;
  const data = event.data as Record<string, unknown>;
  return typeof data.enrollmentId === "string" ? data.enrollmentId : null;
}

async function runSequenceWork<T>(
  enrollmentId: string,
  work: () => Promise<T>,
) {
  try {
    return { ok: true as const, result: await work() };
  } catch (error) {
    if (
      error instanceof SequenceRunError &&
      NON_RETRYABLE_SEQUENCE_CODES.has(error.code)
    ) {
      if (FAILING_SEQUENCE_CODES.has(error.code)) {
        await failEnrollment({ enrollmentId, message: error.message });
      }
      return {
        code: error.code,
        message: error.message,
        ok: false as const,
      };
    }
    throw error;
  }
}

function isSequenceNoopResult(
  result: unknown,
): result is { reason: string; state: "noop" } {
  return (
    Boolean(result) &&
    typeof result === "object" &&
    (result as { state?: unknown }).state === "noop"
  );
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

export const runSequence = inngest.createFunction(
  { id: "run-sequence", triggers: [{ event: SEQUENCE_RUN_EVENT }] },
  async ({ event, step }) => {
    const enrollmentId = enrollmentIdFromEvent(event);
    if (!enrollmentId) return { ok: false, reason: "missing_enrollment_id" };

    const loaded = await step.run("cargar-inscripcion", () =>
      runSequenceWork(enrollmentId, () => loadSequenceRun(enrollmentId)),
    );
    if (!loaded.ok) return loaded;
    if (loaded.result.state !== "ready")
      return { ok: true, result: loaded.result };

    const startPosition = Math.max(0, loaded.result.currentStepPosition);
    for (
      let position = startPosition;
      position < loaded.result.steps.length;
      position += 1
    ) {
      const current = loaded.result.steps[position];
      if (!current) continue;
      const stepNumber = position + 1;

      await step.run(`marcar-paso-${stepNumber}`, () =>
        markEnrollmentStep({
          enrollmentId,
          position,
          stepId: current.id,
        }),
      );

      if (current.type === "wait") {
        await step.sleep(
          `esperar-paso-${stepNumber}`,
          sequenceStepSleepDuration(current),
        );
        const reloaded = await step.run(`revalidar-espera-${stepNumber}`, () =>
          runSequenceWork(enrollmentId, () => loadSequenceRun(enrollmentId)),
        );
        if (!reloaded.ok) return reloaded;
        if (reloaded.result.state !== "ready") {
          return { ok: true, result: reloaded.result };
        }
      }

      if (current.type === "email") {
        // 5.6/10.5: respetar ventana, límite diario y hora óptima del contacto.
        let canSend = false;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const gate = await step.run(
            `evaluar-envio-${stepNumber}-${attempt}`,
            () =>
              runSequenceWork(enrollmentId, () =>
                gateSequenceEmailSend(enrollmentId),
              ),
          );
          if (!gate.ok) return gate;
          if (isSequenceNoopResult(gate.result)) {
            return { ok: true, result: gate.result };
          }
          if (gate.result.decision.action === "send") {
            canSend = true;
            break;
          }
          await step.sleepUntil(
            `esperar-envio-${stepNumber}-${attempt}`,
            new Date(gate.result.decision.until),
          );
        }
        if (!canSend) {
          return {
            ok: true,
            result: {
              reason: "send_window_unavailable",
              state: "noop" as const,
            },
          };
        }

        const sent = await step.run(`enviar-email-${stepNumber}`, () =>
          runSequenceWork(enrollmentId, () =>
            sendSequenceEmailStep({
              enrollmentId,
              stepId: current.id,
            }),
          ),
        );
        if (!sent.ok) return sent;
        if (isSequenceNoopResult(sent.result)) {
          return { ok: true, result: sent.result };
        }
      }

      if (current.type === "condition") {
        const signalType = sequenceConditionSignalType(current.condition);
        let matched = false;
        if (signalType) {
          matched = await step.run(`buscar-senal-${stepNumber}`, () =>
            hasSequenceSignal({ enrollmentId, type: signalType }),
          );
          if (!matched) {
            const signal = await step.waitForEvent(
              `esperar-senal-${stepNumber}`,
              {
                event: SEQUENCE_SIGNAL_EVENT,
                if: sequenceSignalMatchExpression(enrollmentId, signalType),
                timeout: sequenceConditionTimeout(),
              },
            );
            matched = Boolean(signal);
          }
        }

        const reloaded = await step.run(
          `revalidar-condicion-${stepNumber}`,
          () =>
            runSequenceWork(enrollmentId, () => loadSequenceRun(enrollmentId)),
        );
        if (!reloaded.ok) return reloaded;
        if (reloaded.result.state !== "ready") {
          return { ok: true, result: reloaded.result };
        }

        const condition = await step.run(
          `evaluar-condicion-${stepNumber}`,
          () =>
            handleConditionResult({
              condition: current.condition,
              enrollmentId,
              matched,
            }),
        );
        if (condition.stop) return { ok: true, result: condition };
      }

      if (current.type === "task") {
        if (current.waitDays > 0 || current.waitHours > 0) {
          await step.sleep(
            `esperar-tarea-${stepNumber}`,
            sequenceStepSleepDuration(current),
          );
        }

        const task = await step.run(`crear-tarea-${stepNumber}`, () =>
          runSequenceWork(enrollmentId, () =>
            createSequenceTaskStep({
              enrollmentId,
              stepId: current.id,
            }),
          ),
        );
        if (!task.ok) return task;
        if (isSequenceNoopResult(task.result)) {
          return { ok: true, result: task.result };
        }
      }

      if (current.type === "crm_action") {
        const action = await step.run(`accion-crm-${stepNumber}`, () =>
          runSequenceWork(enrollmentId, () =>
            runSequenceCrmActionStep({
              enrollmentId,
              stepId: current.id,
            }),
          ),
        );
        if (!action.ok) return action;
        if (isSequenceNoopResult(action.result)) {
          return { ok: true, result: action.result };
        }
      }

      await step.run(`avanzar-paso-${stepNumber}`, () =>
        advanceEnrollment({ enrollmentId, nextPosition: position + 1 }),
      );
    }

    const completed = await step.run("completar-inscripcion", () =>
      completeEnrollment(enrollmentId),
    );
    return { ok: true, result: completed };
  },
);

export const stopSequenceOnSignal = inngest.createFunction(
  {
    id: "stop-sequence-on-signal",
    triggers: [{ event: SEQUENCE_SIGNAL_EVENT }],
  },
  async ({ event, step }) => {
    const signal = parseSequenceSignal(event.data);
    if (!signal) return { ok: false, reason: "invalid_signal" };

    const result = await step.run("detener-inscripcion", () =>
      stopEnrollmentOnSignal({
        enrollmentId: signal.enrollmentId,
        occurredAt: signal.occurredAt,
        ownerId: signal.ownerId,
        type: signal.type,
      }),
    );
    return { ok: true, result };
  },
);

export const runAutomationsForEvent = inngest.createFunction(
  { id: "run-automations-for-event", triggers: [{ event: AUTOMATION_EVENT }] },
  async ({ event, step }) => {
    const automationEvent = parseAutomationEvent(event.data);
    if (!automationEvent)
      return { ok: false, reason: "invalid_automation_event" };

    const result = await step.run("preparar-ejecuciones", () =>
      dispatchAutomationEvent(automationEvent),
    );

    // 6.6: ejecuta cada run preparado; las esperas usan `step.sleep` de Inngest.
    const runResults = [];
    for (const runId of result.runIds ?? []) {
      const runResult = await executeAutomationRun(runId, {
        sleep: ({ duration, node }) =>
          step.sleep(`esperar-${runId}-${node.id}`, duration),
      });
      runResults.push({ runId, ...runResult });
    }

    return { ok: true, result, runResults };
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
export const functions = [
  helloWorld,
  syncGmailMailboxes,
  sendCampaign,
  runSequence,
  stopSequenceOnSignal,
  runAutomationsForEvent,
];
