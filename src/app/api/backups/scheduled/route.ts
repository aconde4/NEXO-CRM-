import {
  createScheduledBackupExport,
  isValidBackupCronRequest,
  resolveScheduledBackupOwner,
} from "@/server/services/backups";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isValidBackupCronRequest(request)) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const owner = await resolveScheduledBackupOwner();
  if (!owner) {
    return Response.json(
      {
        error:
          "No se encontro el usuario de BACKUP_OWNER_EMAIL/ALLOWED_EMAILS para generar la copia.",
      },
      { status: 404 },
    );
  }

  const result = await createScheduledBackupExport(owner.id);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 500 });
  }

  return Response.json({
    bytes: result.bytes,
    checksumSha256: result.checksumSha256,
    fileName: result.fileName,
    ok: true,
    ownerEmail: owner.email,
    storageBucket: result.storageBucket,
    storagePath: result.storagePath,
    tableCounts: result.tableCounts,
  });
}
