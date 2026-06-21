import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { parseResendWebhookEvent } from "@/lib/validations/resend-webhook";
import {
  ResendWebhookSignatureError,
  getResendWebhookSecret,
  verifyResendWebhookSignature,
} from "@/server/services/resend-webhook-signature";
import { processResendWebhookEvent } from "@/server/services/resend-webhooks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}

export async function POST(request: Request) {
  const secret = getResendWebhookSecret();
  if (!secret) {
    return json(503, { error: "resend_webhook_not_configured", ok: false });
  }

  const payload = await request.text();
  const headers = {
    id: request.headers.get("svix-id"),
    signature: request.headers.get("svix-signature"),
    timestamp: request.headers.get("svix-timestamp"),
  };

  try {
    verifyResendWebhookSignature({ headers, payload, secret });
    const event = parseResendWebhookEvent(payload);
    const result = await processResendWebhookEvent({
      event,
      svixId: headers.id!,
    });
    return json(200, result);
  } catch (error) {
    if (error instanceof ResendWebhookSignatureError) {
      return json(400, {
        code: error.code,
        error: "invalid_resend_webhook_signature",
        ok: false,
      });
    }
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return json(400, {
        error: "invalid_resend_webhook_payload",
        ok: false,
      });
    }
    throw error;
  }
}
