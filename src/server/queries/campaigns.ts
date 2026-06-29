import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import type { CampaignEmailBlock } from "@/lib/campaign-blocks";
import {
  type CampaignComplianceValues,
  campaignComplianceErrorMessage,
  campaignEmailBlocksSchema,
  normalizeCampaignCompliance,
} from "@/lib/validations/campaign";
import { requireUser } from "@/lib/session";
import { db } from "@/server/db";
import {
  type CampaignRecipientStatus,
  type CampaignStats,
  type CampaignStatus,
  type EmailEventType,
  accounts,
  campaignRecipients,
  campaigns,
  emailEvents,
  mailboxes,
  segments,
  suppressions,
} from "@/server/db/schema";
import { GMAIL_OAUTH_SCOPES, missingGmailScopes } from "@/lib/google-oauth";
import { getCampaignDeliveryConfig } from "@/server/services/campaign-dispatch";
import {
  getDefaultCampaignFrom,
  isResendConfigured,
} from "@/server/services/resend";

const CAMPAIGN_RESULTS_RECIPIENT_LIMIT = 250;
const CAMPAIGN_RESULTS_EVENT_LIMIT = 100;

function cleanEnv(value: string | undefined): string {
  return value?.trim() ?? "";
}

function blocksFromSettings(
  settings: Record<string, unknown>,
): CampaignEmailBlock[] {
  const parsed = campaignEmailBlocksSchema.safeParse(settings.blocks);
  return parsed.success ? parsed.data : [];
}

function complianceDefaults(): CampaignComplianceValues {
  const basis = cleanEnv(process.env.CAMPAIGN_CONSENT_BASIS);
  return normalizeCampaignCompliance({
    consentBasis:
      basis === "legitimate_interest" ? "legitimate_interest" : "consent",
    consentNotice: cleanEnv(process.env.CAMPAIGN_CONSENT_NOTICE),
    contactEmail:
      cleanEnv(process.env.CAMPAIGN_CONTACT_EMAIL) ||
      cleanEnv(process.env.CAMPAIGN_FROM_EMAIL),
    legalAddress: cleanEnv(process.env.CAMPAIGN_LEGAL_ADDRESS),
    legalName:
      cleanEnv(process.env.CAMPAIGN_LEGAL_NAME) ||
      cleanEnv(process.env.CAMPAIGN_FROM_NAME),
    privacyUrl: cleanEnv(process.env.CAMPAIGN_PRIVACY_URL),
  });
}

function pickComplianceValue(value: string, fallback: string): string {
  return value.trim() ? value : fallback;
}

function mergeComplianceDefaults(
  compliance: CampaignComplianceValues,
): CampaignComplianceValues {
  const defaults = complianceDefaults();
  return {
    consentBasis: compliance.consentBasis ?? defaults.consentBasis,
    consentNotice: pickComplianceValue(
      compliance.consentNotice,
      defaults.consentNotice,
    ),
    contactEmail: pickComplianceValue(
      compliance.contactEmail,
      defaults.contactEmail,
    ),
    legalAddress: pickComplianceValue(
      compliance.legalAddress,
      defaults.legalAddress,
    ),
    legalName: pickComplianceValue(compliance.legalName, defaults.legalName),
    privacyUrl: pickComplianceValue(compliance.privacyUrl, defaults.privacyUrl),
  };
}

function complianceFromSettings(
  settings: Record<string, unknown>,
): CampaignComplianceValues {
  return mergeComplianceDefaults(
    normalizeCampaignCompliance(settings.compliance),
  );
}

export type CampaignListItem = {
  id: string;
  name: string;
  subject: string;
  preheader: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  status: "draft" | "scheduled" | "sending" | "sent" | "paused" | "failed";
  segmentId: string | null;
  segmentName: string | null;
  bodyHtml: string;
  bodyText: string;
  blocks: CampaignEmailBlock[];
  compliance: CampaignComplianceValues;
  scheduledAt: string | null;
  sentAt: string | null;
  stats: CampaignStats;
  updatedAt: string;
  createdAt: string;
};

export type CampaignComposerDefaults = {
  compliance: CampaignComplianceValues;
  fromName: string;
  fromEmail: string;
  resendConfigured: boolean;
};

export type CampaignResultsRecipient = {
  id: string;
  email: string;
  name: string | null;
  status: CampaignRecipientStatus;
  providerMessageId: string | null;
  error: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  bouncedAt: string | null;
  unsubscribedAt: string | null;
  updatedAt: string;
};

