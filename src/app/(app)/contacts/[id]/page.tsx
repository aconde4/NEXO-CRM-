import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Mail,
  MessageSquare,
  Phone,
  StickyNote,
  Tag,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { fullName, formatDate, relativeDate } from "@/lib/format";
import { getPerson, listOrganizationOptions } from "@/server/queries/contacts";
import { EditContactButton } from "@/components/contacts/edit-contact-button";
import { EntityAvatar } from "@/components/entity-avatar";
import { NoteComposer } from "@/components/note-composer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
  const [person, organizations] = await Promise.all([
    getPerson(id),
    listOrganizationOptions(),
  ]);

  if (!person) notFound();

  const name = fullName(person.firstName, person.lastName);

  const events = [
    ...person.notes.map((n) => ({
      kind: "note" as const,
      id: n.id,
      at: n.createdAt,
      text: n.body,
    })),
    ...person.activities.map((a) => ({
      kind: "activity" as const,
      id: a.id,
      at: a.createdAt,
      text: a.subject,
      done: a.done,
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" render={<Link href="/contacts" />}>
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
        <EditContactButton
          organizations={organizations}
          contact={{
            id: person.id,
            firstName: person.firstName,
            lastName: person.lastName,
            email: person.email,
            phone: person.phone,
            title: person.title,
            orgId: person.orgId,
            source: person.source,
          }}
        />
      </div>

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
            <InfoRow icon={MessageSquare} label="Marketing">
              <Badge variant="secondary">
                {marketingLabels[person.marketingStatus] ??
                  person.marketingStatus}
              </Badge>
            </InfoRow>
            <InfoRow icon={CalendarDays} label="Creado">
              {formatDate(person.createdAt)}
            </InfoRow>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Actividad</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <NoteComposer personId={person.id} />

            {events.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                Aún no hay actividad. Añade una nota para empezar.
              </p>
            ) : (
              <ol className="space-y-4">
                {events.map((event) => (
                  <li key={`${event.kind}-${event.id}`} className="flex gap-3">
                    <div className="bg-muted text-muted-foreground mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full">
                      {event.kind === "note" ? (
                        <StickyNote className="size-3.5" />
                      ) : (
                        <MessageSquare className="size-3.5" />
                      )}
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
