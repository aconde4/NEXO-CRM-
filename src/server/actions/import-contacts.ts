"use server";

import { randomUUID } from "node:crypto";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { sanitizeCustomFields } from "@/lib/custom-fields";
import { requireUser } from "@/lib/session";
import {
  MAX_IMPORT_ROWS,
  importOptionsSchema,
  importRowSchema,
  type ImportOptions,
  type ImportRow,
} from "@/lib/validations/import";
import { db } from "@/server/db";
import { listCustomFieldDefs } from "@/server/queries/custom-fields";
import { activityLog, organizations, persons } from "@/server/db/schema";

export type RawImportRow = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  title?: string;
  orgName?: string;
  source?: string;
  campaign?: string;
  customFields?: Record<string, unknown>;
};

export type ImportSummary = {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
};

function clean(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v ? v : undefined;
}

function isEmptyRow(raw: RawImportRow): boolean {
  const { customFields, ...rest } = raw;
  const hasBuiltin = Object.values(rest).some((v) => v && v.trim());
  const hasCustom = customFields
    ? Object.values(customFields).some((v) => v != null && String(v).trim())
    : false;
  return !hasBuiltin && !hasCustom;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function importContacts(
  rawRows: RawImportRow[],
  rawOptions: ImportOptions,
): Promise<ImportSummary> {
  const user = await requireUser();
  const options = importOptionsSchema.parse(rawOptions);
  const customDefs = await listCustomFieldDefs("person");

  if (rawRows.length > MAX_IMPORT_ROWS) {
    throw new Error(
      `Demasiadas filas (${rawRows.length}). El máximo por importación es ${MAX_IMPORT_ROWS}.`,
    );
  }

  const errors: { row: number; message: string }[] = [];
  const valid: { data: ImportRow; custom: Record<string, unknown> }[] = [];

  rawRows.forEach((raw, i) => {
    // Nº de fila para el usuario: +1 cabecera, +1 base-1.
    const rowNum = i + 2;
    if (isEmptyRow(raw)) return; // fila vacía → se ignora en silencio

    const candidate = {
      firstName: clean(raw.firstName),
      lastName: clean(raw.lastName),
      email: clean(raw.email),
      phone: clean(raw.phone),
      title: clean(raw.title),
      orgName: clean(raw.orgName),
      source: clean(raw.source),
      campaign: clean(raw.campaign),
    };
    const parsed = importRowSchema.safeParse(candidate);
    if (!parsed.success) {
      errors.push({
        row: rowNum,
        message: parsed.error.issues[0]?.message ?? "Fila no válida",
      });
      return;
    }
    valid.push({
      data: parsed.data,
      custom: sanitizeCustomFields(customDefs, raw.customFields),
    });
  });

  // Emails existentes (para dedupe contra la BD).
  const existingPersons = await db
    .select({
      id: persons.id,
      email: persons.email,
      customFields: persons.customFields,
    })
    .from(persons)
    .where(
      and(
        eq(persons.ownerId, user.id),
        isNull(persons.deletedAt),
        isNotNull(persons.email),
      ),
    );
  const emailToExisting = new Map<
    string,
    { id: string; customFields: Record<string, unknown> }
  >();
  for (const p of existingPersons) {
    if (p.email)
      emailToExisting.set(p.email.toLowerCase(), {
        id: p.id,
        customFields: p.customFields ?? {},
      });
  }

  // Empresas existentes + creación al vuelo de las que falten.
  const existingOrgs = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(
      and(eq(organizations.ownerId, user.id), isNull(organizations.deletedAt)),
    );
  const orgByName = new Map<string, string>();
  for (const o of existingOrgs) orgByName.set(o.name.toLowerCase(), o.id);

  const newOrgNames = new Map<string, string>(); // lower → casing original
  for (const { data } of valid) {
    if (data.orgName && !orgByName.has(data.orgName.toLowerCase())) {
      newOrgNames.set(data.orgName.toLowerCase(), data.orgName);
    }
  }
  if (newOrgNames.size > 0) {
    const created = await db
      .insert(organizations)
      .values([...newOrgNames.values()].map((name) => ({ name, ownerId: user.id })))
      .returning({ id: organizations.id, name: organizations.name });
    for (const o of created) orgByName.set(o.name.toLowerCase(), o.id);
  }

  // Partición en crear / actualizar / omitir.
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const seenEmails = new Set<string>();
  const toInsert: (typeof persons.$inferInsert)[] = [];

  for (const { data: row, custom } of valid) {
    const orgId = row.orgName
      ? (orgByName.get(row.orgName.toLowerCase()) ?? null)
      : null;
    const emailLower = row.email?.toLowerCase();
    const hasCustom = Object.keys(custom).length > 0;

    if (emailLower) {
      if (seenEmails.has(emailLower)) {
        skipped++; // duplicado dentro del propio archivo
        continue;
      }
      seenEmails.add(emailLower);

      const existing = emailToExisting.get(emailLower);
      if (existing) {
        if (options.dedupe === "update") {
          await db
            .update(persons)
            .set({
              firstName: row.firstName,
              ...(row.lastName !== undefined ? { lastName: row.lastName } : {}),
              ...(row.phone !== undefined ? { phone: row.phone } : {}),
              ...(row.title !== undefined ? { title: row.title } : {}),
              ...(row.source !== undefined ? { source: row.source } : {}),
              ...(row.campaign !== undefined ? { campaign: row.campaign } : {}),
              ...(orgId !== null ? { orgId } : {}),
              ...(hasCustom
                ? { customFields: { ...existing.customFields, ...custom } }
                : {}),
            })
            .where(and(eq(persons.id, existing.id), eq(persons.ownerId, user.id)));
          updated++;
        } else {
          skipped++;
        }
        continue;
      }
    }

    toInsert.push({
      firstName: row.firstName,
      lastName: row.lastName ?? null,
      email: row.email ?? null,
      phone: row.phone ?? null,
      title: row.title ?? null,
      orgId,
      source: row.source ?? null,
      campaign: row.campaign ?? null,
      customFields: custom,
      ownerId: user.id,
    });
  }

  for (const batch of chunk(toInsert, 500)) {
    await db.insert(persons).values(batch);
    created += batch.length;
  }

  await db.insert(activityLog).values({
    actorId: user.id,
    verb: "imported",
    entityType: "import",
    entityId: randomUUID(),
    payload: {
      created,
      updated,
      skipped,
      errors: errors.length,
      newOrganizations: newOrgNames.size,
    },
  });

  revalidatePath("/contacts");
  revalidatePath("/organizations");
  revalidatePath("/dashboard");

  return { total: rawRows.length, created, updated, skipped, errors };
}
