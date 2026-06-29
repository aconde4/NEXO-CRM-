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
  dealStageEvents,
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

// --- Métricas del embudo (6.4i) ---------------------------------------------
export type FunnelStageMetric = {
  id: string;
  name: string;
  probability: number;
  rottingDays: number | null;
  /** Negocios abiertos actualmente en esta etapa. */
  count: number;
  /** Suma del valor de los negocios abiertos en esta etapa. */
  value: number;
  /** Abiertos y estancados en esta etapa. */
  stalled: number;
  /** Abiertos en esta etapa o más adelante (embudo acumulado, instantánea). */
  reached: number;
  /** % de conversión desde la etapa anterior (`reached`/`reached` anterior). */
  conversionFromPrev: number | null;
  /** Histórico (6.4i): negocios distintos que entraron alguna vez en esta etapa. */
  entered?: number;
  /** Histórico: % de los que entraron en la etapa anterior que llegaron a esta. */
  historicalConversion?: number | null;
};

export type FunnelCampaignMetric = {
  campaign: string | null;
  count: number;
  value: number;
};

export type FunnelMetrics = {
  pipelines: PipelineOption[];
  activePipelineId: string | null;
  stages: FunnelStageMetric[];
  totals: {
    open: number;
    value: number;
    forecast: number;
    stalled: number;
    won: number;
    lost: number;
  };
  byCampaign: FunnelCampaignMetric[];
  hasMoreCampaigns: boolean;
};

const FUNNEL_CAMPAIGN_LIMIT = 8;

/**
 * Métricas del embudo (6.4i). Instantánea del estado actual: como aún no hay
 * historial de cambios de etapa (solo `deals.stageChangedAt`), la "conversión"
 * entre etapas se calcula sobre los negocios abiertos que están en cada etapa o
 * más adelante (`reached`), no sobre un log temporal. Respeta el filtro de
 * contacto (6.4b) vía `personIds`.
 */
export async function getFunnelMetrics(
  pipelineId?: string,
  opts: { personIds?: string[] } = {},
): Promise<FunnelMetrics> {
  const user = await requireUser();
  await ensureDefaultPipeline(user.id);

  const pipelineList = await db
    .select({ id: pipelines.id, name: pipelines.name })
    .from(pipelines)
    .where(eq(pipelines.ownerId, user.id))
    .orderBy(asc(pipelines.position), asc(pipelines.createdAt));

  const active =
    pipelineList.find((p) => p.id === pipelineId) ?? pipelineList[0] ?? null;

  const empty: FunnelMetrics = {
    pipelines: pipelineList,
    activePipelineId: active?.id ?? null,
    stages: [],
    totals: { open: 0, value: 0, forecast: 0, stalled: 0, won: 0, lost: 0 },
    byCampaign: [],
    hasMoreCampaigns: false,
  };
  if (!active) return empty;

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

  const dealRows = await db
    .select({
      stageId: deals.stageId,
      value: deals.value,
      status: deals.status,
      stageChangedAt: deals.stageChangedAt,
      campaign: persons.campaign,
    })
    .from(deals)
    .leftJoin(persons, eq(deals.personId, persons.id))
    .where(
      and(
        eq(deals.ownerId, user.id),
        eq(deals.pipelineId, active.id),
        isNull(deals.deletedAt),
        personIdsFilter(opts.personIds),
      ),
    );

  const metrics = computeFunnelMetrics(pipelineList, active, stageRows, dealRows);

  // Conversión temporal real (6.4i): negocios distintos que entraron en cada etapa,
  // según el historial `deal_stage_events`.
  const enteredRows = await db
    .select({
      toStageId: dealStageEvents.toStageId,
      count: sql<number>`count(distinct ${dealStageEvents.dealId})::int`,
    })
    .from(dealStageEvents)
    .where(
      and(
        eq(dealStageEvents.ownerId, user.id),
        eq(dealStageEvents.pipelineId, active.id),
      ),
    )
    .groupBy(dealStageEvents.toStageId);
  const enteredByStage = new Map(
    enteredRows.map((row) => [row.toStageId, row.count]),
  );

  let prevEntered: number | null = null;
  const stagesWithHistory = metrics.stages.map((stage, index) => {
    const entered = enteredByStage.get(stage.id) ?? 0;
    const historicalConversion =
      index === 0
        ? null
        : prevEntered && prevEntered > 0
          ? Math.round((entered / prevEntered) * 100)
          : 0;
    prevEntered = entered;
    return { ...stage, entered, historicalConversion };
  });

  return { ...metrics, stages: stagesWithHistory };
}

