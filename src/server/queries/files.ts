import "server-only";

import { and, desc, eq } from "drizzle-orm";

import type { CustomEntityType } from "@/lib/custom-fields";
import { requireUser } from "@/lib/session";
import { db } from "@/server/db";
import { files } from "@/server/db/schema";

export type FileItem = {
  id: string;
  name: string;
  size: number;
  mime: string | null;
  createdAt: Date;
};

export async function listFilesFor(
  entityType: CustomEntityType,
  entityId: string,
): Promise<FileItem[]> {
  const user = await requireUser();
  return db
    .select({
      id: files.id,
      name: files.name,
      size: files.size,
      mime: files.mime,
      createdAt: files.createdAt,
    })
    .from(files)
    .where(
      and(
        eq(files.ownerId, user.id),
        eq(files.entityType, entityType),
        eq(files.entityId, entityId),
      ),
    )
    .orderBy(desc(files.createdAt));
}
