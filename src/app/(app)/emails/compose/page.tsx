import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Inbox, Mail, Users, type LucideIcon } from "lucide-react";

import { getAISettingsStatus } from "@/server/queries/ai";
import { getEmailComposeData } from "@/server/queries/email-compose";
import { listEmailTemplates } from "@/server/queries/email-templates";
import { getGmailConnectionStatus } from "@/server/queries/gmail";
import { EmailComposerForm } from "@/components/email/send-email-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Redactar email" };

type ComposeSearchParams = {
  dealId?: string | string[];
  mode?: string | string[];
  personId?: string | string[];
  subject?: string | string[];
  threadId?: string | string[];
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ComposeEmailPage({
  searchParams,
}: {
  searchParams: Promise<ComposeSearchParams>;
}) {
  const params = await searchParams;
  const [composeData, templates, gmailStatus, aiStatus] = await Promise.all([
    getEmailComposeData(),
    listEmailTemplates(),
    getGmailConnectionStatus(),
    getAISettingsStatus(),
  ]);

  const requestedPersonId = firstParam(params.personId);
  const requestedDealId = firstParam(params.dealId);
  const requestedSubject = firstParam(params.subject) ?? "";
  const requestedThreadId = firstParam(params.threadId);
  const requestedMode = firstParam(params.mode) === "reply" ? "reply" : "new";
  const requestedDeal = requestedDealId
    ? composeData.dealOptions.find((deal) => deal.id === requestedDealId)
    : null;

  const initialRecipient =
    (requestedPersonId
      ? composeData.recipients.find(
          (recipient) =>
            recipient.personId === requestedPersonId ||
            recipient.id === requestedPersonId,
        )
      : null) ??
    (requestedDeal
      ? composeData.recipients.find(
          (recipient) =>
            (requestedDeal.personId &&
              recipient.personId === requestedDeal.personId) ||
            (requestedDeal.orgId && recipient.orgId === requestedDeal.orgId),
        )
      : null) ??
    composeData.recipients[0] ??
    null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold tracking-tight">
            Redactar email
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Envía correos 1:1 por Gmail con plantillas, variables, IA y
            seguimiento del CRM.
          </p>
        </div>
        <Button variant="outline" render={<Link href="/inbox" />}>
          <Inbox className="size-4" />
          Bandeja
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="text-primary size-4" />
              Nuevo mensaje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EmailComposerForm
              recipients={composeData.recipients}
              catalog={composeData.catalog}
              templates={templates}
              gmailReady={gmailStatus.ready}
              aiStatus={aiStatus}
              dealOptions={composeData.dealOptions}
              initialRecipientId={initialRecipient?.id}
              initialDealId={requestedDeal?.id}
              defaultSubject={requestedSubject}
              mode={requestedMode}
              threadId={requestedThreadId}
              redirectToThreadOnSend
              surface="page"
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Estado de envío</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <StatusRow
                ok={gmailStatus.ready}
                label="Gmail 1:1"
                detail={
                  gmailStatus.ready
                    ? `Conectado como ${gmailStatus.email ?? "Google"}`
                    : "Falta conectar o reautorizar Gmail."
                }
              />
              <StatusRow
                ok={templates.length > 0}
                label="Plantillas"
                detail={`${templates.length} disponibles`}
              />
              <StatusRow
                ok={aiStatus.configured}
                label="IA opcional"
                detail={
                  aiStatus.configured
                    ? `${aiStatus.provider ?? "Proveedor"} · ${aiStatus.model ?? "modelo"}`
                    : (aiStatus.reason ?? "No configurada")
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contexto CRM</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <Metric
                icon={Users}
                label="Contactos con email"
                value={composeData.recipients.length.toLocaleString("es-ES")}
              />
              <Metric
                icon={Mail}
                label="Negocios vinculables"
                value={composeData.dealOptions.length.toLocaleString("es-ES")}
              />
              <div className="bg-muted/30 rounded-lg border px-3 py-2">
                <p className="font-medium">Canal</p>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                  Esta pantalla usa Gmail para emails 1:1. El contacto masivo
                  seguirá pasando por campañas y Resend para respetar bajas,
                  supresiones y límites de volumen.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatusRow({
  detail,
  label,
  ok,
}: {
  detail: string;
  label: string;
  ok: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <CheckCircle2
        className={
          ok
            ? "mt-0.5 size-4 shrink-0 text-emerald-600"
            : "text-muted-foreground mt-0.5 size-4 shrink-0"
        }
      />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium">{label}</p>
          <Badge variant={ok ? "secondary" : "outline"}>
            {ok ? "OK" : "Pendiente"}
          </Badge>
        </div>
        <p className="text-muted-foreground mt-0.5 break-words text-xs">
          {detail}
        </p>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border px-3 py-2">
      <div className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-md">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="font-semibold tabular-nums">{value}</p>
      </div>
    </div>
  );
}
