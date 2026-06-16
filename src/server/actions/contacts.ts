"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

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
import { activityLog, notes, organizations, persons } from "@/server/db/schema";

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

// --- Contactos --------------------------------------------------------------
export async function createPerson(raw: PersonFormValues) {
  const user = await requireUser();
  const data = personFormSchema.parse(raw);

  const [row] = await db
    .insert(persons)
    .values({
      firstName: data.firstName.trim(),
      lastName: nullify(data.lastName),
      email: nullify(data.email),
      phone: nullify(data.phone),
      title: nullify(data.title),
      orgId: nullify(data.orgId),
      source: nullify(data.source),
      ownerId: user.id,
    })
    .returning({ id: persons.id });

  if (!row) throw new Error("No se pudo crear el contacto");
  await logEvent(user.id, "created", "person", row.id, {
    name: `${data.firstName} ${data.lastName ?? ""}`.trim(),
  });
  revalidatePath("/contacts");
  return { id: row.id };
}

export async function updatePerson(id: string, raw: PersonFormValues) {
  const user = await requireUser();
  const data = personFormSchema.parse(raw);

  await db
    .update(persons)
    .set({
      firstName: data.firstName.trim(),
      lastName: nullify(data.lastName),
      email: nullify(data.email),
      phone: nullify(data.phone),
      title: nullify(data.title),
      orgId: nullify(data.orgId),
      source: nullify(data.source),
    })
    .where(and(eq(persons.id, id), eq(persons.ownerId, user.id)));

  await logEvent(user.id, "updated", "person", id);
  revalidatePath("/contacts");
  revalidatePath(`/contacts/${id}`);
  return { id };
}

export async function deletePerson(id: string) {
  const user = await requireUser();
  await db
    .update(persons)
    .set({ deletedAt: new Date() })
    .where(and(eq(persons.id, id), eq(persons.ownerId, user.id)));
  await logEvent(user.id, "deleted", "person", id);
  revalidatePath("/contacts");
  return { id };
}

// --- Empresas ---------------------------------------------------------------
export async function createOrganization(raw: OrganizationFormValues) {
  const user = await requireUser();
  const data = organizationFormSchema.parse(raw);

  const [row] = await db
    .insert(organizations)
    .values({
      name: data.name.trim(),
      domain: nullify(data.domain),
      website: nullify(data.website),
      phone: nullify(data.phone),
      industry: nullify(data.industry),
      size: nullify(data.size),
      address: nullify(data.address),
      ownerId: user.id,
    })
    .returning({ id: organizations.id });

  if (!row) throw new Error("No se pudo crear la empresa");
  await logEvent(user.id, "created", "organization", row.id, {
    name: data.name,
  });
  revalidatePath("/organizations");
  return { id: row.id };
}

export async function updateOrganization(
  id: string,
  raw: OrganizationFormValues,
) {
  const user = await requireUser();
  const data = organizationFormSchema.parse(raw);

  await db
    .update(organizations)
    .set({
      name: data.name.trim(),
      domain: nullify(data.domain),
      website: nullify(data.website),
      phone: nullify(data.phone),
      industry: nullify(data.industry),
      size: nullify(data.size),
      address: nullify(data.address),
    })
    .where(and(eq(organizations.id, id), eq(organizations.ownerId, user.id)));

  await logEvent(user.id, "updated", "organization", id);
  revalidatePath("/organizations");
  revalidatePath(`/organizations/${id}`);
  return { id };
}

export async function deleteOrganization(id: string) {
  const user = await requireUser();
  await db
    .update(organizations)
    .set({ deletedAt: new Date() })
    .where(and(eq(organizations.id, id), eq(organizations.ownerId, user.id)));
  await logEvent(user.id, "deleted", "organization", id);
  revalidatePath("/organizations");
  return { id };
}

// --- Notas ------------------------------------------------------------------
export async function createNote(input: {
  body: string;
  personId?: string;
  orgId?: string;
}) {
  const user = await requireUser();
  const { body } = noteFormSchema.parse({ body: input.body });

  await db.insert(notes).values({
    body,
    personId: input.personId ?? null,
    orgId: input.orgId ?? null,
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
}
