import "server-only";

import {
  type SQL,
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  sql,
} from "drizzle-orm";

import { requireUser } from "@/lib/session";
import { db } from "@/server/db";
import {
  activities,
  dealContacts,
  deals,
  notes,
  organizations,
  persons,
  pipelines,
  stages,
  type DealStatus,
} from "@/server/db/schema";

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

/** Negocio completo para su ficha (con etapa, embudo, contacto, empresa, etc.). */
export async function getDeal(id: string) {
  const user = await requireUser();
  return db.query.deals.findFirst({
    where: and(
      eq(deals.id, id),
      eq(deals.ownerId, user.id),
      isNull(deals.deletedAt),
    ),
    with: {
      stage: { columns: { id: true, name: true, probability: true } },
      pipeline: { columns: { id: true, name: true } },
      person: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          title: true,
          customFields: true,
        },
      },
      organization: {
        columns: {
          id: true,
          name: true,
          tradeName: true,
          website: true,
          industry: true,
          customFields: true,
        },
      },
      contacts: {
        with: {
          person: { columns: { id: true, firstName: true, lastName: true } },
        },
        orderBy: [asc(dealContacts.createdAt)],
      },
      activities: { orderBy: [desc(activities.createdAt)], limit: 100 },
      notes: { orderBy: [desc(notes.createdAt)], limit: 50 },
    },
  });
}
export type DealDetail = Awaited<ReturnType<typeof getDeal>>;

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

export type DealListStatusFilter = DealStatus | "all";
export type DealListSort =
  | "recent"
  | "oldest"
  | "value-desc"
  | "value-asc"
  | "close-date";

export type DealListFilters = {
  pipelineId?: string;
  stageId?: string;
  status?: string;
  query?: string;
  sort?: string;
  personIds?: string[];
};

export type DealListItem = {
  id: string;
  title: string;
  value: number;
  currency: string;
  pipelineId: string;
  stageId: string;
  personId: string | null;
  orgId: string | null;
  status: DealStatus;
  expectedCloseDate: Date | null;
  createdAt: Date;
  stageChangedAt: Date;
  wonAt: Date | null;
  lostAt: Date | null;
  lostReason: string | null;
  rotting: boolean;
  pipeline: { id: string; name: string };
  stage: { id: string; name: string; probability: number };
  person: { id: string; name: string } | null;
  organization: { id: string; name: string } | null;
};

function normalizeStatus(status?: string): DealListStatusFilter {
  if (status === "all" || status === "won" || status === "lost") {
    return status;
  }
  return "open";
}

function normalizeSort(sort?: string): DealListSort {
  switch (sort) {
    case "oldest":
    case "value-desc":
    case "value-asc":
    case "close-date":
      return sort;
    default:
      return "recent";
  }
}

function dealListOrderBy(sort?: string): SQL[] {
  switch (normalizeSort(sort)) {
    case "oldest":
      return [asc(deals.createdAt)];
    case "value-desc":
      return [desc(deals.value), desc(deals.createdAt)];
    case "value-asc":
      return [asc(deals.value), desc(deals.createdAt)];
    case "close-date":
      return [
        sql`${deals.expectedCloseDate} asc nulls last`,
        desc(deals.createdAt),
      ];
    default:
      return [desc(deals.createdAt)];
  }
}

/**
 * Filtro por contacto para el embudo (6.4d). `undefined` = sin filtro; array vacío =
 * ningún resultado (el filtro no casó con ningún contacto).
 */
function personIdsFilter(personIds?: string[]): SQL | undefined {
  if (!personIds) return undefined;
  if (personIds.length === 0) return sql`false`;
  return inArray(deals.personId, personIds);
}

/** Datos del tablero Kanban para un embudo (el activo, el dado o el primero). */
export async function getBoard(
  pipelineId?: string,
  opts: { personIds?: string[] } = {},
): Promise<Board> {
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
      personIdsFilter(opts.personIds),
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

/** Vista tabular de negocios, filtrable por embudo, etapa, estado y texto. */
export async function listDeals(filters: DealListFilters = {}) {
  const user = await requireUser();
  const where: SQL[] = [eq(deals.ownerId, user.id), isNull(deals.deletedAt)];

  if (filters.pipelineId) {
    where.push(eq(deals.pipelineId, filters.pipelineId));
  }
  if (filters.stageId) {
    where.push(eq(deals.stageId, filters.stageId));
  }

  const status = normalizeStatus(filters.status);
  if (status !== "all") {
    where.push(eq(deals.status, status));
  }

  if (filters.query?.trim()) {
    const q = `%${filters.query.trim()}%`;
    const match = or(
      ilike(deals.title, q),
      ilike(persons.firstName, q),
      ilike(persons.lastName, q),
      ilike(organizations.name, q),
    );
    if (match) where.push(match);
  }

  const personFilter = personIdsFilter(filters.personIds);
  if (personFilter) where.push(personFilter);

  const rows = await db
    .select({
      id: deals.id,
      title: deals.title,
      value: deals.value,
      currency: deals.currency,
      pipelineId: deals.pipelineId,
      stageId: deals.stageId,
      personId: deals.personId,
      orgId: deals.orgId,
      status: deals.status,
      expectedCloseDate: deals.expectedCloseDate,
      createdAt: deals.createdAt,
      stageChangedAt: deals.stageChangedAt,
      wonAt: deals.wonAt,
      lostAt: deals.lostAt,
      lostReason: deals.lostReason,
      pipelineName: pipelines.name,
      stageName: stages.name,
      stageProbability: stages.probability,
      rottingDays: stages.rottingDays,
      personFirstName: persons.firstName,
      personLastName: persons.lastName,
      organizationName: organizations.name,
    })
    .from(deals)
    .innerJoin(pipelines, eq(deals.pipelineId, pipelines.id))
    .innerJoin(stages, eq(deals.stageId, stages.id))
    .leftJoin(
      persons,
      and(eq(deals.personId, persons.id), isNull(persons.deletedAt)),
    )
    .leftJoin(
      organizations,
      and(eq(deals.orgId, organizations.id), isNull(organizations.deletedAt)),
    )
    .where(and(...where))
    .orderBy(...dealListOrderBy(filters.sort))
    .limit(300);

  return rows.map<DealListItem>((row) => ({
    id: row.id,
    title: row.title,
    value: row.value,
    currency: row.currency,
    pipelineId: row.pipelineId,
    stageId: row.stageId,
    personId: row.personId,
    orgId: row.orgId,
    status: row.status,
    expectedCloseDate: row.expectedCloseDate,
    createdAt: row.createdAt,
    stageChangedAt: row.stageChangedAt,
    wonAt: row.wonAt,
    lostAt: row.lostAt,
    lostReason: row.lostReason,
    rotting: isRotting(row.stageChangedAt, row.rottingDays, row.status),
    pipeline: { id: row.pipelineId, name: row.pipelineName },
    stage: {
      id: row.stageId,
      name: row.stageName,
      probability: row.stageProbability,
    },
    person: row.personId
      ? {
          id: row.personId,
          name: [row.personFirstName, row.personLastName]
            .filter(Boolean)
            .join(" "),
        }
      : null,
    organization: row.orgId
      ? { id: row.orgId, name: row.organizationName ?? "Empresa eliminada" }
      : null,
  }));
}
