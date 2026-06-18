"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/session";
import {
  pipelineFormSchema,
  stageInputSchema,
  type PipelineFormValues,
  type StageInputValues,
} from "@/lib/validations/deal";
import { db } from "@/server/db";
import { deals, pipelines, stages } from "@/server/db/schema";

function revalidate() {
  revalidatePath("/settings");
  revalidatePath("/deals");
}

const DEFAULT_NEW_STAGES = [
  { name: "Nueva etapa", probability: 0, rottingDays: null as number | null },
];

// --- Embudos ---------------------------------------------------------------
export async function createPipeline(raw: PipelineFormValues) {
  const user = await requireUser();
  const data = pipelineFormSchema.parse(raw);

  const [{ max } = { max: 0 }] = await db
    .select({ max: sql<number>`coalesce(max(${pipelines.position}), 0)` })
    .from(pipelines)
    .where(eq(pipelines.ownerId, user.id));

  const [pipeline] = await db
    .insert(pipelines)
    .values({
      name: data.name.trim(),
      position: Number(max) + 1,
      ownerId: user.id,
    })
    .returning({ id: pipelines.id });
  if (!pipeline) throw new Error("No se pudo crear el embudo");

  // Un embudo necesita al menos una etapa para poder usarse.
  await db.insert(stages).values(
    DEFAULT_NEW_STAGES.map((s, i) => ({
      pipelineId: pipeline.id,
      name: s.name,
      position: i,
      probability: s.probability,
      rottingDays: s.rottingDays,
      ownerId: user.id,
    })),
  );

  revalidate();
  return { id: pipeline.id };
}

export async function updatePipeline(id: string, raw: PipelineFormValues) {
  const user = await requireUser();
  const data = pipelineFormSchema.parse(raw);
  await db
    .update(pipelines)
    .set({ name: data.name.trim() })
    .where(and(eq(pipelines.id, id), eq(pipelines.ownerId, user.id)));
  revalidate();
  return { id };
}

export async function deletePipeline(id: string) {
  const user = await requireUser();

  const count = await db.$count(pipelines, eq(pipelines.ownerId, user.id));
  if (count <= 1) {
    throw new Error("Debe quedar al menos un embudo.");
  }
  const dealCount = await db.$count(
    deals,
    and(eq(deals.ownerId, user.id), eq(deals.pipelineId, id)),
  );
  if (dealCount > 0) {
    throw new Error(
      "Este embudo tiene negocios. Muévelos o elimínalos antes de borrarlo.",
    );
  }

  await db
    .delete(pipelines)
    .where(and(eq(pipelines.id, id), eq(pipelines.ownerId, user.id)));
  revalidate();
  return { id };
}

// --- Etapas ----------------------------------------------------------------
async function assertPipelineOwner(userId: string, pipelineId: string) {
  const [row] = await db
    .select({ id: pipelines.id })
    .from(pipelines)
    .where(and(eq(pipelines.id, pipelineId), eq(pipelines.ownerId, userId)))
    .limit(1);
  if (!row) throw new Error("Embudo no encontrado");
}

function normalizeStage(data: StageInputValues) {
  return {
    name: data.name.trim(),
    probability: data.probability ?? 0,
    rottingDays:
      data.rottingDays === "" || data.rottingDays == null
        ? null
        : Number(data.rottingDays),
  };
}

export async function createStage(pipelineId: string, raw: StageInputValues) {
  const user = await requireUser();
  await assertPipelineOwner(user.id, pipelineId);
  const data = normalizeStage(stageInputSchema.parse(raw));

  const [{ max } = { max: 0 }] = await db
    .select({ max: sql<number>`coalesce(max(${stages.position}), 0)` })
    .from(stages)
    .where(and(eq(stages.ownerId, user.id), eq(stages.pipelineId, pipelineId)));

  await db.insert(stages).values({
    pipelineId,
    name: data.name,
    probability: data.probability,
    rottingDays: data.rottingDays,
    position: Number(max) + 1,
    ownerId: user.id,
  });
  revalidate();
}

export async function updateStage(id: string, raw: StageInputValues) {
  const user = await requireUser();
  const data = normalizeStage(stageInputSchema.parse(raw));
  await db
    .update(stages)
    .set({
      name: data.name,
      probability: data.probability,
      rottingDays: data.rottingDays,
    })
    .where(and(eq(stages.id, id), eq(stages.ownerId, user.id)));
  revalidate();
  return { id };
}

export async function deleteStage(id: string) {
  const user = await requireUser();

  const [stage] = await db
    .select({ pipelineId: stages.pipelineId })
    .from(stages)
    .where(and(eq(stages.id, id), eq(stages.ownerId, user.id)))
    .limit(1);
  if (!stage) throw new Error("Etapa no encontrada");

  const stageCount = await db.$count(
    stages,
    and(eq(stages.ownerId, user.id), eq(stages.pipelineId, stage.pipelineId)),
  );
  if (stageCount <= 1) {
    throw new Error("El embudo debe tener al menos una etapa.");
  }
  const dealCount = await db.$count(
    deals,
    and(eq(deals.ownerId, user.id), eq(deals.stageId, id)),
  );
  if (dealCount > 0) {
    throw new Error(
      "Esta etapa tiene negocios. Muévelos a otra etapa antes de borrarla.",
    );
  }

  await db
    .delete(stages)
    .where(and(eq(stages.id, id), eq(stages.ownerId, user.id)));
  revalidate();
  return { id };
}

/** Reordena las etapas de un embudo según la lista de ids. */
export async function reorderStages(pipelineId: string, orderedIds: string[]) {
  const user = await requireUser();
  await assertPipelineOwner(user.id, pipelineId);
  await Promise.all(
    orderedIds.map((id, index) =>
      db
        .update(stages)
        .set({ position: index })
        .where(
          and(
            eq(stages.id, id),
            eq(stages.ownerId, user.id),
            eq(stages.pipelineId, pipelineId),
          ),
        ),
    ),
  );
  revalidate();
}
