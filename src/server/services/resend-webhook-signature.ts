import { createHmac, timingSafeEqual } from "node:crypto";

export type ResendWebhookHeaders = {
  id: string | null;
  signature: string | null;
  timestamp: string | null;
};

export type ResendWebhookSignatureErrorCode =
  | "invalid_secret"
  | "invalid_signature"
  | "invalid_timestamp"
  | "missing_headers"
  | "stale_timestamp";

export class ResendWebhookSignatureError extends Error {
  constructor(
    message: string,
    public readonly code: ResendWebhookSignatureErrorCode,
  ) {
    super(message);
    this.name = "ResendWebhookSignatureError";
  }
}

export function getResendWebhookSecret(): string | null {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  return secret ? secret : null;
}

export function isResendWebhookConfigured(): boolean {
  return getResendWebhookSecret() !== null;
}

function decodeSvixSecret(secret: string): Buffer {
  const encoded = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const decoded = Buffer.from(encoded, "base64");
  if (decoded.length === 0) {
    throw new ResendWebhookSignatureError(
      "El secreto de webhook de Resend no es valido.",
      "invalid_secret",
    );
  }
  return decoded;
}

function signatureCandidates(signatureHeader: string): string[] {
  return signatureHeader
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [version, signature] = item.split(",", 2);
      return version === "v1" && signature ? signature : null;
    })
    .filter((signature): signature is string => Boolean(signature));
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function verifyResendWebhookSignature(input: {
  headers: ResendWebhookHeaders;
  now?: Date;
  payload: string;
  secret: string;
  toleranceSeconds?: number;
}): void {
  const { id, signature, timestamp } = input.headers;
  if (!id || !signature || !timestamp) {
    throw new ResendWebhookSignatureError(
      "Faltan cabeceras Svix del webhook.",
      "missing_headers",
    );
  }

  const timestampSeconds = Number(timestamp);
  if (!Number.isInteger(timestampSeconds)) {
    throw new ResendWebhookSignatureError(
      "La marca temporal del webhook no es valida.",
      "invalid_timestamp",
    );
  }

  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
  const toleranceSeconds = input.toleranceSeconds ?? 300;
  if (Math.abs(nowSeconds - timestampSeconds) > toleranceSeconds) {
    throw new ResendWebhookSignatureError(
      "La firma del webhook ha caducado.",
      "stale_timestamp",
    );
  }

  const signedContent = `${id}.${timestamp}.${input.payload}`;
  const expected = createHmac("sha256", decodeSvixSecret(input.secret))
    .update(signedContent)
    .digest("base64");
  const matches = signatureCandidates(signature).some((candidate) =>
    constantTimeEqual(candidate, expected),
  );
  if (!matches) {
    throw new ResendWebhookSignatureError(
      "Firma de webhook no valida.",
      "invalid_signature",
    );
  }
}
