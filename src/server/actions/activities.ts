"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/session";
import {
  activityFormSchema,
  type ActivityFormValues,
} from "@/lib/validations/activity";
import { db } from "@/server/db";
import { activities, activityLog } from "@/server/db/schema";

async function logEvent(
  actorId: string,
  verb: string,
  entityId: string,
  payload?: Record<string, unknown>,
) {
  await db
    .insert(activityLog)
    .values({ actorId, verb, entityType: "activity", entityId, payload });
}

/** Cadena vacía/espacios → null (para ids opcionales y fechas). */
function nullify(value: string | undefined | null): string | null {
  const v = value?.trim();
  return v ? v : null;
}

/** Revalida las rutas afectadas por una actividad según sus vínculos. */
function revalidateFor(
  personId: string | null,
  orgId: string | null,
  dealId: string | null = null,
) {
  revalidatePath("/activities");
  revalidatePath("/dashboard");
  if (personId) {
    revalidatePath("/contacts");
    revalidatePath(`/contacts/${personId}`);
  }
  if (orgId) {
    revalidatePath("/organizations");
    revalidatePath(`/organizations/${orgId}`);
  }
  if (dealId) {
    revalidatePath("/deals");
    revalidatePath(`/deals/${dealId}`);
  }
}

export async function createActivity(raw: ActivityFormValues) {
  const user = await requireUser();
  const data = activityFormSchema.parse(raw);
  const personId = nullify(data.personId);
  const orgId = nullify(data.orgId);
  const dealId = nullify(data.dealId);
  const dueAt = nullify(data.dueAt);

  const [row] = await db
    .insert(activities)
    .values({
      type: data.type,
      subject: data.subject.trim(),
      notes: data.notes?.trim() || null,
      dueAt: dueAt ? new Date(dueAt) : null,
      personId,
      orgId,
      dealId,
      ownerId: user.id,
    })
    .returning({ id: activities.id });

  if (!row) throw new Error("No se pudo crear la actividad");
  await logEvent(user.id, "created", row.id, { subject: data.subject });
  revalidateFor(personId, orgId, dealId);
  return { id: row.id };
}

export async function updateActivity(id: string, raw: ActivityFormValues) {
  const user = await requireUser();
  const data = activityFormSchema.parse(raw);
  const personId = nullify(data.personId);
  const orgId = nullify(data.orgId);
  const dealId = nullify(data.dealId);
  const dueAt = nullify(data.dueAt);

  await db
    .update(activities)
    .set({
      type: data.type,
      subject: data.subject.trim(),
      notes: data.notes?.trim() || null,
      dueAt: dueAt ? new Date(dueAt) : null,
      personId,
      orgId,
      dealId,
    })
    .where(and(eq(activities.id, id), eq(activities.ownerId, user.id)));

  await logEvent(user.id, "updated", id);
  revalidateFor(personId, orgId, dealId);
  return { id };
}

export async function setActivityDone(id: string, done: boolean) {
  const user = await requireUser();

  const [row] = await db
    .update(activities)
    .set({ done, doneAt: done ? new Date() : null })
    .where(and(eq(activities.id, id), eq(activities.ownerId, user.id)))
    .returning({
      personId: activities.personId,
      orgId: activities.orgId,
      dealId: activities.dealId,
    });

  if (!row) throw new Error("Actividad no encontrada");
  await logEvent(user.id, done ? "completed" : "reopened", id);
  revalidateFor(row.personId, row.orgId, row.dealId);
}

export async function deleteActivity(id: string) {
  const user = await requireUser();

  const [row] = await db
    .delete(activities)
    .where(and(eq(activities.id, id), eq(activities.ownerId, user.id)))
    .returning({
      personId: activities.personId,
      orgId: activities.orgId,
      dealId: activities.dealId,
    });

  if (!row) throw new Error("Actividad no encontrada");
  await logEvent(user.id, "deleted", id);
  revalidateFor(row.personId, row.orgId, row.dealId);
}
