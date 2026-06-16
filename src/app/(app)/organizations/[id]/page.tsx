import {
  ArrowLeft,
  CalendarDays,
  Globe,
  MapPin,
  Phone,
  Tag,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { fullName, formatDate } from "@/lib/format";
import { getOrganization } from "@/server/queries/contacts";
import { EditOrganizationButton } from "@/components/organizations/edit-organization-button";
import { EntityAvatar } from "@/components/entity-avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Empresa" };

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const organization = await getOrganization(id);
  if (!organization) notFound();

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          render={<Link href="/organizations" />}
        >
          <ArrowLeft />
        </Button>
        <span className="text-muted-foreground text-sm">Empresas</span>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <EntityAvatar name={organization.name} square className="size-12 text-base" />
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              {organization.name}
            </h2>
            <p className="text-muted-foreground text-sm">
              {organization.industry ?? "Sin sector"}
            </p>
          </div>
        </div>
        <EditOrganizationButton
          organization={{
            id: organization.id,
            name: organization.name,
            domain: organization.domain,
            website: organization.website,
            phone: organization.phone,
            industry: organization.industry,
            size: organization.size,
            address: organization.address,
          }}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Detalles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <InfoRow icon={Globe} label="Sitio web">
              {organization.website ? (
                <a
                  className="hover:text-foreground break-all underline-offset-2 hover:underline"
                  href={organization.website}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {organization.website}
                </a>
              ) : (
                "—"
              )}
            </InfoRow>
            <InfoRow icon={Tag} label="Dominio">
              {organization.domain ?? "—"}
            </InfoRow>
            <InfoRow icon={Phone} label="Teléfono">
              {organization.phone ?? "—"}
            </InfoRow>
            <InfoRow icon={Users} label="Tamaño">
              {organization.size ?? "—"}
            </InfoRow>
            <InfoRow icon={MapPin} label="Dirección">
              {organization.address ?? "—"}
            </InfoRow>
            <InfoRow icon={CalendarDays} label="Creada">
              {formatDate(organization.createdAt)}
            </InfoRow>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              Contactos ({organization.persons.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {organization.persons.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                Esta empresa aún no tiene contactos asociados.
              </p>
            ) : (
              <ul className="divide-y">
                {organization.persons.map((person) => (
                  <li key={person.id}>
                    <Link
                      href={`/contacts/${person.id}`}
                      className="hover:bg-muted/40 -mx-2 flex items-center gap-3 rounded-md px-2 py-2 transition-colors"
                    >
                      <EntityAvatar
                        name={fullName(person.firstName, person.lastName)}
                        className="size-8 text-[10px]"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {fullName(person.firstName, person.lastName)}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {person.title ?? person.email ?? "—"}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
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
  icon: typeof Globe;
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