export type CampaignResultsEvent = {
  id: string;
  type: EmailEventType;
  recipientEmail: string | null;
  url: string | null;
  providerEventId: string | null;
  meta: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
};

export type CampaignResults = {
  campaign: {
    id: string;
    name: string;
    subject: string;
    preheader: string;
    fromName: string;
    fromEmail: string;
    replyTo: string;
    provider: "resend";
    status: CampaignStatus;
    segmentName: string | null;
    scheduledAt: string | null;
    sentAt: string | null;
    stats: CampaignStats;
    updatedAt: string;
    createdAt: string;
    compliance: CampaignComplianceValues;
  };
  recipients: CampaignResultsRecipient[];
  recipientCount: number;
  recipientLimit: number;
  events: CampaignResultsEvent[];
  eventCount: number;
  eventLimit: number;
};

type CampaignResultsStats = Required<CampaignStats>;

export async function listCampaigns(): Promise<CampaignListItem[]> {
  const user = await requireUser();
  const rows = await db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      subject: campaigns.subject,
      preheader: campaigns.preheader,
      fromName: campaigns.fromName,
      fromEmail: campaigns.fromEmail,
      replyTo: campaigns.replyTo,
      status: campaigns.status,
      segmentId: campaigns.segmentId,
      segmentName: segments.name,
      bodyHtml: campaigns.bodyHtml,
      bodyText: campaigns.bodyText,
      scheduledAt: campaigns.scheduledAt,
      settings: campaigns.settings,
      sentAt: campaigns.sentAt,
      stats: campaigns.stats,
      updatedAt: campaigns.updatedAt,
      createdAt: campaigns.createdAt,
    })
    .from(campaigns)
    .leftJoin(
      segments,
      and(eq(campaigns.segmentId, segments.id), eq(segments.ownerId, user.id)),
    )
    .where(eq(campaigns.ownerId, user.id))
    .orderBy(desc(campaigns.updatedAt));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    subject: row.subject,
    preheader: row.preheader ?? "",
    fromName: row.fromName ?? "",
    fromEmail: row.fromEmail ?? "",
    replyTo: row.replyTo ?? "",
    status: row.status,
    segmentId: row.segmentId,
    segmentName: row.segmentName,
    bodyHtml: row.bodyHtml ?? "",
    bodyText: row.bodyText ?? "",
    blocks: blocksFromSettings(row.settings),
    compliance: complianceFromSettings(row.settings),
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    sentAt: row.sentAt?.toISOString() ?? null,
    stats: row.stats,
    updatedAt: row.updatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function getCampaignResults(
  campaignId: string,
): Promise<CampaignResults | null> {
  const user = await requireUser();
  const [row] = await db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      subject: campaigns.subject,
      preheader: campaigns.preheader,
      fromName: campaigns.fromName,
      fromEmail: campaigns.fromEmail,
      replyTo: campaigns.replyTo,
      provider: campaigns.provider,
      status: campaigns.status,
      segmentName: segments.name,
      scheduledAt: campaigns.scheduledAt,
      sentAt: campaigns.sentAt,
      stats: campaigns.stats,
      updatedAt: campaigns.updatedAt,
      createdAt: campaigns.createdAt,
      settings: campaigns.settings,
    })
    .from(campaigns)
    .leftJoin(
      segments,
      and(eq(campaigns.segmentId, segments.id), eq(segments.ownerId, user.id)),
    )
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.ownerId, user.id)))
    .limit(1);

  if (!row) return null;

  const campaignEventsFilter = and(
    eq(emailEvents.ownerId, user.id),
    eq(emailEvents.provider, "resend"),
    sql`${emailEvents.meta}->>'campaignId' = ${campaignId}`,
  );

  const [summary, recipients, events, recipientCount, eventCount] =
    await Promise.all([
      db
        .select({
          audience: sql<number>`count(*)::int`,
          sent: sql<number>`count(*) filter (where ${campaignRecipients.status} not in ('pending', 'suppressed', 'failed'))::int`,
          delivered: sql<number>`count(*) filter (where ${campaignRecipients.deliveredAt} is not null or ${campaignRecipients.status} in ('delivered', 'opened', 'clicked', 'complained', 'unsubscribed'))::int`,
          opened: sql<number>`count(*) filter (where ${campaignRecipients.openedAt} is not null or ${campaignRecipients.status} in ('opened', 'clicked'))::int`,
          clicked: sql<number>`count(*) filter (where ${campaignRecipients.clickedAt} is not null or ${campaignRecipients.status} = 'clicked')::int`,
          bounced: sql<number>`count(*) filter (where ${campaignRecipients.bouncedAt} is not null or ${campaignRecipients.status} = 'bounced')::int`,
          complained: sql<number>`count(*) filter (where ${campaignRecipients.status} = 'complained')::int`,
          unsubscribed: sql<number>`count(*) filter (where ${campaignRecipients.unsubscribedAt} is not null or ${campaignRecipients.status} = 'unsubscribed')::int`,
          suppressed: sql<number>`count(*) filter (where ${campaignRecipients.status} = 'suppressed')::int`,
          failed: sql<number>`count(*) filter (where ${campaignRecipients.status} = 'failed')::int`,
        })
        .from(campaignRecipients)
        .where(
          and(
            eq(campaignRecipients.campaignId, campaignId),
            eq(campaignRecipients.ownerId, user.id),
          ),
        ),
      db
        .select({
          id: campaignRecipients.id,
          email: campaignRecipients.email,
          name: campaignRecipients.name,
          status: campaignRecipients.status,
          providerMessageId: campaignRecipients.providerMessageId,
          error: campaignRecipients.error,
          sentAt: campaignRecipients.sentAt,
          deliveredAt: campaignRecipients.deliveredAt,
          openedAt: campaignRecipients.openedAt,
          clickedAt: campaignRecipients.clickedAt,
          bouncedAt: campaignRecipients.bouncedAt,
          unsubscribedAt: campaignRecipients.unsubscribedAt,
          updatedAt: campaignRecipients.updatedAt,
        })
        .from(campaignRecipients)
        .where(
          and(
            eq(campaignRecipients.campaignId, campaignId),
            eq(campaignRecipients.ownerId, user.id),
          ),
        )
        .orderBy(desc(campaignRecipients.updatedAt))
        .limit(CAMPAIGN_RESULTS_RECIPIENT_LIMIT),
      db
        .select({
          id: emailEvents.id,
          type: emailEvents.type,
          recipientEmail: emailEvents.recipientEmail,
          url: emailEvents.url,
          providerEventId: emailEvents.providerEventId,
          meta: emailEvents.meta,
          occurredAt: emailEvents.occurredAt,
          createdAt: emailEvents.createdAt,
        })
        .from(emailEvents)
        .where(campaignEventsFilter)
        .orderBy(desc(emailEvents.occurredAt))
        .limit(CAMPAIGN_RESULTS_EVENT_LIMIT),
      db.$count(
        campaignRecipients,
        and(
          eq(campaignRecipients.campaignId, campaignId),
          eq(campaignRecipients.ownerId, user.id),
        ),
      ),
      db.$count(emailEvents, campaignEventsFilter),
    ]);

  const computedStats: CampaignResultsStats = summary[0] ?? {
    audience: 0,
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    complained: 0,
    unsubscribed: 0,
    suppressed: 0,
    failed: 0,
  };

  return {
    campaign: {
      id: row.id,
      name: row.name,
      subject: row.subject,
      preheader: row.preheader ?? "",
      fromName: row.fromName ?? "",
      fromEmail: row.fromEmail ?? "",
      replyTo: row.replyTo ?? "",
      provider: row.provider,
      status: row.status,
      segmentName: row.segmentName,
      scheduledAt: row.scheduledAt?.toISOString() ?? null,
      sentAt: row.sentAt?.toISOString() ?? null,
      stats: { ...row.stats, ...computedStats },
      updatedAt: row.updatedAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      compliance: complianceFromSettings(row.settings),
    },
    recipients: recipients.map((recipient) => ({
      id: recipient.id,
      email: recipient.email,
      name: recipient.name,
      status: recipient.status,
      providerMessageId: recipient.providerMessageId,
      error: recipient.error,
      sentAt: recipient.sentAt?.toISOString() ?? null,
      deliveredAt: recipient.deliveredAt?.toISOString() ?? null,
      openedAt: recipient.openedAt?.toISOString() ?? null,
      clickedAt: recipient.clickedAt?.toISOString() ?? null,
      bouncedAt: recipient.bouncedAt?.toISOString() ?? null,
      unsubscribedAt: recipient.unsubscribedAt?.toISOString() ?? null,
      updatedAt: recipient.updatedAt.toISOString(),
    })),
    recipientCount,
    recipientLimit: CAMPAIGN_RESULTS_RECIPIENT_LIMIT,
    events: events.map((event) => ({
      id: event.id,
      type: event.type,
      recipientEmail: event.recipientEmail,
      url: event.url,
      providerEventId: event.providerEventId,
      meta: event.meta,
      occurredAt: event.occurredAt.toISOString(),
      createdAt: event.createdAt.toISOString(),
    })),
    eventCount,
    eventLimit: CAMPAIGN_RESULTS_EVENT_LIMIT,
  };
}

