import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Mail,
  Megaphone,
  MessageSquare,
  Phone,
  StickyNote,
  Tag,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { buildMergeCatalog, buildMergeContext } from "@/lib/email/merge-tags";
import { fullName, formatDate, relativeDate } from "@/lib/format";
import { getPerson, listOrganizationOptions } from "@/server/queries/contacts";
import { getAISettingsStatus } from "@/server/queries/ai";
import { listAllCustomFieldDefs } from "@/server/queries/custom-fields";
import { listEntityThreads } from "@/server/queries/email-threads";
import { listEmailTemplates } from "@/server/queries/email-templates";
import { listFilesFor } from "@/server/queries/files";
import { getGmailConnectionStatus } from "@/server/queries/gmail";
import { getLabelsForPerson, listLabels } from "@/server/queries/labels";
import { listSequenceEnrollmentOptions } from "@/server/queries/sequences";
import { isStorageConfigured } from "@/server/storage";
import { ActivitiesPanel } from "@/components/activities/activities-panel";
import { AIHistorySummaryPanel } from "@/components/ai/ai-history-summary-panel";
import { AttachmentsPanel } from "@/components/attachments/attachments-panel";
import { EmailThreadsPanel } from "@/components/email/email-threads-panel";
import { EmailComposerButton } from "@/components/email/email-composer-button";
import { EditContactButton } from "@/components/contacts/edit-contact-button";
import { CustomFieldsList } from "@/components/custom-fields/custom-fields-list";
import { EntityAvatar } from "@/components/entity-avatar";
import { LabelPicker } from "@/components/contacts/label-picker";
import { NoteComposer } from "@/components/note-composer";
import { SequenceEnrollmentButton } from "@/components/sequences/sequence-enrollment-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Contacto" };

const marketingLabels: Record<string, string> = {
  subscribed: "Suscrito",
  unsubscribed: "Baja",
  bounced: "Rebotado",
  complained: "Queja",
};

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [
    person,
    organizations,
    allLabels,
    customFieldDefs,
    attachments,
    emailThreads,
    emailTemplates,
    gmailStatus,
    aiStatus,
    sequenceOptions,
  ] = await Promise.all([
    getPerson(id),
    listOrganizationOptions(),
    listLabels(),
    listAllCustomFieldDefs(),
    listFilesFor("person", id),
    listEntityThreads({ personId: id }),
    listEmailTemplates(),
    getGmailConnectionStatus(),
    getAISettingsStatus(),
    listSequenceEnrollmentOptions(),
  ]);

  if (!person) notFound();
  const storageEnabled = isStorageConfigured();
  const personCustomFieldDefs = customFieldDefs.person;
  const organizationCustomFieldDefs = customFieldDefs.organization;

  const assignedLabels = await getLabelsForPerson(person.id);
  const name = fullName(person.firstName, person.lastName);
  const mergeCatalog = buildMergeCatalog(
    personCustomFieldDefs,
    organizationCustomFieldDefs,
    Boolean(person.organization),
  );
  const emailRecipients = person.email
    ? [
        {
          id: person.id,
          email: person.email,
          name,
          personId: person.id,
          orgId: person.orgId ?? undefined,
          context: buildMergeContext(
            person,
            person.organization,
            personCustomFieldDefs,
            organizationCustomFieldDefs,
          ),
        },
      ]
    : [];

  const notesTimeline = person.notes
    .map((n) => ({ id: n.id, at: n.createdAt, text: n.body }))
    .sort((a, b) => b.at.getTime() - a.at.getTime());

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          render={<Link href="/contacts" />}
        >
          <ArrowLeft />
        </Button>
        <span className="text-muted-foreground text-sm">Contactos</span>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <EntityAvatar name={name} className="size-12 text-base" />
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">{name}</h2>
            <p className="text-muted-foreground text-sm">
              {[person.title, person.organization?.name]
                .filter(Boolean)
                .join(" · ") || "Sin cargo ni empresa"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SequenceEnrollmentButton
            sequenceOptions={sequenceOptions}
            personOptions={[]}
            segmentOptions={[]}
            lockedPerson={{ id: person.id, name, email: person.email }}
          />
          <EmailComposerButton
            recipients={emailRecipients}
            catalog={mergeCatalog}
            templates={emailTemplates}
            gmailReady={gmailStatus.ready}
            aiStatus={aiStatus}
          />
          <EditContactButton
            organizations={organizations}
            customFieldDefs={personCustomFieldDefs}
            contact={{
              id: person.id,
              firstName: person.firstName,
              lastName: person.lastName,
              email: person.email,
              phone: person.phone,
              title: person.title,
              orgId: person.orgId,
              source: person.source,
              campaign: person.campaign,
              customFields: person.customFields,
            }}
          />
        </div>
      </div>

      <LabelPicker
        personId={person.id}
        allLabels={allLabels}
        assigned={assignedLabels}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Detalles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <InfoRow icon={Mail} label="Email">
              {person.email ? (
                <a
                  className="hover:text-foreground break-all underline-offset-2 hover:underline"
                  href={`mailto:${person.email}`}
                >
                  {person.email}
                </a>
              ) : (
                "—"
              )}
            </InfoRow>
            <InfoRow icon={Phone} label="Teléfono">
              {person.phone ?? "—"}
            </InfoRow>
            <InfoRow icon={Building2} label="Empresa">
              {person.organization ? (
                <Link
                  className="hover:text-foreground underline-offset-2 hover:underline"
                  href={`/organizations/${person.organization.id}`}
                >
                  {person.organization.name}
                </Link>
              ) : (
                "—"
              )}
            </InfoRow>
            <InfoRow icon={Tag} label="Origen">
              {person.source ?? "—"}
            </InfoRow>
            <InfoRow icon={Megaphone} label="Campaña">
              {person.campaign ?? "—"}
            </InfoRow>
            <InfoRow icon={MessageSquare} label="Marketing">
              <Badge variant="secondary">
                {marketingLabels[person.marketingStatus] ??
                  person.marketingStatus}
              </Badge>
            </InfoRow>
            <InfoRow icon={CalendarDays} label="Creado">
              {formatDate(person.createdAt)}
            </InfoRow>

            {personCustomFieldDefs.length > 0 ? (
              <div className="space-y-3 border-t pt-3">
                <CustomFieldsList
                  defs={personCustomFieldDefs}
                  values={person.customFields}
                />
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <AIHistorySummaryPanel
            aiStatus={aiStatus}
            entityId={person.id}
            entityType="person"
          />

          <ActivitiesPanel
            activities={person.activities}
            lockedPersonId={person.id}
          />

          <AttachmentsPanel
            entityType="person"
            entityId={person.id}
            files={attachments}
            storageEnabled={storageEnabled}
          />

          <EmailThreadsPanel threads={emailThreads} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <NoteComposer personId={person.id} />

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
  icon: typeof Mail;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs">{label}</p>
        <div className="font-medium">{children}</div>
      </div>
    </div>
  );
}
