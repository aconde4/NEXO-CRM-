import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";

import { requireUser } from "@/lib/session";
import { db } from "@/server/db";
import {
  type AutomationGraph,
  type AutomationStatus,
  type AutomationTrigger,
  type AutomationTriggerType,
  automations,
  emailTemplates,
  labels,
  sequences,
  stages,
} from "@/server/db/schema";

export type AutomationListItem = {
  id: string;
  name: string;
  description: string;
  status: AutomationStatus;
  triggerType: AutomationTriggerType | null;
  nodeCount: number;
  updatedAt: string;
};

export type AutomationDetail = {
  id: string;
  name: string;
  description: string;
  status: AutomationStatus;
  triggerType: AutomationTriggerType | null;
  trigger: AutomationTrigger | null;
  graph: AutomationGraph;
  version: number;
  updatedAt: string;
};

const EMPTY_GRAPH: AutomationGraph = { edges: [], nodes: [] };

export async function listAutomations(): Promise<AutomationListItem[]> {
  const user = await requireUser();
  const rows = await db
    .select({
      id: automations.id,
      name: automations.name,
      description: automations.description,
      status: automations.status,
      triggerType: automations.triggerType,
      graph: automations.graph,
      updatedAt: automations.updatedAt,
    })
    .from(automations)
    .where(eq(automations.ownerId, user.id))
    .orderBy(desc(automations.updatedAt));

  return rows.map((row) => ({
    description: row.description ?? "",
    id: row.id,
    name: row.name,
    nodeCount: row.graph?.nodes?.length ?? 0,
    status: row.status,
    triggerType: row.triggerType,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function getAutomation(
  id: string,
): Promise<AutomationDetail | null> {
  const user = await requireUser();
  return getAutomationForOwner(id, user.id);
}

export async function getAutomationForOwner(
  id: string,
  ownerId: string,
): Promise<AutomationDetail | null> {
  const [row] = await db
    .select({
      id: automations.id,
      name: automations.name,
      description: automations.description,
      status: automations.status,
      triggerType: automations.triggerType,
      trigger: automations.trigger,
      graph: automations.graph,
      version: automations.version,
      updatedAt: automations.updatedAt,
    })
    .from(automations)
    .where(and(eq(automations.id, id), eq(automations.ownerId, ownerId)))
    .limit(1);
  if (!row) return null;

  return {
    description: row.description ?? "",
    graph: row.graph ?? EMPTY_GRAPH,
    id: row.id,
    name: row.name,
    status: row.status,
    trigger: row.trigger,
    triggerType: row.triggerType,
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}

export type AutomationOption = { id: string; name: string };
export type AutomationBuilderOptions = {
  labels: AutomationOption[];
  sequences: AutomationOption[];
  templates: AutomationOption[];
  stages: AutomationOption[];
};

/** Opciones para configurar las acciones del constructor (etiquetas, secuencias…). */
export async function listAutomationBuilderOptions(): Promise<AutomationBuilderOptions> {
  const user = await requireUser();
  const [labelRows, sequenceRows, templateRows, stageRows] = await Promise.all([
    db
      .select({ id: labels.id, name: labels.name })
      .from(labels)
      .where(eq(labels.ownerId, user.id))
      .orderBy(asc(labels.name))
      .limit(500),
    db
      .select({ id: sequences.id, name: sequences.name })
      .from(sequences)
      .where(eq(sequences.ownerId, user.id))
      .orderBy(asc(sequences.name))
      .limit(500),
    db
      .select({ id: emailTemplates.id, name: emailTemplates.name })
      .from(emailTemplates)
      .where(eq(emailTemplates.ownerId, user.id))
      .orderBy(asc(emailTemplates.name))
      .limit(500),
    db
      .select({ id: stages.id, name: stages.name })
      .from(stages)
      .where(eq(stages.ownerId, user.id))
      .orderBy(asc(stages.position))
      .limit(500),
  ]);

  return {
    labels: labelRows,
    sequences: sequenceRows,
    stages: stageRows,
    templates: templateRows,
  };
}