export async function getCampaignComposerDefaults(): Promise<CampaignComposerDefaults> {
  await requireUser();
  return {
    compliance: complianceDefaults(),
    fromName: cleanEnv(process.env.CAMPAIGN_FROM_NAME),
    fromEmail: cleanEnv(process.env.CAMPAIGN_FROM_EMAIL),
    resendConfigured: isResendConfigured(),
  };
}

// --- Preparación de contacto masivo (Fase T.4) ------------------------------
export type ResendCheckStatus = "ok" | "missing" | "manual";

export type ResendCheckItem = {
  key: string;
  label: string;
  status: ResendCheckStatus;
  detail: string;
  /** Requerido para enviar volumen real (vs. recomendado para producción). */
  required: boolean;
};

export type ResendReadiness = {
  /** No falta ningún requisito auto-comprobable (los "manual" no bloquean). */
  ready: boolean;
  items: ResendCheckItem[];
  suppressions: number;
  delivery: {
    batchSize: number;
    batchDelaySeconds: number;
    maxBatchesPerRun: number;
    windowStart: string;
    windowEnd: string;
    timeZone: string;
  };
};

export type DeliverabilityAuditStatus = "ok" | "warning" | "missing" | "manual";

export type DeliverabilityAuditItem = {
  key: string;
  label: string;
  detail: string;
  status: DeliverabilityAuditStatus;
  required: boolean;
};

