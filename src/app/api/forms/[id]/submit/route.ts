import { NextResponse } from "next/server";

import { submitForm } from "@/server/services/form-intake";

/**
 * Endpoint público de recepción de un formulario (7.4). Acepta el envío (urlencoded o
 * multipart), crea/encuentra la persona, guarda el envío + lead y dispara la
 * automatización; luego redirige (303) a la URL de gracias o a `/f/[id]?ok=1`.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const origin = new URL(request.url).origin;

  let data: Record<string, string> = {};
  try {
    const formData = await request.formData();
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string") data[key] = value;
    }
  } catch {
    data = {};
  }

  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? (forwarded.split(",")[0]?.trim() ?? null) : null;
  const userAgent = request.headers.get("user-agent");

  const result = await submitForm({ formId: id, data, ip, userAgent });

  if (!result.ok) {
    if (result.reason === "rate_limited") {
      return new NextResponse(
        "Demasiados envíos. Inténtalo de nuevo en un minuto.",
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }
    // Formulario inexistente o no publicado: a la página pública (mostrará el aviso).
    return NextResponse.redirect(new URL(`/f/${id}`, origin), { status: 303 });
  }

  const target = /^https?:\/\//i.test(result.redirectTo)
    ? result.redirectTo
    : new URL(result.redirectTo, origin);
  return NextResponse.redirect(target, { status: 303 });
}
