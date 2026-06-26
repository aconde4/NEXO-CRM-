import {
  ArrowLeft,
  Banknote,
  Building2,
  CalendarDays,
  CircleDot,
  GitBranch,
  Layers,
  StickyNote,
  User,
  UserCircle,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { buildMergeCatalog, buildMergeContext } from "@/lib/email/merge-tags";
import { formatDate, formatMoney, fullName, relativeDate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { getAISettingsStatus } from "@/server/queries/ai";
import {
  listOrganizationOptions,
  listPersonOptions,
} from "@/server/queries/contacts";
import { listAllCustomFieldDefs } from "@/server/queries/custom-fields";
import {
  getDeal,
  listPipelines,
  listStagesByPipeline,
} from "@/server/queries/deals";
import { listEntityThreads } from "@/server/queries/email-threads";
import { listEmailTemplates } from "@/server/queries/email-templates";
import { getGmailConnectionStatus } from "@/server/queries/gmail";
import { ActivitiesPanel } from "@/components/activities/activities-panel";
import { AIHistorySummaryPanel } from "@/components/ai/ai-history-summary-panel";
import { AINextActionPanel } from "@/components/ai/ai-next-action-panel";
import { DealActions } from "@/components/deals/deal-actions";
import { DealParticipants } from "@/components/deals/deal-participants";
import { EmailComposerButton } from "@/components/email/email-composer-button";
import { EmailThreadsPanel } from "@/components/email/email-threads-panel";
import { NoteComposer } from "@/components/note-composer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Negocio" };

const statusMeta: Record<string, { label: string; className: string }> = {
  open: { label: "Abierto", className: "" },
  won: {
    label: "Ganado",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  lost: { label: "Perdido", className: "bg-destructive/10 text-destructive" },
};

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [
    deal,
    pipelines,
    stagesByPipeline,
    persons,
    organizations,
    user,
    emailThreads,
    customFieldDefs,
    emailTemplates,
    gmailStatus,
    aiStatus,
  ] = await Promise.all([
    getDeal(id),
    listPipelines(),
    listStagesByPipeline(),
    listPersonOptions(),
    listOrganizationOptions(),
    requireUser(),
    listEntityThreads({ dealId: id }),
    listAllCustomFieldDefs(),
    listEmailTemplates(),
    getGmailConnectionStatus(),
    getAISettingsStatus(),
  ]);

  if (!deal) notFound();

  const status = statusMeta[deal.status] ?? statusMeta.open!;
  const ownerName = user.name ?? user.email ?? "—";
  const personName = deal.person
    ? fullName(deal.person.firstName, deal.person.lastName)
    : null;
  const mergeCatalog = buildMergeCatalog(
    customFieldDefs.person,
    customFieldDefs.organization,
    Boolean(deal.organization),
  );
  const emailRecipients = deal.person?.email
    ? [
        {
          id: deal.person.id,
          email: deal.person.email,
          name: personName ?? deal.person.email,
          personId: deal.person.id,
          orgId: deal.orgId ?? undefined,
          dealId: deal.id,
          context: buildMergeContext(
            deal.person,
            deal.organization,
            customFieldDefs.person,
            customFieldDefs.organization,
          ),
        },
      ]
    : [];

  const notesTimeline = deal.notes
    .map((n) => ({ id: n.id, at: n.createdAt, text: n.body }))
    .sort((a, b) => b.at.getTime() - a.at.getTime());

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" render={<Link href="/deals" />}>
          <ArrowLeft />
        </Button>
        <span className="text-muted-foreground text-sm">Negocios</span>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">
              {deal.title}
            </h2>
            <Badge variant="secondary" className={status.className}>
              {status.label}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            <span className="text-foreground text-base font-semibold tabular-nums">
              {formatMoney(deal.value, deal.currency)}
            </span>{" "}
            · {deal.pipeline?.name} → {deal.stage?.name}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <EmailComposerButton
            recipients={emailRecipients}
            catalog={mergeCatalog}
            templates={emailTemplates}
            gmailReady={gmailStatus.ready}
            aiStatus={aiStatus}
          />
          <DealActions
            status={deal.status}
            pipelines={pipelines}
            stagesByPipeline={stagesByPipeline}
            persons={persons}
            organizations={organizations}
            deal={{
              id: deal.id,
              title: deal.title,
              value: deal.value,
              currency: deal.currency,
              pipelineId: deal.pipelineId,
              stageId: deal.stageId,
              personId: deal.personId,
              orgId: deal.orgId,
              expectedCloseDate: deal.expectedCloseDate,
            }}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Detalles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <InfoRow icon={Banknote} label="Valor">
              {formatMoney(deal.value, deal.currency)}
            </InfoRow>
            <InfoRow icon={Layers} label="Etapa">
              {deal.stage?.name ?? "—"}
              {deal.stage ? (
                <span className="text-muted-foreground">
                  {" "}
                  · {deal.stage.probability}%
                </span>
              ) : null}
            </InfoRow>
            <InfoRow icon={GitBranch} label="Embudo">
              {deal.pipeline?.name ?? "—"}
            </InfoRow>
            <InfoRow icon={User} label="Contacto">
              {deal.person ? (
                <Link
                  className="hover:text-foreground underline-offset-2 hover:underline"
                  href={`/contacts/${deal.person.id}`}
                >
                  {personName}
                </Link>
              ) : (
                "—"
              )}
            </InfoRow>
            <InfoRow icon={Building2} label="Empresa">
              {deal.organization ? (
                <Link
                  className="hover:text-foreground underline-offset-2 hover:underline"
                  href={`/organizations/${deal.organization.id}`}
                >
                  {deal.organization.name}
                </Link>
              ) : (
                "—"
              )}
            </InfoRow>
            <InfoRow icon={UserCircle} label="Propietario">
              {ownerName}
            </InfoRow>
            <InfoRow icon={CalendarDays} label="Cierre previsto">
              {formatDate(deal.expectedCloseDate)}
            </InfoRow>
            <InfoRow icon={CircleDot} label="Estado">
              <Badge variant="secondary" className={status.className}>
                {status.label}
              </Badge>
            </InfoRow>
            {deal.status === "lost" && deal.lostReason ? (
              <InfoRow icon={CircleDot} label="Motivo de pérdida">
                {deal.lostReason}
              </InfoRow>
            ) : null}
            <InfoRow icon={CalendarDays} label="Creado">
              {formatDate(deal.createdAt)}
            </InfoRow>
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <AIHistorySummaryPanel
            aiStatus={aiStatus}
            entityId={deal.id}
            entityType="deal"
          />

          <AINextActionPanel
            aiStatus={aiStatus}
            dealId={deal.id}
            initialAction={
              deal.nextBestAction
                ? {
                    ...deal.nextBestAction,
                    generatedAt: deal.nextBestActionAt
                      ? deal.nextBestActionAt.toISOString()
                      : null,
                  }
                : null
            }
          />

          <DealParticipants
            dealId={deal.id}
            participants={deal.contacts}
            personOptions={persons}
          />

          <ActivitiesPanel
            activities={deal.activities}
            lockedDealId={deal.id}
          />

          <EmailThreadsPanel threads={emailThreads} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <NoteComposer dealId={deal.id} />

              {notesTimeline.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  Aún no hay notas. Añade una para empezar.
                </p>
              ) : (
                <ol className="space-y-4">
                  {notesTimeline.map((event) => (
                    <li key={event.id} className="flex gap-3">
                      <div className="bg-muted text-muted-foreground mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full">
                        <StickyNote className="size-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm break-words whitespace-pre-wrap">
                          {event.text}
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {relativeDate(event.at)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Banknote;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs">{label}</p>
        <div className="font-medium break-words">{children}</div>
      </div>
    </div>
  );
}
