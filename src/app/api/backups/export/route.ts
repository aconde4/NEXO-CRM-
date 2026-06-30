import { auth } from "@/auth";
import { createManualBackupExport } from "@/server/services/backups";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("No autorizado", { status: 401 });
  }

  const backup = await createManualBackupExport(session.user.id);

  return new Response(backup.json, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${backup.fileName}"`,
      "Content-Type": "application/json; charset=utf-8",
      "X-Backup-Checksum-Sha256": backup.checksumSha256,
    },
  });
}
