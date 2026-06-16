import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { ContactsView } from "@/components/contacts/contacts-view";
import { listOrganizationOptions, listPersons } from "@/server/queries/contacts";

export const metadata: Metadata = { title: "Contactos" };

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q ?? "";

  const [contacts, organizations] = await Promise.all([
    listPersons(query),
    listOrganizationOptions(),
  ]);

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
        query={query}
      />
    </>
  );
}
