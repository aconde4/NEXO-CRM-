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
import { syncGmailInboxNow } from "@/server/actions/emails";
import { getGmailConnectionStatus } from "@/server/queries/gmail";
import {
  listInboxThreads,
  type InboxThreadFilter,
  type InboxThreadSort,
} from "@/server/queries/email-threads";
import { InboxThreadsView } from "@/components/email/inbox-threads-view";

export const metadata: Metadata = { title: "Bandeja" };

const scopeLabels: Record<(typeof GMAIL_OAUTH_SCOPES)[number], string> = {
  "https://www.googleapis.com/auth/gmail.readonly": "Leer hilos y mensajes",
  "https://www.googleapis.com/auth/gmail.send": "Enviar correos",
};

type InboxSearchParams = {
  filter?: string | string[];
  q?: string | string[];
  sort?: string | string[];
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeFilter(value: string | undefined): InboxThreadFilter {
  if (value === "unread" || value === "linked" || value === "unlinked") {
    return value;
  }
  return "all";
}

function normalizeSort(value: string | undefined): InboxThreadSort {
  return value === "oldest" ? "oldest" : "recent";
}

async function authorizeGmail() {
  "use server";
  await signIn(
    "google",
    { redirectTo: "/inbox" },
    GOOGLE_OAUTH_AUTHORIZATION_PARAMS,
  );
}

async function syncGmailInbox() {
  "use server";
  await syncGmailInboxNow();
}

const mailboxStatusLabels = {
  active: "Activo",
  error: "Error",
  needs_reauth: "Requiere reautorización",
  paused: "Pausado",
} as const;

function formatDateTime(value: Date | null | undefined) {
  if (!value) return "Nunca";
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
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

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<InboxSearchParams>;
}) {
  const params = await searchParams;
  const filters = {
    filter: normalizeFilter(firstParam(params.filter)),
    query: firstParam(params.q) ?? "",
    sort: normalizeSort(firstParam(params.sort)),
  };
  const [status, inbox] = await Promise.all([
    getGmailConnectionStatus(),
    listInboxThreads(filters),
  ]);
  const grantedScopeSet = new Set(status.grantedScopes);
  const expiresAt = status.expiresAt
    ? formatDateTime(status.expiresAt)
    : "Sin token de acceso guardado";
  const mailboxLabel = status.mailbox
    ? mailboxStatusLabels[status.mailbox.status]
    : "Sin buzón inicializado";

  return (
    <>
      <PageHeader
        title="Bandeja"
        description={
          status.ready
            ? `${inbox.stats.total} ${
                inbox.stats.total === 1
                  ? "hilo sincronizado"
                  : "hilos sincronizados"
              } desde Gmail.`
            : "Conecta Gmail para enviar y leer conversaciones 1:1 desde Nexo CRM."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {status.ready ? (
              <form action={syncGmailInbox}>
                <Button type="submit" variant="outline">
                  <RefreshCw className="size-4" />
                  Sincronizar ahora
                </Button>
              </form>
            ) : null}
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
          </div>
        }
      />

      {status.ready ? (
        <InboxThreadsView
          filters={filters}
          stats={inbox.stats}
          threads={inbox.threads}
        />
      ) : null}

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
              <StatusRow
                icon={
                  status.mailbox?.status === "error" ? AlertTriangle : MailCheck
                }
                label="Sincronización"
                ok={Boolean(
                  status.mailbox &&
                  status.mailbox.status !== "error" &&
                  status.mailbox.status !== "needs_reauth",
                )}
                value={`${mailboxLabel} · Última: ${formatDateTime(status.mailbox?.lastSyncedAt)} · Cursor: ${
                  status.mailbox?.hasHistoryCursor ? "guardado" : "pendiente"
                }`}
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

            {status.mailbox?.lastSyncError ? (
              <div className="border-destructive/30 bg-destructive/10 rounded-lg border px-4 py-3 text-sm">
                <p className="text-destructive font-medium">
                  Última sincronización con error
                </p>
                <p className="text-muted-foreground mt-1 break-words">
                  {status.mailbox.lastSyncError}
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
                  "Sincronizar Gmail por Inngest y vincular mensajes por email.",
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
