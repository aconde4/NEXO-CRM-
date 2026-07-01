"use server";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { renderMergeTags, textToHtml } from "@/lib/email/merge-tags";
import { CRM_ACTION_LABELS } from "@/lib/sequences";
import { requireUser } from "@/lib/session";
import {
  type SequenceEnrollmentValues,
  type SequenceBuilderStepValues,
  type SequenceBuilderValues,
  type SequenceStepTestValues,
  sequenceBuilderSchema,
  sequenceEnrollmentSchema,
  sequenceIdSchema,
  sequenceStepTestSchema,
} from "@/lib/validations/sequence";
import { db } from "@/server/db";
import {
  type SequenceStatus,
  type SequenceStepVariant,
  enrollments,
  persons,
  segments,
  sequenceSteps,
  sequences,
  suppressions,
} from "@/server/db/schema";
import { inngest } from "@/server/inngest/client";
import {
  countSegmentAudienceForOwner,
  resolveSegmentPersonsForOwner,
} from "@/server/queries/segments";
import { sanitizeEmailHtml } from "@/server/services/email-html";
import {
  GmailServiceError,
  normalizeEmail,
} from "@/server/services/gmail-auth";
import { sendGmailEmail } from "@/server/services/gmail";
import {
  getDefaultCampaignFrom,
  isResendConfigured,
  sendResendEmail,
} from "@/server/services/resend";
import { emitAutomationEventsSafely } from "@/server/services/automation-runner";
import { SEQUENCE_RUN_EVENT } from "@/server/services/sequence-runner";

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function revalidateSequences() {
  revalidatePath("/sequences");
}

const MAX_MANUAL_SEQUENCE_ENROLLMENTS = 5_000;

type EnrollmentCandidate = {
  email: string | null;
  id: string;
  marketingStatus: string;
  orgId: string | null;
};

type EnrollmentCandidateSource = {
  personIds: string[];
  requested: number;
};

export type SequenceEnrollmentResult = {
  alreadyEnrolled: number;
  enrolled: number;
  queued: number;
  requested: number;
  skippedMissing: number;
  skippedNoEmail: number;
  skippedNotSubscribed: number;
  skippedSuppressed: number;
};

const EMPTY_ENROLLMENT_RESULT: SequenceEnrollmentResult = {
  alreadyEnrolled: 0,
  enrolled: 0,
  queued: 0,
  requested: 0,
  skippedMissing: 0,
  skippedNoEmail: 0,
  skippedNotSubscribed: 0,
  skippedSuppressed: 0,
};

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

