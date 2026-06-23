import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { ContactsView } from "@/components/contacts/contacts-view";
import { decodeContactFilterParams } from "@/lib/contact-filters";
import { listOrganizationOptions, listPersons } from "@/server/queries/contacts";
import { listCustomFieldDefs } from "@/server/queries/custom-fields";
import { getLabelsForPersons, listLabels } from "@/server/queries/labels";
import { listSavedViews } from "@/server/queries/saved-views";

export const metadata: Metadata = { title: "Contactos" };

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{
    filter?: string | string[];
    label?: string;
    q?: string;
    sort?: string;
  }>;
}) {
  const { filter, label, q, sort } = await searchParams;
  const query = q ?? "";
  const labelId = label ?? "";
  const sortKey = sort ?? "";

  const [organizations, allLabels, customFieldDefs, savedViews] =
    await Promise.all([
      listOrganizationOptions(),
      listLabels(),
      listCustomFieldDefs("person"),
      listSavedViews("person"),
    ]);

  const conditions = decodeContactFilterParams(filter, customFieldDefs);
  const people = await listPersons({
    conditions,
    labelId: labelId || undefined,
    search: query,
    sort: sortKey || undefined,
  });

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
        conditions={conditions}
        savedViews={savedViews}
        customFieldDefs={customFieldDefs}
      />
    </>
  );
}
