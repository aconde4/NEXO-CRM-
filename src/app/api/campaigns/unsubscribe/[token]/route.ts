import { NextResponse } from "next/server";

import { escapeHtml } from "@/lib/email/merge-tags";
import { TRACKING_NO_STORE_HEADERS } from "@/server/services/email-tracking";
import { unsubscribeCampaignRecipient } from "@/server/services/campaign-unsubscribe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function renderResultHtml(input: {
  email?: string;
  ok: boolean;
  reason?: "invalid" | "not_found";
}) {
  const title = input.ok ? "Baja confirmada" : "No se pudo gestionar la baja";
  const message = input.ok
    ? `${input.email ?? "Este email"} ya no recibirá campañas de marketing.`
    : input.reason === "not_found"
      ? "No hemos encontrado esta suscripción. Puede que el enlace ya no exista."
      : "El enlace de baja no es válido.";

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} · Nexo CRM</title>
  <style>
    body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f8fb; color: #111827; }
    main { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
    section { max-width: 520px; width: 100%; box-sizing: border-box; background: white; border: 1px solid #e5e7eb; border-radius: 10px; padding: 28px; box-shadow: 0 1px 2px rgba(15, 23, 42, .06); }
    p { color: #4b5563; line-height: 1.6; }
  </style>
</head>
<body>
  <main>
    <section>
      <p>Nexo CRM</p>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
    </section>
  </main>
</body>
</html>`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  return NextResponse.redirect(
    new URL(`/unsubscribe/${encodeURIComponent(token)}`, request.url),
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const formData = await request.formData().catch(() => null);
  const source = formData?.get("source") === "page" ? "page" : "one_click";
  const result = await unsubscribeCampaignRecipient({
    request,
    source,
    token,
  });

  return new Response(
    renderResultHtml({
      email: result.ok ? result.email : undefined,
      ok: result.ok,
      reason: result.ok ? undefined : result.reason,
    }),
    {
      headers: {
        ...TRACKING_NO_STORE_HEADERS,
        "Content-Type": "text/html; charset=utf-8",
      },
      status: result.ok ? 200 : 400,
    },
  );
}
