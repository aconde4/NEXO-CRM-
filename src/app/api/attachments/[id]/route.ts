import { and, eq } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/server/db";
import { files } from "@/server/db/schema";
import { createSignedDownloadUrl, isStorageConfigured } from "@/server/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("No autorizado", { status: 401 });
  }
  if (!isStorageConfigured()) {
    return new Response("Almacenamiento no configurado", { status: 503 });
  }

  const { id } = await params;
  const [row] = await db
    .select({ path: files.path, name: files.name })
    .from(files)
    .where(and(eq(files.id, id), eq(files.ownerId, session.user.id)))
    .limit(1);

  if (!row) return new Response("No encontrado", { status: 404 });

  try {
    const url = await createSignedDownloadUrl(row.path, row.name);
    return Response.redirect(url, 302);
  } catch (error) {
    return new Response(
      error instanceof Error ? error.message : "Error al generar el enlace",
      { status: 502 },
    );
  }
}
