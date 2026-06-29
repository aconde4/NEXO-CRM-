import "server-only";

import { db } from "@/server/db";
import { dealStageEvents } from "@/server/db/schema";

export type RecordStageChangeInput = {
  ownerId: string;
  dealId: string;
  pipelineId?: string | null;
  /** Etapa de origen (null = alta/entrada al embudo). */
  fromStageId?: string | null;
  toStageId: string | null;
  at?: Date;
};

/**
 * Registra un cambio de etapa en `deal_stage_events` (6.4i). Es la base para la
 * conversión temporal real del embudo: cada movimiento de etapa deja una fila.
 */
export async function recordStageChange(
  input: RecordStageChangeInput,
): Promise<void> {
  await db.insert(dealStageEvents).values({
    dealId: input.dealId,
    fromStageId: input.fromStageId ?? null,
    ownerId: input.ownerId,
    pipelineId: input.pipelineId ?? null,
    toStageId: input.toStageId,
    ...(input.at ? { at: input.at } : {}),
  });
}

/** Versión best-effort: nunca lanza (no debe romper la mutación principal). */
export async function recordStageChangeSafely(
  input: RecordStageChangeInput,
): Promise<void> {
  try {
    await recordStageChange(input);
  } catch (error) {
    console.error("No se pudo registrar el cambio de etapa", error);
  }
}
