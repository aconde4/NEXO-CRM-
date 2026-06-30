/**
 * Copias de seguridad completas (Fase 10.4). La tabla guarda la bitacora de
 * exportaciones manuales y programadas; el contenido de la copia vive como JSON
 * descargable o en Supabase Storage privado cuando la ejecuta el cron.
 */
import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";

export type BackupExportKind = "manual" | "scheduled";
export type BackupExportStatus = "completed" | "failed";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
};

export const backupExports = pgTable(
  "backup_exports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").$type<BackupExportKind>().notNull(),
    status: text("status").$type<BackupExportStatus>().notNull(),
    format: text("format").default("json").notNull(),
    fileName: text("file_name"),
    storageBucket: text("storage_bucket"),
    storagePath: text("storage_path"),
    bytes: integer("bytes").default(0).notNull(),
    checksumSha256: text("checksum_sha256"),
    tableCounts: jsonb("table_counts")
      .$type<Record<string, number>>()
      .default({})
      .notNull(),
    error: text("error"),
    ...timestamps,
  },
  (t) => [
    index("backup_exports_owner_idx").on(t.ownerId),
    index("backup_exports_status_idx").on(t.status),
    index("backup_exports_created_idx").on(t.createdAt),
  ],
);

export const backupExportsRelations = relations(backupExports, ({ one }) => ({
  owner: one(users, { fields: [backupExports.ownerId], references: [users.id] }),
}));
