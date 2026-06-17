import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { ContactsView } from "@/components/contacts/contacts-view";
import { listOrganizationOptions, listPersons } from "@/server/queries/contacts";
import { getLabelsForPersons, listLabels } from "@/server/queries/labels";

export const metadata: Metadata = { title: "Contactos" };

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; label?: string }>;
}) {
  const { q, label } = await searchParams;
  const query = q ?? "";
  const labelId = label ?? "";

  const [people, organizations, allLabels] = await Promise.all([
    listPersons(query, labelId || undefined),
    listOrganizationOptions(),
    listLabels(),
  ]);

  const labelMap = await getLabelsForPersons(people.map((p) => p.id));
  const contacts = people.map((p) => ({ ...p, labels: labelMap[p.id] ?? [] }));

  return (
    <>
      <PageHeader
        title="Contactos"
        description={`${contacts.length} ${
          contacts.length === 1 ? "contacto" : "contactos"
        } en tu CRM.`}
      />
      <ContactsView
        contacts={contacts}
        organizations={organizations}
        labels={allLabels}
        query={query}
        activeLabel={labelId}
      />
    </>
  );
}