type FunnelStageRow = {
  id: string;
  name: string;
  probability: number;
  rottingDays: number | null;
};
type FunnelDealRow = {
  stageId: string;
  value: number;
  status: string;
  stageChangedAt: Date;
  campaign: string | null;
};

/**
 * Agregación pura de las métricas del embudo (sin IO). Separada de la consulta
 * para poder verificarla con datos sintéticos. `now` permite fijar el reloj en
 * pruebas para el cálculo de estancamiento.
 */
export function computeFunnelMetrics(
  pipelineList: PipelineOption[],
  active: PipelineOption | null,
  stageRows: FunnelStageRow[],
  dealRows: FunnelDealRow[],
  now: number = Date.now(),
): FunnelMetrics {
  const base: Omit<FunnelMetrics, "activePipelineId"> = {
    pipelines: pipelineList,
    stages: [],
    totals: { open: 0, value: 0, forecast: 0, stalled: 0, won: 0, lost: 0 },
    byCampaign: [],
    hasMoreCampaigns: false,
  };
  if (!active) return { ...base, activePipelineId: null };

  const perStage = new Map<
    string,
    { count: number; value: number; stalled: number }
  >();
  for (const s of stageRows) perStage.set(s.id, { count: 0, value: 0, stalled: 0 });
  const rottingByStage = new Map(stageRows.map((s) => [s.id, s.rottingDays]));
  const campaignMap = new Map<string | null, { count: number; value: number }>();

  let won = 0;
  let lost = 0;

  for (const d of dealRows) {
    if (d.status === "won") {
      won += 1;
      continue;
    }
    if (d.status === "lost") {
      lost += 1;
      continue;
    }
    // Abierto: cuenta por etapa, estancamiento y campaña.
    const agg = perStage.get(d.stageId);
    if (agg) {
      agg.count += 1;
      agg.value += d.value;
      const rottingDays = rottingByStage.get(d.stageId) ?? null;
      if (
        rottingDays != null &&
        (now - d.stageChangedAt.getTime()) / 86_400_000 > rottingDays
      ) {
        agg.stalled += 1;
      }
    }
    const key = d.campaign?.trim() ? d.campaign.trim() : null;
    const c = campaignMap.get(key) ?? { count: 0, value: 0 };
    c.count += 1;
    c.value += d.value;
    campaignMap.set(key, c);
  }

  let open = 0;
  let value = 0;
  let forecast = 0;
  let stalled = 0;
  for (const s of stageRows) {
    const agg = perStage.get(s.id)!;
    open += agg.count;
    value += agg.value;
    forecast += agg.value * (s.probability / 100);
    stalled += agg.stalled;
  }

  // `reached` = abiertos en la etapa o más adelante (acumulado de atrás a delante).
  const reachedByStage = new Map<string, number>();
  let acc = 0;
  for (let i = stageRows.length - 1; i >= 0; i--) {
    acc += perStage.get(stageRows[i]!.id)!.count;
    reachedByStage.set(stageRows[i]!.id, acc);
  }

  const stagesOut: FunnelStageMetric[] = stageRows.map((s, i) => {
    const agg = perStage.get(s.id)!;
    const reached = reachedByStage.get(s.id)!;
    const prevReached =
      i === 0 ? null : reachedByStage.get(stageRows[i - 1]!.id)!;
    const conversionFromPrev =
      prevReached == null
        ? null
        : prevReached > 0
          ? Math.round((reached / prevReached) * 100)
          : 0;
    return {
      id: s.id,
      name: s.name,
      probability: s.probability,
      rottingDays: s.rottingDays,
      count: agg.count,
      value: agg.value,
      stalled: agg.stalled,
      reached,
      conversionFromPrev,
    };
  });

  const allCampaigns = [...campaignMap.entries()]
    .map(([campaign, v]) => ({ campaign, count: v.count, value: v.value }))
    .sort((a, b) => b.count - a.count || b.value - a.value);

  return {
    pipelines: pipelineList,
    activePipelineId: active.id,
    stages: stagesOut,
    totals: { open, value, forecast, stalled, won, lost },
    byCampaign: allCampaigns.slice(0, FUNNEL_CAMPAIGN_LIMIT),
    hasMoreCampaigns: allCampaigns.length > FUNNEL_CAMPAIGN_LIMIT,
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
