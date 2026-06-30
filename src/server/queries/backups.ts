import "server-only";

import { requireUser } from "@/lib/session";
import {
  getBackupRuntimeStatus,
  listRecentBackupExports,
} from "@/server/services/backups";

export async function getBackupSettingsData() {
  const user = await requireUser();
  const [runtime, exports] = await Promise.all([
    getBackupRuntimeStatus(),
    listRecentBackupExports(user.id),
  ]);

  return { exports, runtime };
}
