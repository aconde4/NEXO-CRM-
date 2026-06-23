import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/server/db";
import {
  type AutomationGraph,
  type AutomationTrigger,
  type AutomationTriggerType,
  automations,
} from "@/server/db/schema";

/**
 * Disparadores (Fase 6.3): define el evento interno que las mutaciones de la app
 * emitirán (Fase 6.4) y resuelve qué automatizaciones **activas** debe lanzar. La
 * coincidencia es pura y testeable; la consulta a BD es owner-aware.
 */

export type AutomationEntityType = "person" | "organization" | "deal";

export type AutomationEvent = {
  type: AutomationTriggerType;
  ownerId: string;
  entityType?: AutomationEntityType;
  entityId?: string;
  /** Datos del evento (p. ej. `{ field, from, to }` o `{ toStageId }`). */
  payload?: Record<string, unknown>;
};

export type MatchedAutomation = {
  id: string;
  name: string;
  version: number;
  trigger: AutomationTrigger;
  graph: AutomationGraph;
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * ¿El disparador de una automatización coincide con un evento? Comprueba el tipo y los
 * filtros de configuración (entidad, etapa destino, campo vigilado). Función pura.
 */
export function triggerMatchesEvent(
  trigger: AutomationTrigger | null | undefined,
  event: AutomationEvent,
): boolean {
  if (!trigger || trigger.type !== event.type) return false;
  const config = trigger.config ?? {};

  // Filtro por entidad (para record_created/updated/field_changed…).
  const entity = asString(config.entity);
  if (entity && entity !== event.entityType) return false;

  // Cambio de etapa: si la automatización fija una etapa destino, debe coincidir.
  if (event.type === "deal_stage_changed") {
    const stageId = asString(config.stageId);
    const toStageId = asString(event.payload?.toStageId);
    if (stageId && stageId !== toStageId) return false;
  }

  // Cambio de campo: si fija un campo concreto, debe coincidir el del evento.
  if (event.type === "field_changed") {
    const field = asString(config.field);
    const changed = asString(event.payload?.field);
    if (field && field !== changed) return false;
  }

  return true;
}

/**
 * Devuelve las automatizaciones activas del propietario cuyo disparador coincide con
 * el evento. Lo usará el despachador de eventos (Fase 6.4) para encolar ejecuciones.
 */
export async function findActiveAutomationsForEvent(
  event: AutomationEvent,
): Promise<MatchedAutomation[]> {
  const rows = await db
    .select({
      id: automations.id,
      name: automations.name,
      version: automations.version,
      trigger: automations.trigger,
      graph: automations.graph,
    })
    .from(automations)
    .where(
      and(
        eq(automations.ownerId, event.ownerId),
        eq(automations.status, "active"),
        eq(automations.triggerType, event.type),
      ),
    );

  const matched: MatchedAutomation[] = [];
  for (const row of rows) {
    if (!row.trigger) continue;
    if (!triggerMatchesEvent(row.trigger, event)) continue;
    matched.push({
      graph: row.graph ?? { edges: [], nodes: [] },
      id: row.id,
      name: row.name,
      trigger: row.trigger,
      version: row.version,
    });
  }
  return matched;
}
