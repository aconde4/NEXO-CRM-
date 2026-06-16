import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth, signIn } from "@/auth";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Iniciar sesión" };

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[1.15rem]" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect("/dashboard");

  async function signInWithGoogle() {
    "use server";
    await signIn("google", { redirectTo: "/dashboard" });
  }

  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden p-6">
      {/* Fondo decorativo */}
      <div
        aria-hidden
        className="from-primary/15 pointer-events-none absolute -top-40 left-1/2 size-[40rem] -translate-x-1/2 rounded-full bg-gradient-to-b to-transparent blur-3xl"
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="from-primary to-chart-2 mb-4 flex size-12 items-center justify-center rounded-xl bg-gradient-to-br text-lg font-bold text-primary-foreground shadow-sm">
            N
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Nexo CRM</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Inicia sesión para acceder a tu CRM.
          </p>
        </div>

        <div className="bg-card rounded-xl border p-6 shadow-sm">
          <form action={signInWithGoogle}>
            <Button type="submit" variant="outline" size="lg" className="w-full">
              <GoogleIcon />
              Continuar con Google
            </Button>
          </form>
          <p className="text-muted-foreground mt-4 text-center text-xs">
            Acceso restringido. Solo las cuentas autorizadas pueden entrar.
          </p>

          {process.env.NODE_ENV !== "production" ? (
            <a
              href="/api/dev-login"
              className="text-muted-foreground/70 hover:text-foreground mt-4 block border-t pt-3 text-center text-xs transition-colors"
            >
              Entrar como desarrollador (solo local)
            </a>
          ) : null}
        </div>

        <p className="text-muted-foreground/70 mt-6 text-center text-xs">
          Al continuar aceptas el uso de tus datos para gestionar tu cuenta.
        </p>
      </div>
    </main>
  );
}
