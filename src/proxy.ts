import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Puerta rápida de acceso (edge-safe): si no hay cookie de sesión, redirige a
 * /login antes de renderizar la app. La validación real de la sesión la hace
 * `auth()` en el layout protegido (src/app/(app)/layout.tsx), que sí accede a la BD.
 *
 * En Next.js 16 este archivo se llama "proxy" (antes "middleware").
 */
const PUBLIC_PREFIXES = [
  "/login",
  "/api/auth",
  "/api/inngest",
  "/api/dev-login",
  "/api/campaigns/unsubscribe",
  "/api/webhooks/resend",
  "/unsubscribe",
  "/f/",
  "/api/forms",
];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const hasSession =
    req.cookies.has("authjs.session-token") ||
    req.cookies.has("__Secure-authjs.session-token");

  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Aplica a todo salvo estáticos de Next y archivos con extensión.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
