"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { sanitizeCustomFields } from "@/lib/custom-fields";
import { requireUser } from "@/lib/session";
import {
  noteFormSchema,
  nullify,
  organizationFormSchema,
  personFormSchema,
  type OrganizationFormValues,
  type PersonFormValues,
} from "@/lib/validations/contact";
import { db } from "@/server/db";
import { listCustomFieldDefs } from "@/server/queries/custom-fields";
import { activityLog, notes, organizations, persons } from "@/server/db/schema";
import {
  createFieldChangedEvents,
  diffAutomationFields,
  emitAutomationEventsSafely,
} from "@/server/services/automation-runner";

type CustomFieldsInput = Record<string, unknown> | undefined;
type AutomationRecord = Record<string, unknown>;

const PERSON_AUTOMATION_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "title",
  "orgId",
  "source",
  "marketingStatus",
  "customFields",
];

const ORGANIZATION_AUTOMATION_FIELDS = [
  "name",
  "tradeName",
  "domain",
  "website",
  "phone",
  "industry",
  "size",
  "address",
  "customFields",
];

async function logEvent(
  actorId: string,
  verb: string,
  entityType: string,
  entityId: string,
  payload?: Record<string, unknown>,
) {
  await db
    .insert(activityLog)
    .values({ actorId, verb, entityType, entityId, payload });
}

function personSnapshot(row: {
  customFields: Record<string, unknown>;
  email: string | null;
  firstName: string;
  lastName: string | null;
  marketingStatus: string;
  orgId: string | null;
  phone: string | null;
  source: string | null;
  title: string | null;
}): AutomationRecord {
  return {
    customFields: row.customFields,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    marketingStatus: row.marketingStatus,
    orgId: row.orgId,
    phone: row.phone,
    source: row.source,
    title: row.title,
  };
}

function organizationSnapshot(row: {
  address: string | null;
  customFields: Record<string, unknown>;
  domain: string | null;
  industry: string | null;
  name: string;
  phone: string | null;
  size: string | null;
  tradeName: string | null;
  website: string | null;
}): AutomationRecord {
  return {
    address: row.address,
    customFields: row.customFields,
    domain: row.domain,
    industry: row.industry,
    name: row.name,
    phone: row.phone,
    size: row.size,
    tradeName: row.tradeName,
    website: row.website,
  };
}

// --- Contactos --------------------------------------------------------------
export async function createPerson(
  raw: PersonFormValues,
  customFields?: CustomFieldsInput,
) {
  const user = await requireUser();
  const data = personFormSchema.parse(raw);
  const defs = await listCustomFieldDefs("person");
  const customFieldsValue = sanitizeCustomFields(defs, customFields);
  const values = {
    customFields: customFieldsValue,
    email: nullify(data.email),
    firstName: data.firstName.trim(),
    lastName: nullify(data.lastName),
    orgId: nullify(data.orgId),
    phone: nullify(data.phone),
    source: nullify(data.source),
    title: nullify(data.title),
  };

  const [row] = await db
    .insert(persons)
    .values({
      ...values,
      ownerId: user.id,
    })
    .returning({ id: persons.id });

  if (!row) throw new Error("No se pudo crear el contacto");
  await logEvent(user.id, "created", "person", row.id, {
    name: `${data.firstName} ${data.lastName ?? ""}`.trim(),
  });
  await emitAutomationEventsSafely([
    {
      entityId: row.id,
      entityType: "person",
      ownerId: user.id,
      payload: {
        record: personSnapshot({ ...values, marketingStatus: "subscribed" }),
      },
      type: "record_created",
    },
  ]);
  revalidatePath("/contacts");
  return { id: row.id };
}