export type DeliverabilityAuditSection = {
  key: string;
  title: string;
  description: string;
  items: DeliverabilityAuditItem[];
};

export type DeliverabilityAudit = {
  ready: boolean;
  resend: ResendReadiness;
  summary: Record<DeliverabilityAuditStatus, number>;
  sections: DeliverabilityAuditSection[];
};

/**
 * Checklist de preparación de Resend para contacto masivo (Fase T.4). Solo expone
 * estados (booleanos/valores no secretos), nunca la API key ni el webhook secret.
 */
export async function getResendReadiness(): Promise<ResendReadiness> {
  const user = await requireUser();

  const apiKeyOk = isResendConfigured();
  const from = getDefaultCampaignFrom();
  const complianceError = campaignComplianceErrorMessage(complianceDefaults());
  const webhookOk = cleanEnv(process.env.RESEND_WEBHOOK_SECRET) !== "";
  const appUrl = cleanEnv(process.env.NEXT_PUBLIC_APP_URL);

  const suppressionsCount = await db.$count(
    suppressions,
    eq(suppressions.ownerId, user.id),
  );

  const items: ResendCheckItem[] = [
    {
      detail: apiKeyOk
        ? "Conectada."
        : "Añade RESEND_API_KEY en .env.local (Resend → API Keys).",
      key: "apiKey",
      label: "API key de Resend",
      required: true,
      status: apiKeyOk ? "ok" : "missing",
    },
    {
      detail: from
        ? `Remitente: ${from}`
        : "Define CAMPAIGN_FROM_EMAIL (y CAMPAIGN_FROM_NAME) con un correo de tu dominio.",
      key: "fromEmail",
      label: "Remitente por defecto",
      required: true,
      status: from ? "ok" : "missing",
    },
    {
      detail:
        "Verifica el dominio de envío en Resend (SPF, DKIM, MX de rebotes y DMARC). No se puede comprobar desde aquí.",
      key: "domain",
      label: "Dominio verificado (SPF/DKIM/DMARC)",
      required: true,
      status: "manual",
    },
    {
      detail: complianceError
        ? `Faltan datos: ${complianceError}`
        : "Nombre legal, dirección, contacto, base legal y política de privacidad listos.",
      key: "compliance",
      label: "Datos RGPD del pie",
      required: true,
      status: complianceError ? "missing" : "ok",
    },
    {
      detail: webhookOk
        ? "Configurado."
        : "Añade RESEND_WEBHOOK_SECRET y apunta el webhook de Resend a /api/webhooks/resend (métricas, rebotes y bajas).",
      key: "webhook",
      label: "Webhook de eventos",
      required: false,
      status: webhookOk ? "ok" : "missing",
    },
    {
      detail: appUrl
        ? `Enlaces públicos desde ${appUrl}.`
        : "Define NEXT_PUBLIC_APP_URL en producción para tracking, bajas y enlaces públicos.",
      key: "appUrl",
      label: "URL pública de la app",
      required: false,
      status: appUrl ? "ok" : "missing",
    },
  ];

  const ready = !items.some(
    (item) => item.required && item.status === "missing",
  );

  const delivery = getCampaignDeliveryConfig();

  return {
    delivery: {
      batchDelaySeconds: delivery.batchDelaySeconds,
      batchSize: delivery.batchSize,
      maxBatchesPerRun: delivery.maxBatchesPerRun,
      timeZone: delivery.timeZone,
      windowEnd: delivery.windowEnd,
      windowStart: delivery.windowStart,
    },
    items,
    ready,
    suppressions: suppressionsCount,
  };
}

