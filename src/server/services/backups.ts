import "server-only";

import { createHash } from "node:crypto";

import { asc, desc, eq, sql } from "drizzle-orm";

import { db } from "@/server/db";
import {
  activities,
  activityLog,
  aiRuns,
  automationRuns,
  automations,
  backupExports,
  campaigns,
  campaignRecipients,
  customFieldDefs,
  dealContacts,
  deals,
  dealStageEvents,
  documents,
  emailEvents,
  emailMessages,
  emailTemplates,
  emailThreads,
  enrollments,
  entityLabels,
  files,
  formSubmissions,
  forms,
  goals,
  labels,
  leads,
  mailboxes,
  notes,
  organizations,
  persons,
  pipelines,
  products,
  quoteItems,
  quotes,
  savedViews,
  segments,
  sequenceSteps,
  sequences,
  stages,
  suppressions,
  users,
} from "@/server/db/schema";
import {
  BACKUP_STORAGE_BUCKET,
  isStorageConfigured,
  uploadBackupObject,
} from "@/server/storage";

export const BACKUP_SCHEMA_VERSION = 1;

export type BackupRuntimeStatus = {
  storageConfigured: boolean;
  storageBucket: string;
  cronSecretConfigured: boolean;
  ownerEmailConfigured: boolean;
  scheduledReady: boolean;
};

export type BackupExportListItem = {
  id: string;
  kind: "manual" | "scheduled";
  status: "completed" | "failed";
  fileName: string | null;
  storageBucket: string | null;
  storagePath: string | null;
  bytes: number;
  checksumSha256: string | null;
  tableCounts: Record<string, number>;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
};

function configuredOwnerEmail(): string | null {
  return (
    process.env.BACKUP_OWNER_EMAIL?.trim().toLowerCase() ||
    (process.env.ALLOWED_EMAILS ?? "")
      .split(",")[0]
      ?.trim()
      .toLowerCase() ||
    null
  );
}

export function getBackupRuntimeStatus(): BackupRuntimeStatus {
  const cronSecretConfigured =
    (process.env.CRON_SECRET?.trim() ??
      process.env.BACKUP_CRON_SECRET?.trim() ??
      "") !== "";
  const ownerEmailConfigured = configuredOwnerEmail() !== null;
  const storageConfigured = isStorageConfigured();

  return {
    cronSecretConfigured,
    ownerEmailConfigured,
    scheduledReady:
      cronSecretConfigured && ownerEmailConfigured && storageConfigured,
    storageBucket: BACKUP_STORAGE_BUCKET,
    storageConfigured,
  };
}

function backupFileName(generatedAt: Date): string {
  const stamp = generatedAt.toISOString().replace(/[:.]/g, "-");
  return `nexo-crm-backup-${stamp}.json`;
}

