import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { db } from "@/server/db";
import { backupExports } from "@/server/db/schema";
import { createSignedBackupDownloadUrl } from "@/server/storage";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("No autorizado", { status: 401 });
  }

  const { id } = await params;
  const [backup] = await db
    .select({
      fileName: backupExports.fileName,
      storagePath: backupExports.storagePath,
    })
    .from(backupExports)
    .where(
      and(
        eq(backupExports.id, id),
        eq(backupExports.ownerId, session.user.id),
        eq(backupExports.status, "completed"),
      ),
    )
    .limit(1);

  if (!backup?.storagePath || !backup.fileName) {
    return new Response("Copia no encontrada", { status: 404 });
  }

  const url = await createSignedBackupDownloadUrl(
    backup.storagePath,
    backup.fileName,
  );

  return NextResponse.redirect(url);
}