export async function updatePerson(
  id: string,
  raw: PersonFormValues,
  customFields?: CustomFieldsInput,
) {
  const user = await requireUser();
  const data = personFormSchema.parse(raw);
  const defs = await listCustomFieldDefs("person");
  const customFieldsValue = sanitizeCustomFields(defs, customFields);

  const [current] = await db
    .select({
      customFields: persons.customFields,
      email: persons.email,
      firstName: persons.firstName,
      lastName: persons.lastName,
      marketingStatus: persons.marketingStatus,
      orgId: persons.orgId,
      phone: persons.phone,
      source: persons.source,
      title: persons.title,
    })
    .from(persons)
    .where(and(eq(persons.id, id), eq(persons.ownerId, user.id)))
    .limit(1);

  const values = {
    customFields: customFieldsValue,
    email: nullify(data.email),
    firstName: data.firstName.trim(),
    lastName: nullify(data.lastName),
    orgId: nullify(data.orgId),
    phone: nullify(data.phone),
    source: nullify(data.source),
    title: nullify(data.title),
  };

  await db
    .update(persons)
    .set(values)
    .where(and(eq(persons.id, id), eq(persons.ownerId, user.id)));

  await logEvent(user.id, "updated", "person", id);
  if (current) {
    const before = personSnapshot(current);
    const after = personSnapshot({
      ...values,
      marketingStatus: current.marketingStatus,
    });
    const changes = diffAutomationFields(
      before,
      after,
      PERSON_AUTOMATION_FIELDS,
    );
    await emitAutomationEventsSafely([
      {
        entityId: id,
        entityType: "person",
        ownerId: user.id,
        payload: { after, before },
        type: "record_updated",
      },
      ...createFieldChangedEvents({
        changes,
        entityId: id,
        entityType: "person",
        ownerId: user.id,
      }),
    ]);
  }
  revalidatePath("/contacts");
  revalidatePath(`/contacts/${id}`);
  return { id };
}

export async function deletePerson(id: string) {
  const user = await requireUser();
  const [current] = await db
    .select({
      customFields: persons.customFields,
      email: persons.email,
      firstName: persons.firstName,
      lastName: persons.lastName,
      marketingStatus: persons.marketingStatus,
      orgId: persons.orgId,
      phone: persons.phone,
      source: persons.source,
      title: persons.title,
    })
    .from(persons)
    .where(and(eq(persons.id, id), eq(persons.ownerId, user.id)))
    .limit(1);
  const deletedAt = new Date();
  await db
    .update(persons)
    .set({ deletedAt })
    .where(and(eq(persons.id, id), eq(persons.ownerId, user.id)));
  await logEvent(user.id, "deleted", "person", id);
  if (current) {
    await emitAutomationEventsSafely([
      {
        entityId: id,
        entityType: "person",
        ownerId: user.id,
        payload: {
          deletedAt: deletedAt.toISOString(),
          previous: personSnapshot(current),
        },
        type: "record_deleted",
      },
    ]);
  }
  revalidatePath("/contacts");
  return { id };
}

// --- Empresas ---------------------------------------------------------------
export async function createOrganization(
  raw: OrganizationFormValues,
  customFields?: CustomFieldsInput,
) {
  const user = await requireUser();
  const data = organizationFormSchema.parse(raw);
  const defs = await listCustomFieldDefs("organization");
  const customFieldsValue = sanitizeCustomFields(defs, customFields);
  const values = {
    address: nullify(data.address),
    customFields: customFieldsValue,
    domain: nullify(data.domain),
    industry: nullify(data.industry),
    name: data.name.trim(),
    phone: nullify(data.phone),
    size: nullify(data.size),
    tradeName: nullify(data.tradeName),
    website: nullify(data.website),
  };

  const [row] = await db
    .insert(organizations)
    .values({
      ...values,
      ownerId: user.id,
    })
    .returning({ id: organizations.id });

  if (!row) throw new Error("No se pudo crear la empresa");
  await logEvent(user.id, "created", "organization", row.id, {
    name: data.name,
  });
  await emitAutomationEventsSafely([
    {
      entityId: row.id,
      entityType: "organization",
      ownerId: user.id,
      payload: { record: organizationSnapshot(values) },
      type: "record_created",
    },
  ]);
  revalidatePath("/organizations");
  return { id: row.id };
}

