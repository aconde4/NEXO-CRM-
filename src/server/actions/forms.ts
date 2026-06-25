"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  type FormInputValues,
  formInputSchema,
} from "@/lib/validations/form";
import { requireUser } from "@/lib/session";
import { db } from "@/server/db";
import { type FormStatus, automations, forms } from "@/server/db/schema";

function revalidateForms(id?: string) {
  revalidatePath("/forms");
  if (id) revalidatePath(`/forms/${id}`);
}

async function assertOwned(ownerId: string, id: string) {
  const [row] = await db
    .select({ id: forms.id })
    .from(forms)
    .where(and(eq(forms.id, id), eq(forms.ownerId, ownerId)))
    .limit(1);
  if (!row) throw new Error("Formulario no encontrado");
  return row;
}

/** Crea un formulario en borrador y devuelve su id (para abrir el editor). */
export async function createForm(input: { name: string }) {
  const user = await requireUser();
  const name = input.name?.trim();
  if (!name) throw new Error("Ponle un nombre al formulario");

  const [row] = await db
    .insert(forms)
    .values({ name: name.slice(0, 120), ownerId: user.id, status: "draft" })
    .returning({ id: forms.id });
  if (!row) throw new Error("No se pudo crear el formulario");
  revalidateForms(row.id);
  return row;
}

export async function updateForm(id: string, input: FormInputValues) {
  const user = await requireUser();
  await assertOwned(user.id, id);
  const data = formInputSchema.parse(input);

  // Las claves de los campos deben ser únicas dentro del formulario.
  const keys = new Set<string>();
  for (const field of data.fields) {
    if (keys.has(field.key)) {
      throw new Error(`Hay dos campos con la misma clave: "${field.key}".`);
    }
    keys.add(field.key);
  }

  // Solo conservamos mapeos que apunten a un campo existente del formulario.
  const mappings = data.mappings.filter((m) => keys.has(m.field));

  // La automatización elegida debe ser del usuario.
  let automationId: string | null = null;
  if (data.automationId) {
    const [auto] = await db
      .select({ id: automations.id })
      .from(automations)
      .where(
        and(
          eq(automations.id, data.automationId),
          eq(automations.ownerId, user.id),
        ),
      )
      .limit(1);
    if (!auto) throw new Error("Automatización no encontrada");
    automationId = auto.id;
  }

  await db
    .update(forms)
    .set({
      automationId,
      description: data.description ?? null,
      embedSettings: data.embedSettings,
      fields: data.fields,
      mappings,
      name: data.name,
      redirectUrl: data.redirectUrl?.trim() ? data.redirectUrl.trim() : null,
      status: data.status,
    })
    .where(and(eq(forms.id, id), eq(forms.ownerId, user.id)));

  revalidateForms(id);
}

/** Cambia solo el estado (publicar/pausar/archivar) desde la lista. */
export async function setFormStatus(id: string, status: FormStatus) {
  const user = await requireUser();
  await assertOwned(user.id, id);
  await db
    .update(forms)
    .set({ status })
    .where(and(eq(forms.id, id), eq(forms.ownerId, user.id)));
  revalidateForms(id);
}

export async function deleteForm(id: string) {
  const user = await requireUser();
  await db
    .delete(forms)
    .where(and(eq(forms.id, id), eq(forms.ownerId, user.id)));
  revalidateForms();
}
