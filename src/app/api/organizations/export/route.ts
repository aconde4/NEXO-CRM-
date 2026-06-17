import { auth } from "@/auth";
import { csvFilename, toCsv } from "@/lib/csv";
import { listOrganizationsForExport } from "@/server/queries/contacts";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("No autorizado", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? undefined;

  const orgs = await listOrganizationsForExport(q);

  const headers = [
    "Nombre",
    "Dominio",
    "Sitio web",
    "Teléfono",
    "Sector",
    "Tamaño",
    "Dirección",
    "Nº de contactos",
    "Creada",
  ];

  const rows = orgs.map((o) => [
    o.name,
    o.domain ?? "",
    o.website ?? "",
    o.phone ?? "",
    o.industry ?? "",
    o.size ?? "",
    o.address ?? "",
    o.persons.length,
    o.createdAt.toISOString().slice(0, 10),
  ]);

  return new Response(toCsv(headers, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFilename("empresas")}"`,
      "Cache-Control": "no-store",
    },
  });
}
