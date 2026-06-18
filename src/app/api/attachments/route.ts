import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { db } from "@/server/db";
import { files, organizations, persons } from "@/server/db/schema";
import { isStorageConfigured, uploadObject } from "@/server/storage";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitizeName(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 120) || "archivo"
  );
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!isStorageConfigured()) {
    return Response.json(
      { error: "El almacenamiento de archivos no está configurado." },
      { status: 503 },
    );
  }

  const form = await request.formData();
  const file = form.get("file");
  const entityType = String(form.get("entityType") ?? "");
  const entityId = String(form.get("entityId") ?? "");

  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "Archivo no válido" }, { status: 400 });
  }
  if (entityType !== "person" && entityType !== "organization") {
    return Response.json({ error: "Entidad no válida" }, { status: 400 });
  }
  if (!UUID_RE.test(entityId)) {
    return Response.json({ error: "Identificador no válido" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json(
      { error: "El archivo supera el máximo de 10 MB." },
      { status: 413 },
    );
  }

  // Autorización: la entidad debe pertenecer al usuario.
  const owned =
    entityType === "person"
      ? await db
          .select({ id: persons.id })
          .from(persons)
          .where(
            and(
              eq(persons.id, entityId),
              eq(persons.ownerId, session.user.id),
              isNull(persons.deletedAt),
            ),
          )
          .limit(1)
      : await db
          .select({ id: organizations.id })
          .from(organizations)
          .where(
            and(
              eq(organizations.id, entityId),
              eq(organizations.ownerId, session.user.id),
              isNull(organizations.deletedAt),
            ),
          )
          .limit(1);

  if (!owned[0]) {
    return Response.json({ error: "Entidad no encontrada" }, { status: 404 });
  }

  const path = `${session.user.id}/${entityType}/${entityId}/${randomUUID()}-${sanitizeName(
    file.name,
  )}`;

  try {
    await uploadObject(path, await file.arrayBuffer(), file.type);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Error al subir" },
      { status: 502 },
    );
  }

  const [row] = await db
    .insert(files)
    .values({
      name: file.name.slice(0, 255),
      path,
      size: file.size,
      mime: file.type || null,
      entityType,
      entityId,
      ownerId: session.user.id,
    })
    .returning({ id: files.id });

  const base = entityType === "person" ? "/contacts" : "/organizations";
  revalidatePath(`${base}/${entityId}`);
  return Response.json({ id: row?.id });
}
