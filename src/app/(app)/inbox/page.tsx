import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Inbox,
  KeyRound,
  MailCheck,
  RefreshCw,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";

import { signIn } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  GMAIL_OAUTH_SCOPES,
  GOOGLE_OAUTH_AUTHORIZATION_PARAMS,
} from "@/lib/google-oauth";
import { cn } from "@/lib/utils";
import { getGmailConnectionStatus } from "@/server/queries/gmail";

export const metadata: Metadata = { title: "Bandeja" };

const scopeLabels: Record<(typeof GMAIL_OAUTH_SCOPES)[number], string> = {
  "https://www.googleapis.com/auth/gmail.readonly": "Leer hilos y mensajes",
  "https://www.googleapis.com/auth/gmail.send": "Enviar correos",
};

async function authorizeGmail() {
  "use server";
  await signIn(
    "google",
    { redirectTo: "/inbox" },
    GOOGLE_OAUTH_AUTHORIZATION_PARAMS,
  );
}

function StatusRow({
  icon: Icon,
  label,
  ok,
  value,
}: {
  icon: LucideIcon;
  label: string;
  ok: boolean;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border px-3 py-2.5">
      <Icon
        className={cn(
          "mt-0.5 size-4",
          ok ? "text-emerald-600" : "text-amber-600",
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-muted-foreground text-xs break-words">{value}</p>
      </div>
      {ok ? (
        <Badge variant="secondary">OK</Badge>
      ) : (
        <Badge variant="outline">Pendiente</Badge>
      )}
    </div>
  );
}

export default async function InboxPage() {
  const status = await getGmailConnectionStatus();
  const grantedScopeSet = new Set(status.grantedScopes);
  const expiresAt = status.expiresAt
    ? new Intl.DateTimeFormat("es", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(status.expiresAt)
    : "Sin token de acceso guardado";

  return (
    <>
      <PageHeader
        title="Bandeja"
        description="Conecta Gmail para enviar y leer conversaciones 1:1 desde Nexo CRM."
        actions={
          <form action={authorizeGmail}>
            <Button
              type="submit"
              variant={status.ready ? "outline" : "default"}
            >
              {status.ready ? (
                <RefreshCw className="size-4" />
              ) : (
                <ExternalLink className="size-4" />
              )}
              {status.ready ? "Reautorizar Gmail" : "Conectar Gmail"}
            </Button>
          </form>
        }
      />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="text-primary size-4" />
              Estado de Gmail
            </CardTitle>
            <CardDescription>
              Autorización OAuth para la cuenta que enviará y recibirá correos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {status.ready ? (
                <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                  Listo para la integración Gmail
                </Badge>
              ) : (
                <Badge variant="outline">Requiere autorización de Gmail</Badge>
              )}
              {status.connected ? (
                <span className="text-muted-foreground text-xs">
                  Cuenta: {status.email ?? status.providerAccountId}
                </span>
              ) : null}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {GMAIL_OAUTH_SCOPES.map((scope) => {
                const ok = grantedScopeSet.has(scope);
                return (
                  <StatusRow
                    key={scope}
                    icon={ok ? CheckCircle2 : AlertTriangle}
                    label={scopeLabels[scope]}
                    ok={ok}
                    value={scope}
                  />
                );
              })}
              <StatusRow
                icon={status.hasRefreshToken ? KeyRound : AlertTriangle}
                label="Acceso offline"
                ok={status.hasRefreshToken}
                value={
                  status.hasRefreshToken
                    ? "Refresh token guardado para sincronizar y enviar sin pedir login cada vez."
                    : "Falta refresh token. Pulsa Conectar Gmail y acepta el consentimiento."
                }
              />
              <StatusRow
                icon={status.hasAccessToken ? CheckCircle2 : AlertTriangle}
                label="Token de acceso"
                ok={status.hasAccessToken}
                value={`Caducidad: ${expiresAt}`}
              />
            </div>

            {status.missingScopes.length > 0 ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
                <p className="font-medium text-amber-900 dark:text-amber-200">
                  Faltan permisos de Gmail
                </p>
                <p className="text-muted-foreground mt-1">
                  Reautoriza con Google para conceder{" "}
                  {status.missingScopes
                    .map((scope) => scopeLabels[scope])
                    .join(" y ")
                    .toLowerCase()}
                  .
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MailCheck className="text-primary size-4" />
                Base para Fase 3
              </CardTitle>
              <CardDescription>
                Lo que queda habilitado para las siguientes tareas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm">
                {[
                  "Enviar correo desde el buzón real del usuario.",
                  "Leer hilos y mensajes entrantes para vincular respuestas.",
                  "Mantener acceso mediante refresh token guardado en Auth.js.",
                ].map((item) => (
                  <li key={item} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 text-emerald-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="text-primary size-4" />
                Producción
              </CardTitle>
              <CardDescription>
                Gmail exige revisión especial para ciertos permisos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                En local basta con añadir la cuenta como usuario de prueba. Para
                una app pública, revisa la verificación OAuth de Google porque
                el permiso de lectura de Gmail es restringido.
              </p>
              <p className="text-muted-foreground">
                Nexo CRM solo muestra aquí el estado de conexión; los tokens se
                quedan en servidor y no se renderizan en la interfaz.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}
