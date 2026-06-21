"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { textToHtml } from "@/lib/email/merge-tags";
import { requireUser } from "@/lib/session";
import {
  type SequenceBuilderStepValues,
  type SequenceBuilderValues,
  sequenceBuilderSchema,
  sequenceIdSchema,
} from "@/lib/validations/sequence";
import { db } from "@/server/db";
import { enrollments, sequenceSteps, sequences } from "@/server/db/schema";
import { sanitizeEmailHtml } from "@/server/services/email-html";

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function revalidateSequences() {
  revalidatePath("/sequences");
}

function postgresCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  if (
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }
  if ("cause" in error)
    return postgresCode((error as { cause?: unknown }).cause);
  return null;
}

function bodyHtmlFromStep(
  step: Extract<SequenceBuilderStepValues, { type: "email" }>,
) {
  const html = step.bodyHtml.trim();
  return sanitizeEmailHtml(html || textToHtml(step.bodyText));
}

function waitStepName(
  step: Extract<SequenceBuilderStepValues, { type: "wait" }>,
) {
  const parts = [
    step.waitDays ? `${step.waitDays} d` : "",
    step.waitHours ? `${step.waitHours} h` : "",
  ].filter(Boolean);
  return `Esperar ${parts.join(" ")}`;
}

function valuesForStep(
  ownerId: string,
  sequenceId: string,
  step: SequenceBuilderStepValues,
  position: number,
  sequenceChannel: SequenceBuilderValues["channel"],
) {
  const base = {
    condition: {},
    ownerId,
    position,
    sequenceId,
    settings: {},
    type: step.type,
  };

  if (step.type === "email") {
    return {
      ...base,
      bodyHtml: bodyHtmlFromStep(step),
      bodyText: step.bodyText,
      channel: step.channel ?? sequenceChannel,
      name: clean(step.name),
      preheader: clean(step.preheader),
      subject: step.subject,
      templateId: step.templateId,
      variants: [],
      waitDays: 0,
      waitHours: 0,
    };
  }

  if (step.type === "wait") {
    return {
      ...base,
      bodyHtml: null,
      bodyText: null,
      channel: null,
      name: clean(step.name) ?? waitStepName(step),
      preheader: null,
      subject: null,
      templateId: null,
      variants: [],
      waitDays: step.waitDays,
      waitHours: step.waitHours,
    };
  }

  if (step.type === "condition") {
    return {
      ...base,
      bodyHtml: null,
      bodyText: null,
      channel: null,
      condition: step.condition,
      name: clean(step.name) ?? "Condición",
      preheader: null,
      subject: null,
      templateId: null,
      variants: [],
      waitDays: 0,
      waitHours: 0,
    };
  }

  return {
    ...base,
    bodyHtml: null,
    bodyText: clean(step.taskNotes),
    channel: null,
    name: clean(step.name) ?? step.taskSubject,
    preheader: null,
    subject: null,
    templateId: null,
    variants: [],
    waitDays: step.waitDays,
    waitHours: step.waitHours,
    settings: {
      taskNotes: step.taskNotes,
      taskSubject: step.taskSubject,
    },
  };
}

async function assertOwnedSequence(ownerId: string, id: string) {
  const [row] = await db
    .select({ id: sequences.id })
    .from(sequences)
    .where(and(eq(sequences.id, id), eq(sequences.ownerId, ownerId)))
    .limit(1);
  if (!row) throw new Error("Secuencia no encontrada");
}

export async function saveSequence(raw: SequenceBuilderValues) {
  const user = await requireUser();
  const data = sequenceBuilderSchema.parse(raw);
  const now = new Date();
  if (data.id) await assertOwnedSequence(user.id, data.id);

  try {
    const id = await db.transaction(async (tx) => {
      let sequenceId = data.id;

      const sequenceValues = {
        channel: data.channel,
        dailyLimit: data.dailyLimit,
        description: clean(data.description),
        name: data.name,
        settings: {},
        status: data.status,
        stopOnReply: data.stopOnReply,
        timeZone: data.timeZone,
        updatedAt: now,
        windowEnd: data.windowEnd,
        windowStart: data.windowStart,
      };

      if (sequenceId) {
        await tx
          .update(sequences)
          .set(sequenceValues)
          .where(
            and(eq(sequences.id, sequenceId), eq(sequences.ownerId, user.id)),
          );
      } else {
        const [created] = await tx
          .insert(sequences)
          .values({
            ...sequenceValues,
            createdAt: now,
            ownerId: user.id,
          })
          .returning({ id: sequences.id });
        if (!created) throw new Error("No se pudo crear la secuencia");
        sequenceId = created.id;
      }

      const existingSteps = await tx
        .select({ id: sequenceSteps.id })
        .from(sequenceSteps)
        .where(
          and(
            eq(sequenceSteps.sequenceId, sequenceId),
            eq(sequenceSteps.ownerId, user.id),
          ),
        );
      const existingIds = new Set(existingSteps.map((step) => step.id));
      const requestedExistingIds = data.steps
        .map((step) => step.id)
        .filter((id): id is string => Boolean(id));

      for (const stepId of requestedExistingIds) {
        if (!existingIds.has(stepId)) {
          throw new Error("Uno de los pasos no pertenece a esta secuencia.");
        }
      }

      const removedIds = [...existingIds].filter(
        (id) => !requestedExistingIds.includes(id),
      );
      if (removedIds.length > 0) {
        await tx
          .delete(sequenceSteps)
          .where(
            and(
              eq(sequenceSteps.ownerId, user.id),
              inArray(sequenceSteps.id, removedIds),
            ),
          );
      }

      if (requestedExistingIds.length > 0) {
        await tx
          .update(sequenceSteps)
          .set({
            position: sql`(${sequenceSteps.position} * -1) - 10000`,
            updatedAt: now,
          })
          .where(
            and(
              eq(sequenceSteps.ownerId, user.id),
              inArray(sequenceSteps.id, requestedExistingIds),
            ),
          );
      }

      for (const [position, step] of data.steps.entries()) {
        const values = valuesForStep(
          user.id,
          sequenceId,
          step,
          position,
          data.channel,
        );
        if (step.id) {
          await tx
            .update(sequenceSteps)
            .set({ ...values, updatedAt: now })
            .where(
              and(
                eq(sequenceSteps.id, step.id),
                eq(sequenceSteps.ownerId, user.id),
              ),
            );
        } else {
          await tx.insert(sequenceSteps).values({
            ...values,
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      return sequenceId;
    });

    revalidateSequences();
    return { id };
  } catch (error) {
    if (postgresCode(error) === "23505") {
      throw new Error("Ya tienes una secuencia con ese nombre.");
    }
    throw error;
  }
}

export async function deleteSequence(id: string) {
  const user = await requireUser();
  const sequenceId = sequenceIdSchema.parse(id);
  await assertOwnedSequence(user.id, sequenceId);

  const activeEnrollments = await db.$count(
    enrollments,
    and(
      eq(enrollments.sequenceId, sequenceId),
      eq(enrollments.ownerId, user.id),
      eq(enrollments.status, "active"),
    ),
  );
  if (activeEnrollments > 0) {
    throw new Error(
      "No se puede eliminar una secuencia con inscripciones activas. Paúsala o detén sus contactos primero.",
    );
  }

  await db
    .delete(sequences)
    .where(and(eq(sequences.id, sequenceId), eq(sequences.ownerId, user.id)));
  revalidateSequences();
  return { id: sequenceId };
}