function auditStatusFromResend(
  status: ResendCheckStatus,
): DeliverabilityAuditStatus {
  return status === "ok" ? "ok" : status;
}

function deliveryLimitStatus(
  batchSize: number,
  batchDelaySeconds: number,
): DeliverabilityAuditStatus {
  if (batchSize > 50 || batchDelaySeconds < 60) return "warning";
  return "ok";
}

/**
 * Auditoría transversal de entregabilidad/cumplimiento (Fase T.6). Resume el estado
 * operativo de Gmail 1:1 y Resend masivo sin exponer secretos ni tokens.
 */
export async function getDeliverabilityAudit(): Promise<DeliverabilityAudit> {
  const user = await requireUser();
  const resend = await getResendReadiness();

  const [account] = await db
    .select({
      refreshToken: accounts.refresh_token,
      scope: accounts.scope,
    })
    .from(accounts)
    .where(and(eq(accounts.userId, user.id), eq(accounts.provider, "google")))
    .limit(1);

  const [mailbox] = await db
    .select({
      dailyLimit: mailboxes.dailyLimit,
      email: mailboxes.email,
      lastSyncError: mailboxes.lastSyncError,
      sentToday: mailboxes.sentToday,
      sentTodayResetAt: mailboxes.sentTodayResetAt,
      status: mailboxes.status,
    })
    .from(mailboxes)
    .where(and(eq(mailboxes.ownerId, user.id), eq(mailboxes.provider, "gmail")))
    .orderBy(desc(mailboxes.updatedAt))
    .limit(1);

  const missingScopes = missingGmailScopes(account?.scope);
  const resetValid =
    mailbox?.sentTodayResetAt != null && mailbox.sentTodayResetAt > new Date();
  const sentToday = resetValid ? mailbox.sentToday : 0;
  const gmailSendScope = GMAIL_OAUTH_SCOPES[0];
  const gmailReadScope = GMAIL_OAUTH_SCOPES[1];

  const sections: DeliverabilityAuditSection[] = [
    {
      description:
        "Canal personal para conversaciones reales, respuestas y secuencias de bajo volumen.",
      items: [
        {
          detail: account
            ? "Cuenta Google conectada en Auth.js."
            : "Conecta o reautoriza Google desde Bandeja para usar Gmail.",
          key: "gmail-account",
          label: "Cuenta Google conectada",
          required: true,
          status: account ? "ok" : "missing",
        },
        {
          detail: account?.refreshToken
            ? "Refresh token guardado para enviar y sincronizar sin pedir login cada vez."
            : "Reautoriza Gmail con acceso offline para guardar refresh token.",
          key: "gmail-refresh",
          label: "Acceso offline",
          required: true,
          status: account?.refreshToken ? "ok" : "missing",
        },
        {
          detail: missingScopes.includes(gmailSendScope)
            ? "Falta gmail.send; no se podrán enviar correos 1:1 desde el CRM."
            : "Permiso gmail.send concedido.",
          key: "gmail-send",
          label: "Permiso de envío 1:1",
          required: true,
          status: missingScopes.includes(gmailSendScope) ? "missing" : "ok",
        },
        {
          detail: missingScopes.includes(gmailReadScope)
            ? "Falta gmail.readonly; no se podrán sincronizar respuestas ni hilos."
            : "Permiso gmail.readonly concedido para leer hilos y detectar respuestas.",
          key: "gmail-read",
          label: "Permiso de lectura",
          required: true,
          status: missingScopes.includes(gmailReadScope) ? "missing" : "ok",
        },
        {
          detail: mailbox
            ? `${mailbox.email} · estado ${mailbox.status}${mailbox.lastSyncError ? ` · último error: ${mailbox.lastSyncError}` : ""}`
            : "El buzón se creará automáticamente al primer envío o sync después de autorizar.",
          key: "gmail-mailbox",
          label: "Buzón operativo",
          required: false,
          status:
            mailbox?.status === "active"
              ? "ok"
              : mailbox
                ? "warning"
                : "manual",
        },
        {
          detail: mailbox
            ? `${sentToday}/${mailbox.dailyLimit} enviados hoy. Mantener límites modestos protege el dominio.`
            : "Define el límite diario en Ajustes -> Correo cuando exista el buzón.",
          key: "gmail-warmup",
          label: "Límite diario Gmail",
          required: false,
          status:
            mailbox && mailbox.dailyLimit <= 75
              ? "ok"
              : mailbox
                ? "warning"
                : "manual",
        },
      ],
      key: "gmail",
      title: "Gmail 1:1",
    },
    {
      description:
        "Canal de volumen para campañas, newsletters y secuencias con bajas, rebotes y métricas.",
      items: resend.items.map((item) => ({
        detail: item.detail,
        key: `resend-${item.key}`,
        label: item.label,
        required: item.required,
        status: auditStatusFromResend(item.status),
      })),
      key: "resend",
      title: "Resend masivo",
    },
    {
      description:
        "Controles para no escribir a contactos sin base legal o que ya se han dado de baja.",
      items: [
        {
          detail:
            "El pie de campaña incluye remitente legal, dirección, contacto, política, base legal, origen y baja.",
          key: "compliance-footer",
          label: "Pie RGPD completo",
          required: true,
          status:
            resend.items.find((item) => item.key === "compliance")?.status ===
            "ok"
              ? "ok"
              : "missing",
        },
        {
          detail:
            "Las campañas añaden cabeceras List-Unsubscribe y enlace visible de baja por destinatario.",
          key: "unsubscribe-links",
          label: "Baja y one-click unsubscribe",
          required: true,
          status: "ok",
        },
        {
          detail: `${resend.suppressions} emails suprimidos por baja, rebote, queja o supresion externa. Se excluyen antes de enviar.`,
          key: "suppressions",
          label: "Lista de supresion activa",
          required: true,
          status: "ok",
        },
        {
          detail:
            "Los webhooks de Resend registran rebotes, quejas y supresiones para actualizar marketing_status.",
          key: "bounce-complaint-sync",
          label: "Rebotes y quejas sincronizados",
          required: false,
          status: cleanEnv(process.env.RESEND_WEBHOOK_SECRET)
            ? "ok"
            : "warning",
        },
      ],
      key: "compliance",
      title: "Consentimiento y bajas",
    },
    {
      description:
        "Ritmo de envio conservador para proteger dominio, reputacion y cuenta.",
      items: [
        {
          detail: `Lotes de ${resend.delivery.batchSize}, pausa de ${resend.delivery.batchDelaySeconds}s y máximo ${resend.delivery.maxBatchesPerRun} lotes por ejecución.`,
          key: "batch-limits",
          label: "Lotes y pausas",
          required: false,
          status: deliveryLimitStatus(
            resend.delivery.batchSize,
            resend.delivery.batchDelaySeconds,
          ),
        },
        {
          detail: `Ventana ${resend.delivery.windowStart}-${resend.delivery.windowEnd} (${resend.delivery.timeZone}). Evita enviar fuera de horario natural.`,
          key: "send-window",
          label: "Ventana horaria",
          required: false,
          status: "ok",
        },
        {
          detail:
            "Antes de volumen real, empieza con audiencias pequeñas y sube progresivamente solo si rebotes/quejas son bajos.",
          key: "warmup-plan",
          label: "Plan de calentamiento",
          required: false,
          status: "manual",
        },
      ],
      key: "warmup",
      title: "Calentamiento",
    },
  ];

  const allItems = sections.flatMap((section) => section.items);
  const summary: Record<DeliverabilityAuditStatus, number> = {
    manual: 0,
    missing: 0,
    ok: 0,
    warning: 0,
  };
  for (const item of allItems) {
    summary[item.status] += 1;
  }

  return {
    ready: !allItems.some((item) => item.required && item.status === "missing"),
    resend,
    sections,
    summary,
  };
}