export async function updateOrganization(
  id: string,
  raw: OrganizationFormValues,
  customFields?: CustomFieldsInput,
) {
  const user = await requireUser();
  const data = organizationFormSchema.parse(raw);
  const defs = await listCustomFieldDefs("organization");
  const customFieldsValue = sanitizeCustomFields(defs, customFields);

  const [current] = await db
    .select({
      address: organizations.address,
      customFields: organizations.customFields,
      domain: organizations.domain,
      industry: organizations.industry,
      name: organizations.name,
      phone: organizations.phone,
      size: organizations.size,
      tradeName: organizations.tradeName,
      website: organizations.website,
    })
    .from(organizations)
    .where(and(eq(organizations.id, id), eq(organizations.ownerId, user.id)))
    .limit(1);

  const values = {
    address: nullify(data.address),
    customFields: customFieldsValue,
    domain: nullify(data.domain),
    industry: nullify(data.industry),
    name: data.name.trim(),
    phone: nullify(data.phone),
    size: nullify(data.size),
    tradeName: nullify(data.tradeName),
    website: nullify(data.website),
  };

  await db
    .update(organizations)
    .set(values)
    .where(and(eq(organizations.id, id), eq(organizations.ownerId, user.id)));

  await logEvent(user.id, "updated", "organization", id);
  if (current) {
    const before = organizationSnapshot(current);
    const after = organizationSnapshot(values);
    const changes = diffAutomationFields(
      before,
      after,
      ORGANIZATION_AUTOMATION_FIELDS,
    );
    await emitAutomationEventsSafely([
      {
        entityId: id,
        entityType: "organization",
        ownerId: user.id,
        payload: { after, before },
        type: "record_updated",
      },
      ...createFieldChangedEvents({
        changes,
        entityId: id,
        entityType: "organization",
        ownerId: user.id,
      }),
    ]);
  }
  revalidatePath("/organizations");
  revalidatePath(`/organizations/${id}`);
  return { id };
}

export async function deleteOrganization(id: string) {
  const user = await requireUser();
  const [current] = await db
    .select({
      address: organizations.address,
      customFields: organizations.customFields,
      domain: organizations.domain,
      industry: organizations.industry,
      name: organizations.name,
      phone: organizations.phone,
      size: organizations.size,
      tradeName: organizations.tradeName,
      website: organizations.website,
    })
    .from(organizations)
    .where(and(eq(organizations.id, id), eq(organizations.ownerId, user.id)))
    .limit(1);
  const deletedAt = new Date();
  await db
    .update(organizations)
    .set({ deletedAt })
    .where(and(eq(organizations.id, id), eq(organizations.ownerId, user.id)));
  await logEvent(user.id, "deleted", "organization", id);
  if (current) {
    await emitAutomationEventsSafely([
      {
        entityId: id,
        entityType: "organization",
        ownerId: user.id,
        payload: {
          deletedAt: deletedAt.toISOString(),
          previous: organizationSnapshot(current),
        },
        type: "record_deleted",
      },
    ]);
  }
  revalidatePath("/organizations");
  return { id };
}

// --- Notas ------------------------------------------------------------------
export async function createNote(input: {
  body: string;
  personId?: string;
  orgId?: string;
  dealId?: string;
}) {
  const user = await requireUser();
  const { body } = noteFormSchema.parse({ body: input.body });

  await db.insert(notes).values({
    body,
    personId: input.personId ?? null,
    orgId: input.orgId ?? null,
    dealId: input.dealId ?? null,
    ownerId: user.id,
  });

  if (input.personId) {
    await logEvent(user.id, "noted", "person", input.personId);
    revalidatePath(`/contacts/${input.personId}`);
  }
  if (input.orgId) {
    await logEvent(user.id, "noted", "organization", input.orgId);
    revalidatePath(`/organizations/${input.orgId}`);
  }
  if (input.dealId) {
    await logEvent(user.id, "noted", "deal", input.dealId);
    revalidatePath(`/deals/${input.dealId}`);
  }
}
