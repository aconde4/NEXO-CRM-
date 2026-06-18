import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { ContactsView } from "@/components/contacts/contacts-view";
import { listOrganizationOptions, listPersons } from "@/server/queries/contacts";
import { listCustomFieldDefs } from "@/server/queries/custom-fields";
import { getLabelsForPersons, listLabels } from "@/server/queries/labels";
import { listSavedViews } from "@/server/queries/saved-views";

export const metadata: Metadata = { title: "Contactos" };

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; label?: string; sort?: string }>;
}) {
  const { q, label, sort } = await searchParams;
  const query = q ?? "";
  const labelId = label ?? "";
  const sortKey = sort ?? "";

  const [people, organizations, allLabels, customFieldDefs, savedViews] =
    await Promise.all([
      listPersons(query, labelId || undefined, sortKey || undefined),
      listOrganizationOptions(),
      listLabels(),
      listCustomFieldDefs("person"),
      listSavedViews("person"),
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
        sort={sortKey}
        savedViews={savedViews}
        customFieldDefs={customFieldDefs}
      />
    </>
  );
}
