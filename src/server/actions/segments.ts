"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import type { SegmentDefinition } from "@/lib/segments";
import { requireUser } from "@/lib/session";
import {
  type SegmentInputValues,
  segmentDefinitionSchema,
  segmentInputSchema,
} from "@/lib/validations/segment";
import { db } from "@/server/db";
import { segments } from "@/server/db/schema";
import {
  type SegmentAudience,
  type SegmentMember,
  countSegmentAudience,
  resolveSegmentPersons,
} from "@/server/queries/segments";

/** ¿El error es una violación de índice único de Postgres (nombre duplicado)? */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

const DUPLICATE_NAME = "Ya tienes un segmento con ese nombre.";

export async function createSegment(input: SegmentInputValues) {
  const user = await requireUser();
  const data = segmentInputSchema.parse(input);

  try {
    const [row] = await db
      .insert(segments)
      .values({
        ownerId: user.id,
        name: data.name,
        description: data.description ?? null,
        kind: data.kind,
        definition: data.definition,
      })
      .returning({ id: segments.id });
    if (!row) throw new Error("No se pudo crear el segmento");
    revalidatePath("/segments");
    return row;
  } catch (error) {
    if (isUniqueViolation(error)) throw new Error(DUPLICATE_NAME);
    throw error;
  }
}

export async function updateSegment(id: string, input: SegmentInputValues) {
  const user = await requireUser();
  const data = segmentInputSchema.parse(input);

  // Autorización por propietario.
  const owned = await db
    .select({ id: segments.id })
    .from(segments)
    .where(and(eq(segments.id, id), eq(segments.ownerId, user.id)))
    .limit(1);
  if (!owned[0]) throw new Error("Segmento no encontrado");

  try {
    await db
      .update(segments)
      .set({
        name: data.name,
        description: data.description ?? null,
        kind: data.kind,
        definition: data.definition,
      })
      .where(and(eq(segments.id, id), eq(segments.ownerId, user.id)));
    revalidatePath("/segments");
  } catch (error) {
    if (isUniqueViolation(error)) throw new Error(DUPLICATE_NAME);
    throw error;
  }
}

export async function deleteSegment(id: string) {
  const user = await requireUser();
  await db
    .delete(segments)
    .where(and(eq(segments.id, id), eq(segments.ownerId, user.id)));
  revalidatePath("/segments");
}

export type SegmentPreview = {
  audience: SegmentAudience;
  sample: SegmentMember[];
};

/**
 * Previsualiza el tamaño de audiencia de una definición sin guardarla. Lo llama el
 * constructor en vivo mientras el usuario edita las reglas.
 */
export async function previewSegmentAudience(
  definition: SegmentDefinition,
): Promise<SegmentPreview> {
  await requireUser();
  const parsed = segmentDefinitionSchema.parse(definition);
  const [audience, sample] = await Promise.all([
    countSegmentAudience(parsed),
    resolveSegmentPersons(parsed, { limit: 6 }),
  ]);
  return { audience, sample };
}
