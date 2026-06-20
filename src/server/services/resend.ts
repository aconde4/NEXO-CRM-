import "server-only";

/**
 * Servicio Resend (Fase 4.3): transporte de email para campañas masivas. Envío
 * individual (`POST /emails`) y por lotes (`POST /emails/batch`, hasta 100 por
 * llamada; troceamos automáticamente). Es la capa de transporte: NO consulta la BD
 * ni la lista de supresión. El filtrado RGPD (`suppressions`) se aplica en la capa de
 * orquestación de la campaña (Fases 4.6/4.7) **antes** de llamar aquí.
 *
 * Si falta `RESEND_API_KEY`, `isResendConfigured()` devuelve `false` y la app degrada
 * con elegancia (igual que Storage): no se intenta ningún envío.
 */

const RESEND_API_BASE = "https://api.resend.com";

/** Máximo de mensajes por llamada al endpoint de lotes de Resend. */
export const RESEND_BATCH_MAX = 100;

export type ResendErrorCode =
  | "not_configured"
  | "invalid_input"
  | "rate_limited"
  | "api_error";

export class ResendServiceError extends Error {
  constructor(
    message: string,
    public readonly code: ResendErrorCode,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ResendServiceError";
  }
}

export type ResendTag = { name: string; value: string };

/** Mensaje a enviar. `from` va en formato RFC ("Nombre <correo@dominio>"). */
export type ResendEmailInput = {
  from: string;
  to: string | string[];
  subject: string;
  html?: string | null;
  text?: string | null;
  replyTo?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  /** Cabeceras extra (p. ej. `List-Unsubscribe`, `List-Unsubscribe-Post`). */
  headers?: Record<string, string>;
  /** Etiquetas para filtrar en el panel de Resend (p. ej. campaignId). */
  tags?: ResendTag[];
};

export type ResendSendResult = { id: string };

/** Resultado por elemento de un lote: ok con id, o error con el mensaje. */
export type ResendBatchItemResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export type ResendBatchResult = {
  results: ResendBatchItemResult[];
  sent: number;
  failed: number;
};

