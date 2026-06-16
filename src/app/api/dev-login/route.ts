import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { sessions, users } from "@/server/db/schema";

/**
 * Login de DESARROLLO (sin Google). Crea una sesión real en la base de datos para
 * un usuario de prueba y deja la cookie de Auth.js. Permite verificar la app
 * autenticada sin pasar por el OAuth de Google.
 *
 * Seguridad: solo funciona en desarrollo. En producción devuelve 404.
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }

  const email =
    (process.env.ALLOWED_EMAILS ?? "dev@nexo.local").split(",")[0]?.trim() ||
    "dev@nexo.local";

  let user = (
    await db.select().from(users).where(eq(users.email, email)).limit(1)
  )[0];

  if (!user) {
    user = (
      await db
        .insert(users)
        .values({ email, name: "Usuario de prueba (dev)" })
        .returning()
    )[0];
  }

  if (!user) {
    return new NextResponse("No se pudo crear el usuario de prueba", {
      status: 500,
    });
  }

  const sessionToken = `${randomUUID()}${randomUUID()}`.replace(/-/g, "");
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db.insert(sessions).values({ sessionToken, userId: user.id, expires });

  const response = NextResponse.redirect(new URL("/dashboard", request.url));
  response.cookies.set("authjs.session-token", sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: false,
    expires,
  });
  return response;
}
