import { auth } from "@/auth";
import { csvFilename, toCsv } from "@/lib/csv";
import { REPORT_STATUS_LABELS, parseReportParams } from "@/lib/reports";
import { fetchDealsReportRows } from "@/server/queries/reports";

function isoDate(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : "";
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("No autorizado", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const params = parseReportParams((key) => searchParams.get(key));
  const rows = await fetchDealsReportRows(session.user.id, params);

  const headers = [
    "Negocio",
    "Empresa",
    "Contacto",
    "Embudo",
    "Etapa",
    "Estado",
    "Valor",
    "Campaña",
    "Creado",
    "Ganado",
  ];

  const csvRows = rows.map((row) => [
    row.title,
    row.orgName ?? "",
    row.personName ?? "",
    row.pipelineName ?? "",
    row.stageName ?? "",
    REPORT_STATUS_LABELS[row.status],
    String(row.value),
    row.campaign ?? "",
    isoDate(row.createdAt),
    isoDate(row.wonAt),
  ]);

  return new Response(toCsv(headers, csvRows), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${csvFilename("informe-negocios")}"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
