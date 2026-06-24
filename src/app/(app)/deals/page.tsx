import type { Metadata } from "next";

import { decodeContactFilterParams } from "@/lib/contact-filters";
import {
  listOrganizationOptions,
  listPersonIdsByFilters,
  listPersonOptions,
} from "@/server/queries/contacts";
import { listCustomFieldDefs } from "@/server/queries/custom-fields";
import {
  getBoard,
  listDeals,
  listPipelines,
  listStagesByPipeline,
  type DealListSort,
  type DealListStatusFilter,
} from "@/server/queries/deals";
import { DealsBoard } from "@/components/deals/deals-board";
import { DealsListView } from "@/components/deals/deals-list-view";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Negocios" };

type DealsSearchParams = {
  view?: string | string[];
  pipeline?: string | string[];
  stage?: string | string[];
  status?: string | string[];
  q?: string | string[];
  sort?: string | string[];
  filter?: string | string[];
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeStatus(value: string | undefined): DealListStatusFilter {
  if (value === "all" || value === "won" || value === "lost") return value;
  return "open";
}

function normalizeSort(value: string | undefined): DealListSort {
  if (
    value === "oldest" ||
    value === "value-desc" ||
    value === "value-asc" ||
    value === "close-date"
  ) {
    return value;
  }
  return "recent";
}

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<DealsSearchParams>;
}) {
  const params = await searchParams;
  const view = firstParam(params.view) === "list" ? "list" : "board";
  const pipelineParam = firstParam(params.pipeline);
  const stageParam = firstParam(params.stage);
  const query = firstParam(params.q) ?? "";
  const status = normalizeStatus(firstParam(params.status));
  const sort = normalizeSort(firstParam(params.sort));

  const pipelines = await listPipelines();
  const activePipelineId =
    pipelines.find((pipeline) => pipeline.id === pipelineParam)?.id ??
    pipelines[0]?.id ??
    "";

  const [stagesByPipeline, persons, organizations, customFieldDefs] =
    await Promise.all([
      listStagesByPipeline(),
      listPersonOptions(),
      listOrganizationOptions(),
      listCustomFieldDefs("person"),
    ]);

  const activeStages = stagesByPipeline[activePipelineId] ?? [];
  const activeStageId =
    activeStages.find((stage) => stage.id === stageParam)?.id ?? "";

  // Filtros 6.4b aplicados al embudo de contactos (6.4d): acotan por contacto.
  const conditions = decodeContactFilterParams(params.filter, customFieldDefs);
  const personIds =
    conditions.length > 0
      ? await listPersonIdsByFilters({ conditions })
      : undefined;

  if (view === "list") {
    const deals = await listDeals({
      pipelineId: activePipelineId || undefined,
      stageId: activeStageId || undefined,
      status,
      query,
      sort,
      personIds,
    });

    return (
      <>
        <PageHeader
          title="Negocios"
          description={`${deals.length} ${
            deals.length === 1 ? "negocio" : "negocios"
          } en la vista de lista.`}
        />
        <DealsListView
          deals={deals}
          filters={{
            pipelineId: activePipelineId,
            stageId: activeStageId,
            status,
            query,
            sort,
          }}
          pipelines={pipelines}
          stagesByPipeline={stagesByPipeline}
          persons={persons}
          organizations={organizations}
          conditions={conditions}
          customFieldDefs={customFieldDefs}
        />
      </>
    );
  }

  const board = await getBoard(activePipelineId, { personIds });

  // Firma de los datos: cambia al crear/mover/editar y remonta el tablero para
  // re-sincronizar su estado local tras revalidar.
  const signature = board.columns
    .map((c) => `${c.stage.id}:${c.deals.map((d) => d.id).join(",")}`)
    .join("|");

  return (
    <>
      <PageHeader
        title="Negocios"
        description="Tu embudo de ventas. Arrastra las tarjetas entre etapas."
      />
      <DealsBoard
        key={`${board.activePipelineId}-${signature}`}
        board={board}
        stagesByPipeline={stagesByPipeline}
        persons={persons}
        organizations={organizations}
        conditions={conditions}
        customFieldDefs={customFieldDefs}
      />
    </>
  );
}