function storageOwnerSegment(ownerId: string): string {
  return ownerId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function storagePath(ownerId: string, generatedAt: Date, fileName: string) {
  const day = generatedAt.toISOString().slice(0, 10);
  return `scheduled/${storageOwnerSegment(ownerId)}/${day}/${fileName}`;
}

async function selectUser(ownerId: string) {
  const [row] = await db
    .select({
      email: users.email,
      emailVerified: users.emailVerified,
      id: users.id,
      image: users.image,
      name: users.name,
    })
    .from(users)
    .where(eq(users.id, ownerId))
    .limit(1);

  return row ?? null;
}

async function collectBackupData(ownerId: string) {
  const [
    user,
    orgRows,
    personRows,
    labelRows,
    entityLabelRows,
    activityRows,
    noteRows,
    activityLogRows,
    pipelineRows,
    stageRows,
    dealRows,
    dealContactRows,
    dealStageEventRows,
    customFieldRows,
    savedViewRows,
    fileRows,
    mailboxRows,
    emailThreadRows,
    emailMessageRows,
    emailTemplateRows,
    emailEventRows,
    segmentRows,
    campaignRows,
    campaignRecipientRows,
    suppressionRows,
    sequenceRows,
    sequenceStepRows,
    enrollmentRows,
    automationRows,
    automationRunRows,
    formRows,
    formSubmissionRows,
    leadRows,
    aiRunRows,
    goalRows,
    documentRows,
    productRows,
    quoteRows,
    quoteItemRows,
    previousBackupRows,
  ] = await Promise.all([
    selectUser(ownerId),
    db
      .select()
      .from(organizations)
      .where(eq(organizations.ownerId, ownerId))
      .orderBy(asc(organizations.createdAt)),
    db
      .select()
      .from(persons)
      .where(eq(persons.ownerId, ownerId))
      .orderBy(asc(persons.createdAt)),
    db
      .select()
      .from(labels)
      .where(eq(labels.ownerId, ownerId))
      .orderBy(asc(labels.createdAt)),
    db
      .select({ row: entityLabels })
      .from(entityLabels)
      .innerJoin(labels, eq(entityLabels.labelId, labels.id))
      .where(eq(labels.ownerId, ownerId))
      .orderBy(asc(entityLabels.createdAt)),
    db
      .select()
      .from(activities)
      .where(eq(activities.ownerId, ownerId))
      .orderBy(asc(activities.createdAt)),
    db
      .select()
      .from(notes)
      .where(eq(notes.ownerId, ownerId))
      .orderBy(asc(notes.createdAt)),
    db
      .select()
      .from(activityLog)
      .where(eq(activityLog.actorId, ownerId))
      .orderBy(asc(activityLog.createdAt)),
    db
      .select()
      .from(pipelines)
      .where(eq(pipelines.ownerId, ownerId))
      .orderBy(asc(pipelines.position), asc(pipelines.createdAt)),
    db
      .select()
      .from(stages)
      .where(eq(stages.ownerId, ownerId))
      .orderBy(asc(stages.position), asc(stages.createdAt)),
    db
      .select()
      .from(deals)
      .where(eq(deals.ownerId, ownerId))
      .orderBy(asc(deals.createdAt)),
    db
      .select({ row: dealContacts })
      .from(dealContacts)
      .innerJoin(deals, eq(dealContacts.dealId, deals.id))
      .where(eq(deals.ownerId, ownerId))
      .orderBy(asc(dealContacts.createdAt)),
    db
      .select()
      .from(dealStageEvents)
      .where(eq(dealStageEvents.ownerId, ownerId))
      .orderBy(asc(dealStageEvents.at)),
    db
      .select()
      .from(customFieldDefs)
      .where(eq(customFieldDefs.ownerId, ownerId))
      .orderBy(asc(customFieldDefs.entityType), asc(customFieldDefs.position)),
    db
      .select()
      .from(savedViews)
      .where(eq(savedViews.ownerId, ownerId))
      .orderBy(asc(savedViews.entityType), asc(savedViews.position)),
    db
      .select()
      .from(files)
      .where(eq(files.ownerId, ownerId))
      .orderBy(asc(files.createdAt)),
    db
      .select()
      .from(mailboxes)
      .where(eq(mailboxes.ownerId, ownerId))
      .orderBy(asc(mailboxes.createdAt)),
    db
      .select()
      .from(emailThreads)
      .where(eq(emailThreads.ownerId, ownerId))
      .orderBy(asc(emailThreads.createdAt)),
    db
      .select()
      .from(emailMessages)
      .where(eq(emailMessages.ownerId, ownerId))
      .orderBy(asc(emailMessages.createdAt)),
    db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.ownerId, ownerId))
      .orderBy(asc(emailTemplates.createdAt)),
    db
      .select()
      .from(emailEvents)
      .where(eq(emailEvents.ownerId, ownerId))
      .orderBy(asc(emailEvents.createdAt)),
    db
      .select()
      .from(segments)
      .where(eq(segments.ownerId, ownerId))
      .orderBy(asc(segments.createdAt)),
    db
      .select()
      .from(campaigns)
      .where(eq(campaigns.ownerId, ownerId))
      .orderBy(asc(campaigns.createdAt)),
    db
      .select()
      .from(campaignRecipients)
      .where(eq(campaignRecipients.ownerId, ownerId))
      .orderBy(asc(campaignRecipients.createdAt)),
    db
      .select()
      .from(suppressions)
      .where(eq(suppressions.ownerId, ownerId))
      .orderBy(asc(suppressions.createdAt)),
    db
      .select()
      .from(sequences)
      .where(eq(sequences.ownerId, ownerId))
      .orderBy(asc(sequences.createdAt)),
    db
      .select()
      .from(sequenceSteps)
      .where(eq(sequenceSteps.ownerId, ownerId))
      .orderBy(asc(sequenceSteps.sequenceId), asc(sequenceSteps.position)),
    db
      .select()
      .from(enrollments)
      .where(eq(enrollments.ownerId, ownerId))
      .orderBy(asc(enrollments.enrolledAt)),
    db
      .select()
      .from(automations)
      .where(eq(automations.ownerId, ownerId))
      .orderBy(asc(automations.createdAt)),
    db
      .select()
      .from(automationRuns)
      .where(eq(automationRuns.ownerId, ownerId))
      .orderBy(asc(automationRuns.startedAt)),
    db
      .select()
      .from(forms)
      .where(eq(forms.ownerId, ownerId))
      .orderBy(asc(forms.createdAt)),
    db
      .select()
      .from(formSubmissions)
      .where(eq(formSubmissions.ownerId, ownerId))
      .orderBy(asc(formSubmissions.createdAt)),
    db
      .select()
      .from(leads)
      .where(eq(leads.ownerId, ownerId))
      .orderBy(asc(leads.createdAt)),
    db
      .select()
      .from(aiRuns)
      .where(eq(aiRuns.ownerId, ownerId))
      .orderBy(asc(aiRuns.createdAt)),
    db
      .select()
      .from(goals)
      .where(eq(goals.ownerId, ownerId))
      .orderBy(asc(goals.createdAt)),
    db
      .select()
      .from(documents)
      .where(eq(documents.ownerId, ownerId))
      .orderBy(asc(documents.createdAt)),
    db
      .select()
      .from(products)
      .where(eq(products.ownerId, ownerId))
      .orderBy(asc(products.createdAt)),
    db
      .select()
      .from(quotes)
      .where(eq(quotes.ownerId, ownerId))
      .orderBy(asc(quotes.createdAt)),
    db
      .select({ row: quoteItems })
      .from(quoteItems)
      .innerJoin(quotes, eq(quoteItems.quoteId, quotes.id))
      .where(eq(quotes.ownerId, ownerId))
      .orderBy(asc(quoteItems.quoteId), asc(quoteItems.position)),
    db
      .select()
      .from(backupExports)
      .where(eq(backupExports.ownerId, ownerId))
      .orderBy(asc(backupExports.createdAt)),
  ]);

  return {
    activities: activityRows,
    activity_log: activityLogRows,
    ai_runs: aiRunRows,
    automation_runs: automationRunRows,
    automations: automationRows,
    backup_exports: previousBackupRows,
    campaign_recipients: campaignRecipientRows,
    campaigns: campaignRows,
    custom_field_defs: customFieldRows,
    deal_contacts: dealContactRows.map(({ row }) => row),
    deal_stage_events: dealStageEventRows,
    deals: dealRows,
    documents: documentRows,
    email_events: emailEventRows,
    email_messages: emailMessageRows,
    email_templates: emailTemplateRows,
    email_threads: emailThreadRows,
    enrollments: enrollmentRows,
    entity_labels: entityLabelRows.map(({ row }) => row),
    files: fileRows,
    form_submissions: formSubmissionRows,
    forms: formRows,
    goals: goalRows,
    labels: labelRows,
    leads: leadRows,
    mailboxes: mailboxRows,
    notes: noteRows,
    organizations: orgRows,
    persons: personRows,
    pipelines: pipelineRows,
    products: productRows,
    quote_items: quoteItemRows.map(({ row }) => row),
    quotes: quoteRows,
    saved_views: savedViewRows,
    segments: segmentRows,
    sequence_steps: sequenceStepRows,
    sequences: sequenceRows,
    stages: stageRows,
    suppressions: suppressionRows,
    user,
  };
}

