import { auth } from "@/auth";
import { csvFilename, toCsv } from "@/lib/csv";
import { formatCustomValue, isEmptyCustomValue } from "@/lib/custom-fields";
import { listOrganizationsForExport } from "@/server/queries/contacts";
import { listCustomFieldDefs } from "@/server/queries/custom-fields";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("No autorizado", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? undefined;

  const [orgs, defs] = await Promise.all([
    listOrganizationsForExport(q),
    listCustomFieldDefs("organization"),
  ]);

  const headers = [
    "Nombre",
    "Nombre comercial",
    "Dominio",
    "Sitio web",
    "Teléfono",
    "Sector",
    "Tamaño",
    "Dirección",
    "Nº de contactos",
    "Creada",
    ...defs.map((d) => d.label),
  ];

  const rows = orgs.map((o) => [
    o.name,
    o.tradeName ?? "",
    o.domain ?? "",
    o.website ?? "",
    o.phone ?? "",
    o.industry ?? "",
    o.size ?? "",
    o.address ?? "",
    o.persons.length,
    o.createdAt.toISOString().slice(0, 10),
    ...defs.map((d) => {
      const raw = o.customFields?.[d.key];
      return isEmptyCustomValue(raw) ? "" : formatCustomValue(d.type, raw);
    }),
  ]);

  return new Response(toCsv(headers, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFilename("empresas")}"`,
      "Cache-Control": "no-store",
    },
  });
}