/** Variantes A/B del paso de email, con el HTML saneado igual que el cuerpo base. */
function variantsForStep(
  step: Extract<SequenceBuilderStepValues, { type: "email" }>,
): SequenceStepVariant[] {
  return step.variants.map((variant) => ({
    bodyHtml: sanitizeEmailHtml(
      variant.bodyHtml.trim() || textToHtml(variant.bodyText),
    ),
    bodyText: variant.bodyText,
    id: variant.id,
    name: clean(variant.name) ?? undefined,
    subject: variant.subject,
    templateId: null,
    weight: variant.weight,
  }));
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
      variants: variantsForStep(step),
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

  if (step.type === "crm_action") {
    return {
      ...base,
      bodyHtml: null,
      bodyText: null,
      channel: null,
      name: clean(step.name) ?? CRM_ACTION_LABELS[step.action.kind],
      preheader: null,
      subject: null,
      templateId: null,
      variants: [],
      waitDays: 0,
      waitHours: 0,
      settings: { action: step.action },
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

async function assertSequenceCanEnroll(ownerId: string, id: string) {
  const [row] = await db
    .select({ id: sequences.id, status: sequences.status })
    .from(sequences)
    .where(and(eq(sequences.id, id), eq(sequences.ownerId, ownerId)))
    .limit(1);
  if (!row) throw new Error("Secuencia no encontrada");
  if (row.status !== "active") {
    throw new Error("Activa la secuencia antes de inscribir contactos.");
  }

  const stepCount = await db.$count(
    sequenceSteps,
    and(eq(sequenceSteps.sequenceId, id), eq(sequenceSteps.ownerId, ownerId)),
  );
  if (stepCount === 0) {
    throw new Error(
      "La secuencia necesita al menos un paso antes de inscribir.",
    );
  }
}

async function resolveEnrollmentSource(
  ownerId: string,
  data: SequenceEnrollmentValues,
): Promise<EnrollmentCandidateSource> {
  if (data.source === "person") {
    return { personIds: data.personId ? [data.personId] : [], requested: 1 };
  }

  if (data.source === "persons") {
    const personIds = [...new Set(data.personIds ?? [])];
    if (personIds.length > MAX_MANUAL_SEQUENCE_ENROLLMENTS) {
      throw new Error(
        `Selecciona como máximo ${MAX_MANUAL_SEQUENCE_ENROLLMENTS} contactos para una inscripción manual.`,
      );
    }
    return { personIds, requested: personIds.length };
  }

  if (!data.segmentId) return { personIds: [], requested: 0 };
  const [segment] = await db
    .select({ definition: segments.definition, id: segments.id })
    .from(segments)
    .where(and(eq(segments.id, data.segmentId), eq(segments.ownerId, ownerId)))
    .limit(1);
  if (!segment) throw new Error("Segmento no encontrado");

  const audience = await countSegmentAudienceForOwner(
    segment.definition,
    ownerId,
  );
  if (audience.total > MAX_MANUAL_SEQUENCE_ENROLLMENTS) {
    throw new Error(
      `El segmento tiene ${audience.total} contactos. Reduce la audiencia por debajo de ${MAX_MANUAL_SEQUENCE_ENROLLMENTS} para una inscripción manual.`,
    );
  }

  const members = await resolveSegmentPersonsForOwner(
    segment.definition,
    ownerId,
    { limit: MAX_MANUAL_SEQUENCE_ENROLLMENTS, reachableOnly: false },
  );
  return {
    personIds: members.map((member) => member.id),
    requested: audience.total,
  };
}

async function loadEnrollmentCandidates(ownerId: string, personIds: string[]) {
  const uniqueIds = [...new Set(personIds)];
  if (uniqueIds.length === 0) return [];
  return db
    .select({
      email: persons.email,
      id: persons.id,
      marketingStatus: persons.marketingStatus,
      orgId: persons.orgId,
    })
    .from(persons)
    .where(
      and(
        eq(persons.ownerId, ownerId),
        isNull(persons.deletedAt),
        inArray(persons.id, uniqueIds),
      ),
    );
}

async function suppressedEmailSet(ownerId: string, emails: string[]) {
  const uniqueEmails = [...new Set(emails)];
  if (uniqueEmails.length === 0) return new Set<string>();
  const rows = await db
    .select({ email: suppressions.emailNormalized })
    .from(suppressions)
    .where(
      and(
        eq(suppressions.ownerId, ownerId),
        inArray(suppressions.emailNormalized, uniqueEmails),
      ),
    );
  return new Set(rows.map((row) => row.email));
}

async function existingEnrollmentPersonSet(
  ownerId: string,
  sequenceId: string,
  personIds: string[],
) {
  if (personIds.length === 0) return new Set<string>();
  const rows = await db
    .select({ personId: enrollments.personId })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.ownerId, ownerId),
        eq(enrollments.sequenceId, sequenceId),
        inArray(enrollments.personId, personIds),
      ),
    );
  return new Set(rows.map((row) => row.personId));
}

