import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import {
  type SegmentRow,
  SegmentsView,
} from "@/components/segments/segments-view";
import { listLabels } from "@/server/queries/labels";
import { countSegmentAudience, listSegments } from "@/server/queries/segments";
import { listSequenceEnrollmentOptions } from "@/server/queries/sequences";

export const metadata: Metadata = { title: "Segmentos" };

export default async function SegmentsPage() {
  const [segments, labels, sequenceOptions] = await Promise.all([
    listSegments(),
    listLabels(),
    listSequenceEnrollmentOptions(),
  ]);

  // Audiencia por segmento (pocos segmentos en un CRM personal: cálculo en paralelo).
  const rows: SegmentRow[] = await Promise.all(
    segments.map(async (s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      kind: s.kind,
      definition: s.definition,
      audience: await countSegmentAudience(s.definition),
    })),
  );

  const labelOptions = labels.map((l) => ({ id: l.id, name: l.name }));

  return (
    <>
      <PageHeader
        title="Segmentos"
        description="Audiencias por filtros para tus campañas. Reutilizan los datos de tus contactos."
      />
      <SegmentsView
        segments={rows}
        labels={labelOptions}
        sequenceOptions={sequenceOptions}
      />
    </>
  );
}
