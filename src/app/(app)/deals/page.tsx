import type { Metadata } from "next";

import {
  listOrganizationOptions,
  listPersonOptions,
} from "@/server/queries/contacts";
import { getBoard, listStagesByPipeline } from "@/server/queries/deals";
import { DealsBoard } from "@/components/deals/deals-board";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Negocios" };

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{ pipeline?: string }>;
}) {
  const { pipeline } = await searchParams;

  const [board, stagesByPipeline, persons, organizations] = await Promise.all([
    getBoard(pipeline),
    listStagesByPipeline(),
    listPersonOptions(),
    listOrganizationOptions(),
  ]);

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
      />
    </>
  );
}