async function queueSequenceRuns(
  inserted: { id: string; personId: string }[],
  input: SequenceEnrollmentValues,
) {
  if (inserted.length === 0) return;
  await inngest.send(
    inserted.map((enrollment) => ({
      data: {
        enrollmentId: enrollment.id,
        personId: enrollment.personId,
        segmentId: input.source === "segment" ? input.segmentId : null,
        sequenceId: input.sequenceId,
        source: input.source,
      },
      name: SEQUENCE_RUN_EVENT,
    })),
  );
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

export async function enrollInSequence(raw: SequenceEnrollmentValues) {
  const user = await requireUser();
  const data = sequenceEnrollmentSchema.parse(raw);
  await assertSequenceCanEnroll(user.id, data.sequenceId);

  const source = await resolveEnrollmentSource(user.id, data);
  const result: SequenceEnrollmentResult = {
    ...EMPTY_ENROLLMENT_RESULT,
    requested: source.requested,
  };

  const uniquePersonIds = [...new Set(source.personIds)];
  const candidates = await loadEnrollmentCandidates(user.id, uniquePersonIds);
  result.skippedMissing = Math.max(
    uniquePersonIds.length - candidates.length,
    0,
  );

  const normalizedByPerson = new Map<string, string>();
  for (const candidate of candidates) {
    const email = normalizeEmail(candidate.email ?? "");
    if (email) normalizedByPerson.set(candidate.id, email);
  }
  const suppressed = await suppressedEmailSet(user.id, [
    ...normalizedByPerson.values(),
  ]);

  const eligible: EnrollmentCandidate[] = [];
  for (const candidate of candidates) {
    const email = normalizedByPerson.get(candidate.id);
    if (!email) {
      result.skippedNoEmail += 1;
      continue;
    }
    if (candidate.marketingStatus !== "subscribed") {
      result.skippedNotSubscribed += 1;
      continue;
    }
    if (suppressed.has(email)) {
      result.skippedSuppressed += 1;
      continue;
    }
    eligible.push(candidate);
  }

  const existing = await existingEnrollmentPersonSet(
    user.id,
    data.sequenceId,
    eligible.map((candidate) => candidate.id),
  );
  const toInsert = eligible.filter((candidate) => !existing.has(candidate.id));
  result.alreadyEnrolled = eligible.length - toInsert.length;

  if (toInsert.length === 0) {
    revalidateSequences();
    return result;
  }

  const now = new Date();
  const inserted = await db
    .insert(enrollments)
    .values(
      toInsert.map((candidate) => ({
        context: {
          enrolledBy: "manual",
          segmentId: data.source === "segment" ? data.segmentId : null,
          source: data.source,
        },
        currentStepPosition: 0,
        enrolledAt: now,
        nextRunAt: now,
        orgId: candidate.orgId,
        ownerId: user.id,
        personId: candidate.id,
        sequenceId: data.sequenceId,
        status: "active" as const,
        updatedAt: now,
      })),
    )
    .onConflictDoNothing({
      target: [enrollments.sequenceId, enrollments.personId],
    })
    .returning({ id: enrollments.id, personId: enrollments.personId });

  result.enrolled = inserted.length;
  result.alreadyEnrolled += toInsert.length - inserted.length;

  try {
    await queueSequenceRuns(inserted, data);
    result.queued = inserted.length;
  } catch (error) {
    if (inserted.length > 0) {
      await db.delete(enrollments).where(
        and(
          eq(enrollments.ownerId, user.id),
          inArray(
            enrollments.id,
            inserted.map((row) => row.id),
          ),
        ),
      );
    }
    const message =
      error instanceof Error
        ? `No se pudo encolar la secuencia en Inngest: ${error.message}`
        : "No se pudo encolar la secuencia en Inngest.";
    revalidateSequences();
    throw new Error(message);
  }

  await emitAutomationEventsSafely(
    inserted.map((enrollment) => ({
      entityId: enrollment.personId,
      entityType: "person",
      ownerId: user.id,
      payload: {
        enrollmentId: enrollment.id,
        personId: enrollment.personId,
        segmentId: data.source === "segment" ? data.segmentId : null,
        sequenceId: data.sequenceId,
        source: data.source,
      },
      type: "sequence_enrolled",
    })),
  );

  revalidateSequences();
  if (data.personId) revalidatePath(`/contacts/${data.personId}`);
  return result;
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

/** Nombre libre para una copia (respeta el único por dueño+nombre). */
async function uniqueSequenceName(ownerId: string, base: string) {
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base} ${i + 1}`;
    const [existing] = await db
      .select({ id: sequences.id })
      .from(sequences)
      .where(and(eq(sequences.ownerId, ownerId), eq(sequences.name, candidate)))
      .limit(1);
    if (!existing) return candidate;
  }
  return `${base} ${Date.now()}`;
}

/** Duplica una secuencia (con sus pasos) como nuevo borrador (Fase T.5). */
export async function duplicateSequence(id: string) {
  const user = await requireUser();
  const sequenceId = sequenceIdSchema.parse(id);

  const [original] = await db
    .select()
    .from(sequences)
    .where(and(eq(sequences.id, sequenceId), eq(sequences.ownerId, user.id)))
    .limit(1);
  if (!original) throw new Error("Secuencia no encontrada");

  const steps = await db
    .select()
    .from(sequenceSteps)
    .where(
      and(
        eq(sequenceSteps.sequenceId, sequenceId),
        eq(sequenceSteps.ownerId, user.id),
      ),
    )
    .orderBy(sequenceSteps.position);

  const name = await uniqueSequenceName(user.id, `${original.name} (copia)`);
  const now = new Date();

  const newId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(sequences)
      .values({
        channel: original.channel,
        createdAt: now,
        dailyLimit: original.dailyLimit,
        description: original.description,
        name,
        ownerId: user.id,
        settings: original.settings,
        status: "draft",
        stopOnReply: original.stopOnReply,
        timeZone: original.timeZone,
        updatedAt: now,
        windowEnd: original.windowEnd,
        windowStart: original.windowStart,
      })
      .returning({ id: sequences.id });
    if (!created) throw new Error("No se pudo duplicar la secuencia");

    if (steps.length > 0) {
      await tx.insert(sequenceSteps).values(
        steps.map((step) => ({
          bodyHtml: step.bodyHtml,
          bodyText: step.bodyText,
          channel: step.channel,
          condition: step.condition,
          createdAt: now,
          name: step.name,
          ownerId: user.id,
          position: step.position,
          preheader: step.preheader,
          sequenceId: created.id,
          settings: step.settings,
          subject: step.subject,
          templateId: step.templateId,
          type: step.type,
          updatedAt: now,
          variants: step.variants,
          waitDays: step.waitDays,
          waitHours: step.waitHours,
        })),
      );
    }
    return created.id;
  });

  revalidateSequences();
  return { id: newId };
}

/**
 * Activa o pausa una secuencia (Fase T.5). Pausar es seguro: el runner devuelve noop si
 * la secuencia no está activa, así que ningún paso pendiente se envía. Al reanudar
 * (paused → active) se re-encolan las inscripciones activas para que continúen donde
 * estaban (su run duradero terminó como noop al pausar).
 */
export async function setSequenceStatus(id: string, status: SequenceStatus) {
  const user = await requireUser();
  const sequenceId = sequenceIdSchema.parse(id);
  if (status !== "active" && status !== "paused") {
    throw new Error("Estado de secuencia no válido.");
  }
  const next: SequenceStatus = status;

  const [original] = await db
    .select({ status: sequences.status })
    .from(sequences)
    .where(and(eq(sequences.id, sequenceId), eq(sequences.ownerId, user.id)))
    .limit(1);
  if (!original) throw new Error("Secuencia no encontrada");
  if (original.status === "archived") {
    throw new Error("No se puede activar o pausar una secuencia archivada.");
  }

  if (next === "active") {
    const stepCount = await db.$count(
      sequenceSteps,
      and(
        eq(sequenceSteps.sequenceId, sequenceId),
        eq(sequenceSteps.ownerId, user.id),
      ),
    );
    if (stepCount === 0) {
      throw new Error("La secuencia necesita al menos un paso para activarse.");
    }
  }

  await db
    .update(sequences)
    .set({ status: next, updatedAt: new Date() })
    .where(and(eq(sequences.id, sequenceId), eq(sequences.ownerId, user.id)));

  if (next === "active" && original.status !== "active") {
    const active = await db
      .select({ id: enrollments.id, personId: enrollments.personId })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.ownerId, user.id),
          eq(enrollments.sequenceId, sequenceId),
          eq(enrollments.status, "active"),
        ),
      );
    if (active.length > 0) {
      try {
        await inngest.send(
          active.map((enrollment) => ({
            data: {
              enrollmentId: enrollment.id,
              personId: enrollment.personId,
              sequenceId,
            },
            name: SEQUENCE_RUN_EVENT,
          })),
        );
      } catch (error) {
        console.error("No se pudo reanudar la secuencia en Inngest", error);
      }
    }
  }

  revalidateSequences();
  return { id: sequenceId, status: next };
}

/** Envía una prueba del contenido (paso o variante) a tu propio correo (Fase T.5). */
export async function sendSequenceStepTest(raw: SequenceStepTestValues) {
  const user = await requireUser();
  const data = sequenceStepTestSchema.parse(raw);

  const to = clean(user.email);
  if (!to) {
    throw new Error("Tu usuario no tiene email para enviar la prueba.");
  }

  const ctx: Record<string, string> = {
    email: to,
    nombre: user.name?.split(" ")[0] ?? "Nombre",
    nombre_completo: user.name ?? "Contacto de prueba",
  };
  const subject = renderMergeTags(data.subject, ctx) || data.subject;
  const htmlSource = data.bodyHtml.trim() || textToHtml(data.bodyText);
  const bodyHtml = sanitizeEmailHtml(
    renderMergeTags(htmlSource, ctx, { escapeValues: true }),
  );
  const bodyText = data.bodyText
    ? renderMergeTags(data.bodyText, ctx)
    : undefined;
  const testSubject = `[Prueba] ${subject}`;

  if (data.channel === "resend") {
    if (!isResendConfigured()) {
      throw new Error("Configura RESEND_API_KEY para probar por Resend.");
    }
    const from = getDefaultCampaignFrom();
    if (!from) {
      throw new Error("Configura CAMPAIGN_FROM_EMAIL para probar por Resend.");
    }
    await sendResendEmail({
      from,
      html: bodyHtml,
      subject: testSubject,
      tags: [{ name: "type", value: "sequence_test" }],
      text: bodyText,
      to,
    });
    return { channel: "resend" as const, to };
  }

  try {
    await sendGmailEmail(user.id, {
      bodyHtml,
      subject: testSubject,
      to: [{ email: to }],
      ...(bodyText ? { bodyText } : {}),
    });
  } catch (error) {
    if (error instanceof GmailServiceError) {
      throw new Error(`No se pudo enviar la prueba: ${error.message}`);
    }
    throw error;
  }
  return { channel: "gmail_1to1" as const, to };
}
