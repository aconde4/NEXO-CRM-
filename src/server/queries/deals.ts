import "server-only";

import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { requireUser } from "@/lib/session";
import { db } from "@/server/db";
import { deals, pipelines, stages } from "@/server/db/schema";

const DEFAULT_STAGES = [
  { name: "Calificación", probability: 20, rottingDays: 14 },
  { name: "Contacto establecido", probability: 40, rottingDays: 14 },
  { name: "Propuesta enviada", probability: 60, rottingDays: 21 },
  { name: "Negociación", probability: 80, rottingDays: 30 },
];

/** Crea un embudo por defecto con etapas si el usuario no tiene ninguno. */
export async function ensureDefaultPipeline(userId: string) {
  const existing = await db
    .select({ id: pipelines.id })
    .from(pipelines)
    .where(eq(pipelines.ownerId, userId))
    .limit(1);
  if (existing[0]) return;

  const [pipeline] = await db
    .insert(pipelines)
    .values({
      name: "Embudo de ventas",
      position: 0,
      isDefault: true,
      ownerId: userId,
    })
    .returning({ id: pipelines.id });
  if (!pipeline) return;

  await db.insert(stages).values(
    DEFAULT_STAGES.map((s, i) => ({
      pipelineId: pipeline.id,
      name: s.name,
      position: i,
      probability: s.probability,
      rottingDays: s.rottingDays,
      ownerId: userId,
    })),
  );
}

export type PipelineOption = { id: string; name: string };

/** Embudos con sus etapas, para la gestión en Ajustes. */
export async function listPipelinesWithStages() {
  const user = await requireUser();
  await ensureDefaultPipeline(user.id);
  return db.query.pipelines.findMany({
    where: eq(pipelines.ownerId, user.id),
    with: {
      stages: { orderBy: [asc(stages.position), asc(stages.createdAt)] },
    },
    orderBy: [asc(pipelines.position), asc(pipelines.createdAt)],
  });
}

export async function listPipelines(): Promise<PipelineOption[]> {
  const user = await requireUser();
  await ensureDefaultPipeline(user.id);
  return db
    .select({ id: pipelines.id, name: pipelines.name })
    .from(pipelines)
    .where(eq(pipelines.ownerId, user.id))
    .orderBy(asc(pipelines.position), asc(pipelines.createdAt));
}

export async function listStageOptions(pipelineId: string) {
  const user = await requireUser();
  return db
    .select({ id: stages.id, name: stages.name })
    .from(stages)
    .where(and(eq(stages.pipelineId, pipelineId), eq(stages.ownerId, user.id)))
    .orderBy(asc(stages.position), asc(stages.createdAt));
}

/** Etapas agrupadas por embudo, para los selectores del formulario de negocio. */
export async function listStagesByPipeline(): Promise<
  Record<string, PipelineOption[]>
> {
  const user = await requireUser();
  const rows = await db
    .select({ id: stages.id, name: stages.name, pipelineId: stages.pipelineId })
    .from(stages)
    .where(eq(stages.ownerId, user.id))
    .orderBy(asc(stages.position), asc(stages.createdAt));
  const out: Record<string, PipelineOption[]> = {};
  for (const r of rows) {
    (out[r.pipelineId] ??= []).push({ id: r.id, name: r.name });
  }
  return out;
}

function isRotting(
  stageChangedAt: Date,
  rottingDays: number | null,
  status: string,
): boolean {
  if (status !== "open" || rottingDays == null) return false;
  const days = (Date.now() - stageChangedAt.getTime()) / 86_400_000;
  return days > rottingDays;
}

export type DealCard = {
  id: string;
  title: string;
  value: number;
  currency: string;
  stageId: string;
  position: number;
  rotting: boolean;
  expectedCloseDate: Date | null;
  person: { id: string; name: string } | null;
  organization: { id: string; name: string } | null;
};

export type BoardColumn = {
  stage: {
    id: string;
    name: string;
    probability: number;
    rottingDays: number | null;
  };
  deals: DealCard[];
  count: number;
  total: number;
};

export type Board = {
  pipelines: PipelineOption[];
  activePipelineId: string | null;
  columns: BoardColumn[];
  totals: { count: number; sum: number; forecast: number };
};

/** Datos del tablero Kanban para un embudo (el activo, el dado o el primero). */
export async function getBoard(pipelineId?: string): Promise<Board> {
  const user = await requireUser();
  await ensureDefaultPipeline(user.id);

  const pipelineList = await db
    .select({ id: pipelines.id, name: pipelines.name })
    .from(pipelines)
    .where(eq(pipelines.ownerId, user.id))
    .orderBy(asc(pipelines.position), asc(pipelines.createdAt));

  const active =
    pipelineList.find((p) => p.id === pipelineId) ?? pipelineList[0] ?? null;

  if (!active) {
    return {
      pipelines: pipelineList,
      activePipelineId: null,
      columns: [],
      totals: { count: 0, sum: 0, forecast: 0 },
    };
  }

  const stageRows = await db
    .select({
      id: stages.id,
      name: stages.name,
      probability: stages.probability,
      rottingDays: stages.rottingDays,
    })
    .from(stages)
    .where(and(eq(stages.pipelineId, active.id), eq(stages.ownerId, user.id)))
    .orderBy(asc(stages.position), asc(stages.createdAt));

  const dealRows = await db.query.deals.findMany({
    where: and(
      eq(deals.ownerId, user.id),
      eq(deals.pipelineId, active.id),
      eq(deals.status, "open"),
      isNull(deals.deletedAt),
    ),
    with: {
      person: { columns: { id: true, firstName: true, lastName: true } },
      organization: { columns: { id: true, name: true } },
    },
    orderBy: [asc(deals.position), desc(deals.createdAt)],
  });

  const cardsByStage = new Map<string, DealCard[]>();
  for (const s of stageRows) cardsByStage.set(s.id, []);

  let sum = 0;
  let forecast = 0;
  const stageProbability = new Map(stageRows.map((s) => [s.id, s.probability]));

  for (const d of dealRows) {
    const card: DealCard = {
      id: d.id,
      title: d.title,
      value: d.value,
      currency: d.currency,
      stageId: d.stageId,
      position: d.position,
      rotting: isRotting(
        d.stageChangedAt,
        stageRows.find((s) => s.id === d.stageId)?.rottingDays ?? null,
        d.status,
      ),
      expectedCloseDate: d.expectedCloseDate,
      person: d.person
        ? {
            id: d.person.id,
            name: [d.person.firstName, d.person.lastName]
              .filter(Boolean)
              .join(" "),
          }
        : null,
      organization: d.organization
        ? { id: d.organization.id, name: d.organization.name }
        : null,
    };
    cardsByStage.get(d.stageId)?.push(card);
    sum += d.value;
    forecast += d.value * ((stageProbability.get(d.stageId) ?? 0) / 100);
  }

  const columns: BoardColumn[] = stageRows.map((s) => {
    const cards = cardsByStage.get(s.id) ?? [];
    return {
      stage: s,
      deals: cards,
      count: cards.length,
      total: cards.reduce((acc, c) => acc + c.value, 0),
    };
  });

  return {
    pipelines: pipelineList,
    activePipelineId: active.id,
    columns,
    totals: { count: dealRows.length, sum, forecast },
  };
}
