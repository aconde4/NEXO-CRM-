import { auth } from "@/auth";

/** Devuelve el usuario autenticado o lanza un error. Úsalo en server actions/queries. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("No autenticado");
  }
  return session.user;
}
