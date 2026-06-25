import "server-only";

import { and, asc, desc, eq, sql } from "drizzle-orm";

import { requireUser } from "@/lib/session";
import { db } from "@/server/db";
import {
  type FormEmbedSettings,
  type FormFieldDef,
  type FormMapping,
  type FormStatus,
  automations,
  customFieldDefs,
  formSubmissions,
  forms,
} from "@/server/db/schema";

export type FormListItem = {
  id: string;
  name: string;
  description: string;
  status: FormStatus;
  fieldCount: number;
  submissionCount: number;
  updatedAt: string;
};

export type FormDetail = {
  id: string;
  name: string;
  description: string;
  status: FormStatus;
  fields: FormFieldDef[];
  mappings: FormMapping[];
  redirectUrl: string;
  embedSettings: FormEmbedSettings;
  automationId: string | null;
  updatedAt: string;
};

export async function listForms(): Promise<FormListItem[]> {
  const user = await requireUser();
  const [rows, counts] = await Promise.all([
    db
      .select({
        id: forms.id,
        name: forms.name,
        description: forms.description,
        status: forms.status,
        fields: forms.fields,
        updatedAt: forms.updatedAt,
      })
      .from(forms)
      .where(eq(forms.ownerId, user.id))
      .orderBy(desc(forms.updatedAt)),
    db
      .select({
        formId: formSubmissions.formId,
        count: sql<number>`count(*)::int`,
      })
      .from(formSubmissions)
      .where(eq(formSubmissions.ownerId, user.id))
      .groupBy(formSubmissions.formId),
  ]);

  const countByForm = new Map(counts.map((c) => [c.formId, c.count]));

  return rows.map((row) => ({
    description: row.description ?? "",
    fieldCount: row.fields?.length ?? 0,
    id: row.id,
    name: row.name,
    status: row.status,
    submissionCount: countByForm.get(row.id) ?? 0,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function getForm(id: string): Promise<FormDetail | null> {
  const user = await requireUser();
  return getFormForOwner(id, user.id);
}

export async function getFormForOwner(
  id: string,
  ownerId: string,
): Promise<FormDetail | null> {
  const [row] = await db
    .select({
      id: forms.id,
      name: forms.name,
      description: forms.description,
      status: forms.status,
      fields: forms.fields,
      mappings: forms.mappings,
      redirectUrl: forms.redirectUrl,
      embedSettings: forms.embedSettings,
      automationId: forms.automationId,
      updatedAt: forms.updatedAt,
    })
    .from(forms)
    .where(and(eq(forms.id, id), eq(forms.ownerId, ownerId)))
    .limit(1);
  if (!row) return null;

  return {
    automationId: row.automationId,
    description: row.description ?? "",
    embedSettings: row.embedSettings ?? {},
    fields: row.fields ?? [],
    id: row.id,
    mappings: row.mappings ?? [],
    name: row.name,
    redirectUrl: row.redirectUrl ?? "",
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type FormBuilderOption = { id: string; name: string };
export type FormPersonField = { key: string; label: string };
export type FormBuilderOptions = {
  personFields: FormPersonField[];
  automations: FormBuilderOption[];
};

/** Opciones para el constructor: campos personalizados de persona y automatizaciones. */
export async function listFormBuilderOptions(): Promise<FormBuilderOptions> {
  const user = await requireUser();
  const [fieldRows, automationRows] = await Promise.all([
    db
      .select({ key: customFieldDefs.key, label: customFieldDefs.label })
      .from(customFieldDefs)
      .where(
        and(
          eq(customFieldDefs.ownerId, user.id),
          eq(customFieldDefs.entityType, "person"),
        ),
      )
      .orderBy(asc(customFieldDefs.position)),
    db
      .select({ id: automations.id, name: automations.name })
      .from(automations)
      .where(eq(automations.ownerId, user.id))
      .orderBy(asc(automations.name))
      .limit(500),
  ]);

  return {
    automations: automationRows,
    personFields: fieldRows,
  };
}