function cleanEnv(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function getResendApiKey(): string | null {
  return cleanEnv(process.env.RESEND_API_KEY);
}

export function isResendConfigured(): boolean {
  return getResendApiKey() !== null;
}

/** Remitente por defecto para campañas, p. ej. `CAMPAIGN_FROM_EMAIL`. */
export function getDefaultCampaignFrom(): string | null {
  const email = cleanEnv(process.env.CAMPAIGN_FROM_EMAIL);
  if (!email) return null;
  const name = cleanEnv(process.env.CAMPAIGN_FROM_NAME);
  return name ? formatFrom(name, email) : email;
}

/** Construye el campo `from` ("Nombre <correo>") saneando comillas del nombre. */
export function formatFrom(name: string | null | undefined, email: string): string {
  const cleanName = name?.trim().replace(/["<>]/g, "");
  return cleanName ? `${cleanName} <${email}>` : email;
}

function requireApiKey(): string {
  const apiKey = getResendApiKey();
  if (!apiKey) {
    throw new ResendServiceError(
      "Falta RESEND_API_KEY. Configura Resend antes de enviar campañas.",
      "not_configured",
    );
  }
  return apiKey;
}

/** Normaliza el mensaje al formato JSON de la API de Resend (snake_case). */
function toResendPayload(input: ResendEmailInput): Record<string, unknown> {
  const to = Array.isArray(input.to) ? input.to : [input.to];
  if (to.length === 0) {
    throw new ResendServiceError(
      "El mensaje no tiene destinatarios.",
      "invalid_input",
    );
  }
  const subject = input.subject?.trim();
  if (!subject) {
    throw new ResendServiceError(
      "El mensaje no tiene asunto.",
      "invalid_input",
    );
  }
  const html = input.html?.trim() || undefined;
  const text = input.text?.trim() || undefined;
  if (!html && !text) {
    throw new ResendServiceError(
      "El mensaje necesita cuerpo en HTML o texto.",
      "invalid_input",
    );
  }

  const payload: Record<string, unknown> = {
    from: input.from,
    to,
    subject,
  };
  if (html) payload.html = html;
  if (text) payload.text = text;
  if (input.replyTo) payload.reply_to = input.replyTo;
  if (input.cc) payload.cc = input.cc;
  if (input.bcc) payload.bcc = input.bcc;
  if (input.headers && Object.keys(input.headers).length > 0) {
    payload.headers = input.headers;
  }
  if (input.tags && input.tags.length > 0) payload.tags = input.tags;
  return payload;
}

/** Extrae el mensaje de error que devuelve la API de Resend (`{ message }`). */
function extractResendMessage(data: unknown): string | null {
  if (data && typeof data === "object" && "message" in data) {
    const message = (data as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return null;
}

async function resendFetch(
  path: string,
  body: unknown,
  extraHeaders?: Record<string, string>,
): Promise<{ ok: boolean; status: number; data: unknown; error: string | null }> {
  const apiKey = requireApiKey();
  const response = await fetch(`${RESEND_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });

  const data = (await response.json().catch(() => null)) as unknown;
  const error = response.ok
    ? null
    : (extractResendMessage(data) ?? `Resend HTTP ${response.status}`);
  return { ok: response.ok, status: response.status, data, error };
}

function throwForStatus(status: number, error: string): never {
  if (status === 429) {
    throw new ResendServiceError(error, "rate_limited", status);
  }
  throw new ResendServiceError(error, "api_error", status);
}

/**
 * Envía un único email por Resend. `idempotencyKey` evita duplicados al reintentar
 * (p. ej. al reanudar una campaña).
 */
export async function sendResendEmail(
  input: ResendEmailInput,
  opts: { idempotencyKey?: string } = {},
): Promise<ResendSendResult> {
  const payload = toResendPayload(input);
  const extra = opts.idempotencyKey
    ? { "Idempotency-Key": opts.idempotencyKey }
    : undefined;
  const res = await resendFetch("/emails", payload, extra);
  if (!res.ok) throwForStatus(res.status, res.error ?? "Error de Resend");

  const id =
    res.data && typeof res.data === "object" && "id" in res.data
      ? String((res.data as { id: unknown }).id)
      : null;
  if (!id) {
    throw new ResendServiceError(
      "Resend no devolvió un identificador de mensaje.",
      "api_error",
    );
  }
  return { id };
}

/** Divide un array en trozos de tamaño `size`. */
function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Envía un lote de emails por Resend, troceando en grupos de `RESEND_BATCH_MAX`. El
 * orden de `results` coincide con el de `inputs`. Si un trozo entero falla por error
 * de API, sus elementos quedan marcados como fallidos con el mismo mensaje.
 */
export async function sendResendBatch(
  inputs: ResendEmailInput[],
): Promise<ResendBatchResult> {
  const results: ResendBatchItemResult[] = [];

  for (const group of chunk(inputs, RESEND_BATCH_MAX)) {
    let payloads: Record<string, unknown>[];
    try {
      payloads = group.map(toResendPayload);
    } catch (error) {
      // Validación previa: marca todo el trozo como fallido y continúa.
      const message =
        error instanceof Error ? error.message : "Mensaje no válido";
      for (let i = 0; i < group.length; i++) {
        results.push({ ok: false, error: message });
      }
      continue;
    }

    const res = await resendFetch("/emails/batch", payloads);
    if (!res.ok) {
      // 429 y errores de credenciales/configuración deben cortar todo el envío.
      if (res.status === 429 || res.status === 401 || res.status === 403) {
        throwForStatus(res.status, res.error ?? "Error de Resend");
      }
      const message = res.error ?? "Error de Resend";
      for (let i = 0; i < group.length; i++) {
        results.push({ ok: false, error: message });
      }
      continue;
    }

    const items =
      res.data && typeof res.data === "object" && "data" in res.data
        ? (res.data as { data?: Array<{ id?: unknown }> }).data
        : undefined;
    group.forEach((_, i) => {
      const id = items?.[i]?.id;
      if (id != null) {
        results.push({ ok: true, id: String(id) });
      } else {
        results.push({ ok: false, error: "Resend no devolvió identificador." });
      }
    });
  }

  const sent = results.filter((r) => r.ok).length;
  return { results, sent, failed: results.length - sent };
}