type BackupData = Awaited<ReturnType<typeof collectBackupData>>;

export type BackupPayload = {
  schemaVersion: number;
  generatedAt: string;
  ownerId: string;
  app: "nexo-crm";
  format: "full-json";
  excludedTables: string[];
  data: BackupData;
};

export type PreparedBackup = {
  payload: BackupPayload;
  json: string;
  bytes: number;
  checksumSha256: string;
  fileName: string;
  tableCounts: Record<string, number>;
};

function countRows(data: BackupData): Record<string, number> {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.length : value ? 1 : 0,
    ]),
  );
}

export async function prepareOwnerBackup(ownerId: string): Promise<PreparedBackup> {
  const generatedAt = new Date();
  const data = await collectBackupData(ownerId);
  const payload: BackupPayload = {
    app: "nexo-crm",
    data,
    excludedTables: ["account", "session", "verificationToken", "authenticator"],
    format: "full-json",
    generatedAt: generatedAt.toISOString(),
    ownerId,
    schemaVersion: BACKUP_SCHEMA_VERSION,
  };
  const json = `${JSON.stringify(payload, null, 2)}\n`;
  const bytes = Buffer.byteLength(json, "utf8");
  const checksumSha256 = createHash("sha256").update(json).digest("hex");

  return {
    bytes,
    checksumSha256,
    fileName: backupFileName(generatedAt),
    json,
    payload,
    tableCounts: countRows(data),
  };
}

