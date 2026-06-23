"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  type AutomationInputValues,
  automationInputSchema,
} from "@/lib/validations/automation";
import { requireUser } from "@/lib/session";
import { db } from "@/server/db";
import {
  type AutomationStatus,
  type AutomationTriggerType,
  automations,
} from "@/server/db/schema";

function revalidateAutomations(id?: string) {
  revalidatePath("/automations");
  if (id) revalidatePath(`/automations/${id}`);
}

async function assertOwned(ownerId: string, id: string) {
  const [row] = await db
    .select({ id: automations.id, version: automations.version })
    .from(automations)
    .where(and(eq(automations.id, id), eq(automations.ownerId, ownerId)))
    .limit(1);
  if (!row) throw new Error("Automatización no encontrada");
  return row;
}

/** Crea una automatización en borrador y devuelve su id (para abrir el editor). */
export async function createAutomation(input: { name: string }) {
  const user = await requireUser();
  const name = input.name?.trim();
  if (!name) throw new Error("Ponle un nombre a la automatización");

  const [row] = await db
    .insert(automations)
    .values({ name: name.slice(0, 120), ownerId: user.id, status: "draft" })
    .returning({ id: automations.id });
  if (!row) throw new Error("No se pudo crear la automatización");
  revalidateAutomations(row.id);
  return row;
}

export async function updateAutomation(
  id: string,
  input: AutomationInputValues,
) {
  const user = await requireUser();
  const existing = await assertOwned(user.id, id);
  const data = automationInputSchema.parse(input);

  // Activar requiere un disparador definido.
  if (data.status === "active" && !data.trigger) {
    throw new Error("Elige un disparador antes de activar la automatización.");
  }

  const triggerType: AutomationTriggerType | null = data.trigger?.type ?? null;

  await db
    .update(automations)
    .set({
      description: data.description ?? null,
      graph: data.graph,
      name: data.name,
      status: data.status,
      trigger: data.trigger ?? null,
      triggerType,
      version: existing.version + 1,
    })
    .where(and(eq(automations.id, id), eq(automations.ownerId, user.id)));

  revalidateAutomations(id);
}

/** Cambia solo el estado (activar/pausar) desde la lista. */
export async function setAutomationStatus(
  id: string,
  status: AutomationStatus,
) {
  const user = await requireUser();
  await assertOwned(user.id, id);

  if (status === "active") {
    const [row] = await db
      .select({ triggerType: automations.triggerType })
      .from(automations)
      .where(and(eq(automations.id, id), eq(automations.ownerId, user.id)))
      .limit(1);
    if (!row?.triggerType) {
      throw new Error(
        "Define un disparador en el editor antes de activar la automatización.",
      );
    }
  }

  await db
    .update(automations)
    .set({ status })
    .where(and(eq(automations.id, id), eq(automations.ownerId, user.id)));
  revalidateAutomations(id);
}

export async function deleteAutomation(id: string) {
  const user = await requireUser();
  await db
    .delete(automations)
    .where(and(eq(automations.id, id), eq(automations.ownerId, user.id)));
  revalidateAutomations();
}
