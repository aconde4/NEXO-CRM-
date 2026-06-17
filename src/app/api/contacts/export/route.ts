import { auth } from "@/auth";
import { csvFilename, toCsv } from "@/lib/csv";
import { listPersonsForExport } from "@/server/queries/contacts";
import { getLabelsForPersons } from "@/server/queries/labels";

const marketingLabels: Record<string, string> = {
  subscribed: "Suscrito",
  unsubscribed: "Baja",
  bounced: "Rebotado",
  complained: "Queja",
};

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("No autorizado", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? undefined;
  const label = searchParams.get("label") ?? undefined;

  const people = await listPersonsForExport(q, label || undefined);
  const labelMap = await getLabelsForPersons(people.map((p) => p.id));

  const headers = [
    "Nombre",
    "Apellidos",
    "Email",
    "Teléfono",
    "Cargo",
    "Empresa",
    "Origen",
    "Estado marketing",
    "Etiquetas",
    "Creado",
  ];

  const rows = people.map((p) => [
    p.firstName,
    p.lastName ?? "",
    p.email ?? "",
    p.phone ?? "",
    p.title ?? "",
    p.organization?.name ?? "",
    p.source ?? "",
    marketingLabels[p.marketingStatus] ?? p.marketingStatus,
    (labelMap[p.id] ?? []).map((l) => l.name).join(", "),
    p.createdAt.toISOString().slice(0, 10),
  ]);

  return new Response(toCsv(headers, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFilename("contactos")}"`,
      "Cache-Control": "no-store",
    },
  });
}