export async function createManualBackupExport(
  ownerId: string,
): Promise<PreparedBackup> {
  const prepared = await prepareOwnerBackup(ownerId);

  await db.insert(backupExports).values({
    bytes: prepared.bytes,
    checksumSha256: prepared.checksumSha256,
    completedAt: new Date(),
    fileName: prepared.fileName,
    kind: "manual",
    ownerId,
    status: "completed",
    tableCounts: prepared.tableCounts,
  });

  return prepared;
}

export type ScheduledBackupResult =
  | {
      ok: true;
      bytes: number;
      checksumSha256: string;
      fileName: string;
      storageBucket: string;
      storagePath: string;
      tableCounts: Record<string, number>;
    }
  | {
      ok: false;
      error: string;
    };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Error desconocido";
}

export async function createScheduledBackupExport(
  ownerId: string,
): Promise<ScheduledBackupResult> {
  try {
    if (!isStorageConfigured()) {
      throw new Error(
        "Supabase Storage no esta configurado: define SUPABASE_SERVICE_ROLE_KEY y crea el bucket privado de backups.",
      );
    }

    const prepared = await prepareOwnerBackup(ownerId);
    const generatedAt = new Date(prepared.payload.generatedAt);
    const path = storagePath(ownerId, generatedAt, prepared.fileName);
    const body = new TextEncoder().encode(prepared.json);

    await uploadBackupObject(path, body);
    await db.insert(backupExports).values({
      bytes: prepared.bytes,
      checksumSha256: prepared.checksumSha256,
      completedAt: new Date(),
      fileName: prepared.fileName,
      kind: "scheduled",
      ownerId,
      status: "completed",
      storageBucket: BACKUP_STORAGE_BUCKET,
      storagePath: path,
      tableCounts: prepared.tableCounts,
    });

    return {
      bytes: prepared.bytes,
      checksumSha256: prepared.checksumSha256,
      fileName: prepared.fileName,
      ok: true,
      storageBucket: BACKUP_STORAGE_BUCKET,
      storagePath: path,
      tableCounts: prepared.tableCounts,
    };
  } catch (error) {
    const message = errorMessage(error);
    await db.insert(backupExports).values({
      completedAt: new Date(),
      error: message,
      kind: "scheduled",
      ownerId,
      status: "failed",
    });

    return { error: message, ok: false };
  }
}

export async function resolveScheduledBackupOwner() {
  const email = configuredOwnerEmail();

  if (email) {
    const [row] = await db
      .select({
        email: users.email,
        id: users.id,
        name: users.name,
      })
      .from(users)
      .where(eq(sql<string>`lower(${users.email})`, email))
      .limit(1);

    return row ?? null;
  }

  const [row] = await db
    .select({
      email: users.email,
      id: users.id,
      name: users.name,
    })
    .from(users)
    .limit(1);

  return row ?? null;
}

export function isValidBackupCronRequest(request: Request): boolean {
  const expected =
    process.env.CRON_SECRET?.trim() ?? process.env.BACKUP_CRON_SECRET?.trim();
  if (!expected) return false;

  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}

export async function listRecentBackupExports(
  ownerId: string,
  limit = 8,
): Promise<BackupExportListItem[]> {
  const rows = await db
    .select({
      bytes: backupExports.bytes,
      checksumSha256: backupExports.checksumSha256,
      completedAt: backupExports.completedAt,
      createdAt: backupExports.createdAt,
      error: backupExports.error,
      fileName: backupExports.fileName,
      id: backupExports.id,
      kind: backupExports.kind,
      status: backupExports.status,
      storageBucket: backupExports.storageBucket,
      storagePath: backupExports.storagePath,
      tableCounts: backupExports.tableCounts,
    })
    .from(backupExports)
    .where(eq(backupExports.ownerId, ownerId))
    .orderBy(desc(backupExports.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    ...row,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}
