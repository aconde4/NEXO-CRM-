import "server-only";

import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { formatMoney, fullName } from "@/lib/format";
import {
  generatedHistorySummarySchema,
  type GenerateHistorySummaryValues,
  type GeneratedHistorySummaryValues,
} from "@/lib/validations/ai-history";
import { completeAI, type AIUsage } from "@/server/services/ai";
import { db } from "@/server/db";
import {
  activities,
  deals,
  emailMessages,
  emailThreads,
  formSubmissions,
  forms,
  leads,
  notes,
  persons,
} from "@/server/db/schema";

export type AIHistorySummary = GeneratedHistorySummaryValues & {
  contextStats: {
    activities: number;
    deals: number;
    emailMessages: number;
    emailThreads: number;
    leads: number;
    notes: number;
  };
  estimatedCostUsd: number;
  generatedAt: string;
  model: string;
  provider: string;
  runId: string;
  usage: AIUsage;
};

type TimelineEntry = {
  at: Date | null;
  kind: string;
  text: string;
};

const activityTypeLabels: Record<string, string> = {
  call: "llamada",
  deadline: "vencimiento",
  email: "email",
  lunch: "comida",
  meeting: "reunion",
  task: "tarea",
};

const dealStatusLabels: Record<string, string> = {
  lost: "perdido",
  open: "abierto",
  won: "ganado",
};

const leadStatusLabels: Record<string, string> = {
  converted: "convertido",
  junk: "basura",
  new: "nuevo",
  qualified: "calificado",
};

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function limitText(value: string | null | undefined, max = 600): string {
  const normalized = (value ?? "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).trimEnd()}...`;
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function compactBlock(title: string, lines: Array<string | null | undefined>) {
  const body = lines.filter(Boolean).join("\n");
  return body ? `## ${title}\n${body}` : "";
}

function timestamp(value: Date | string | null | undefined): string {
  if (!value) return "sin fecha";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "sin fecha";
  return date.toISOString().slice(0, 16).replace("T", " ");
}

function valueToText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return clean(value);
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const values = value.flatMap((item) => valueToText(item) ?? []);
    return values.length ? values.join(", ") : null;
  }
  if (typeof value === "object") {
    try {
      return limitText(JSON.stringify(value), 180);
    } catch {
      return null;
    }
  }
  return null;
}

function customFieldsLine(values: Record<string, unknown> | null | undefined) {
  const entries = Object.entries(values ?? {})
    .flatMap(([key, value]) => {
      const text = valueToText(value);
      return text ? [`${key}: ${text}`] : [];
    })
    .slice(0, 8);
  return entries.length ? `Campos personalizados: ${entries.join(" | ")}` : null;
}

function organizationBlock(
  organization:
    | {
        customFields?: Record<string, unknown>;
        industry?: string | null;
        name: string;
        size?: string | null;
        tradeName?: string | null;
        website?: string | null;
      }
    | null
    | undefined,
) {
  if (!organization) return "";
  return compactBlock("Empresa", [
    `Nombre: ${organization.name}`,
    clean(organization.tradeName)
      ? `Nombre comercial: ${organization.tradeName}`
      : null,
    clean(organization.industry) ? `Sector: ${organization.industry}` : null,
    clean(organization.website) ? `Web: ${organization.website}` : null,
    clean(organization.size) ? `Tamano: ${organization.size}` : null,
    customFieldsLine(organization.customFields),
  ]);
}

function personBlock(
  person:
    | {
        campaign?: string | null;
        customFields?: Record<string, unknown>;
        email?: string | null;
        firstName: string;
        lastName: string | null;
        marketingStatus?: string;
        phone?: string | null;
        source?: string | null;
        title?: string | null;
      }
    | null
    | undefined,
) {
  if (!person) return "";
  return compactBlock("Contacto", [
    `Nombre: ${fullName(person.firstName, person.lastName) || "Sin nombre"}`,
    clean(person.email) ? `Email: ${person.email}` : null,
    clean(person.title) ? `Cargo: ${person.title}` : null,
    clean(person.phone) ? `Telefono: ${person.phone}` : null,
    clean(person.source) ? `Origen: ${person.source}` : null,
    clean(person.campaign) ? `Campana: ${person.campaign}` : null,
    person.marketingStatus ? `Marketing: ${person.marketingStatus}` : null,
    customFieldsLine(person.customFields),
  ]);
}

function dealLine(
  deal: {
    currency: string;
    expectedCloseDate: Date | null;
    lostReason?: string | null;
    pipeline?: { name: string | null } | null;
    stage?: { name: string | null; probability?: number | null } | null;
    status: string;
    title: string;
    value: number;
  },
) {
  const parts = [
    deal.title,
    dealStatusLabels[deal.status] ?? deal.status,
    formatMoney(deal.value, deal.currency),
    deal.stage?.name ? `etapa ${deal.stage.name}` : null,
    deal.pipeline?.name ? `embudo ${deal.pipeline.name}` : null,
    deal.expectedCloseDate
      ? `cierre previsto ${deal.expectedCloseDate.toISOString().slice(0, 10)}`
      : null,
    clean(deal.lostReason) ? `motivo perdida: ${deal.lostReason}` : null,
  ].filter(Boolean);
  return `- ${parts.join(" | ")}`;
}

function dealsBlock(
  dealRows: Array<{
    currency: string;
    expectedCloseDate: Date | null;
    lostReason?: string | null;
    pipeline?: { name: string | null } | null;
    stage?: { name: string | null; probability?: number | null } | null;
    status: string;
    title: string;
    value: number;
  }>,
) {
  if (dealRows.length === 0) return "";
  return compactBlock("Negocios relacionados", dealRows.map(dealLine));
}

function leadLine(row: {
  convertedDealId: string | null;
  createdAt: Date;
  formName: string | null;
  score: number;
  source: string | null;
  status: string;
  submissionData: Record<string, unknown> | null;
}) {
  const submission = customFieldsLine(row.submissionData);
  return [
    `${timestamp(row.createdAt)} - lead ${leadStatusLabels[row.status] ?? row.status}`,
    clean(row.source) ? `origen: ${row.source}` : null,
    clean(row.formName) ? `formulario: ${row.formName}` : null,
    `score: ${row.score}`,
    row.convertedDealId ? "convertido a negocio" : null,
    submission ? submission.replace("Campos personalizados: ", "envio: ") : null,
  ]
    .filter(Boolean)
    .join(" | ");
}

function leadsBlock(
  leadRows: Array<{
    convertedDealId: string | null;
    createdAt: Date;
    formName: string | null;
    score: number;
    source: string | null;
    status: string;
    submissionData: Record<string, unknown> | null;
  }>,
) {
  if (leadRows.length === 0) return "";
  return compactBlock("Leads y formularios", leadRows.map((row) => `- ${leadLine(row)}`));
}

function activityEntry(activity: {
  createdAt: Date;
  done: boolean;
  doneAt: Date | null;
  dueAt: Date | null;
  notes: string | null;
  subject: string;
  type: string;
}) {
  const kind = activityTypeLabels[activity.type] ?? activity.type;
  const status = activity.done ? "hecha" : "pendiente";
  const due = activity.dueAt ? `vence ${timestamp(activity.dueAt)}` : null;
  const doneAt = activity.doneAt ? `hecha ${timestamp(activity.doneAt)}` : null;
  return [
    `${kind} ${status}: ${activity.subject}`,
    due,
    doneAt,
    clean(activity.notes) ? `notas: ${limitText(activity.notes, 260)}` : null,
  ]
    .filter(Boolean)
    .join(" | ");
}

function messageEntry(message: {
  bodyHtml: string | null;
  bodyText: string | null;
  createdAt: Date;
  direction: string;
  fromEmail: string;
  fromName: string | null;
  receivedAt: Date | null;
  sentAt: Date | null;
  snippet: string | null;
  subject: string | null;
}) {
  const body =
    limitText(message.bodyText, 360) ||
    (message.bodyHtml ? limitText(htmlToText(message.bodyHtml), 360) : "") ||
    limitText(message.snippet, 260) ||
    "(sin contenido)";
  const speaker =
    message.direction === "outbound"
      ? "Nosotros"
      : message.fromName || message.fromEmail;
  const subject = clean(message.subject) ? `asunto: ${message.subject} | ` : "";
  return `${message.direction === "outbound" ? "email enviado" : "email recibido"} | ${subject}${speaker}: ${body}`;
}

function threadSummaryLine(thread: {
  lastInboundAt: Date | null;
  lastMessageAt: Date | null;
  lastOutboundAt: Date | null;
  messageCount: number;
  subject: string | null;
  unread: boolean;
}) {
  return [
    `- ${clean(thread.subject) ?? "(sin asunto)"}`,
    `${thread.messageCount} mensajes`,
    thread.unread ? "no leido" : null,
    thread.lastMessageAt ? `ultimo ${timestamp(thread.lastMessageAt)}` : null,
    thread.lastInboundAt ? `ultimo recibido ${timestamp(thread.lastInboundAt)}` : null,
    thread.lastOutboundAt ? `ultimo enviado ${timestamp(thread.lastOutboundAt)}` : null,
  ]
    .filter(Boolean)
    .join(" | ");
}

function timelineBlock(entries: TimelineEntry[]) {
  const lines = [...entries]
    .sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0))
    .slice(0, 45)
    .map((entry) => `- ${timestamp(entry.at)} | ${entry.kind}: ${entry.text}`);

  return compactBlock("Historial reciente", lines);
}

async function loadLeadsForPerson(ownerId: string, personId: string) {
  return db
    .select({
      convertedDealId: leads.convertedDealId,
      createdAt: leads.createdAt,
      formName: forms.name,
      score: leads.score,
      source: leads.source,
      status: leads.status,
      submissionData: formSubmissions.data,
    })
    .from(leads)
    .leftJoin(formSubmissions, eq(formSubmissions.id, leads.submissionId))
    .leftJoin(forms, eq(forms.id, formSubmissions.formId))
    .where(and(eq(leads.ownerId, ownerId), eq(leads.personId, personId)))
    .orderBy(desc(leads.createdAt))
    .limit(12);
}

async function loadLeadsForDeal(
  ownerId: string,
  dealId: string,
  personId: string | null,
) {
  const linked = personId
    ? or(eq(leads.convertedDealId, dealId), eq(leads.personId, personId))
    : eq(leads.convertedDealId, dealId);
  return db
    .select({
      convertedDealId: leads.convertedDealId,
      createdAt: leads.createdAt,
      formName: forms.name,
      score: leads.score,
      source: leads.source,
      status: leads.status,
      submissionData: formSubmissions.data,
    })
    .from(leads)
    .leftJoin(formSubmissions, eq(formSubmissions.id, leads.submissionId))
    .leftJoin(forms, eq(forms.id, formSubmissions.formId))
    .where(and(eq(leads.ownerId, ownerId), linked))
    .orderBy(desc(leads.createdAt))
    .limit(12);
}

async function loadThreadsForPerson(
  ownerId: string,
  personId: string,
  dealIds: string[],
) {
  const linked = dealIds.length
    ? or(eq(emailThreads.personId, personId), inArray(emailThreads.dealId, dealIds))
    : eq(emailThreads.personId, personId);
  return db.query.emailThreads.findMany({
    limit: 10,
    orderBy: [
      desc(
        sql`coalesce(${emailThreads.lastMessageAt}, ${emailThreads.updatedAt}, ${emailThreads.createdAt})`,
      ),
    ],
    where: and(
      eq(emailThreads.ownerId, ownerId),
      isNull(emailThreads.deletedAt),
      linked,
    ),
    with: {
      messages: {
        limit: 8,
        orderBy: [
          desc(
            sql`coalesce(${emailMessages.sentAt}, ${emailMessages.receivedAt}, ${emailMessages.createdAt})`,
          ),
        ],
      },
    },
  });
}

async function loadThreadsForDeal(ownerId: string, dealId: string) {
  return db.query.emailThreads.findMany({
    limit: 10,
    orderBy: [
      desc(
        sql`coalesce(${emailThreads.lastMessageAt}, ${emailThreads.updatedAt}, ${emailThreads.createdAt})`,
      ),
    ],
    where: and(
      eq(emailThreads.ownerId, ownerId),
      eq(emailThreads.dealId, dealId),
      isNull(emailThreads.deletedAt),
    ),
    with: {
      messages: {
        limit: 10,
        orderBy: [
          desc(
            sql`coalesce(${emailMessages.sentAt}, ${emailMessages.receivedAt}, ${emailMessages.createdAt})`,
          ),
        ],
      },
    },
  });
}

function threadsBlock(threads: Awaited<ReturnType<typeof loadThreadsForDeal>>) {
  if (threads.length === 0) return "";
  return compactBlock("Hilos de email", threads.map(threadSummaryLine));
}

function timelineFromThreads(
  threads: Awaited<ReturnType<typeof loadThreadsForDeal>>,
): TimelineEntry[] {
  return threads.flatMap((thread) =>
    thread.messages.map((message) => ({
      at: message.sentAt ?? message.receivedAt ?? message.createdAt,
      kind: "email",
      text: messageEntry({
        bodyHtml: message.bodyHtml,
        bodyText: message.bodyText,
        createdAt: message.createdAt,
        direction: message.direction,
        fromEmail: message.fromEmail,
        fromName: message.fromName,
        receivedAt: message.receivedAt,
        sentAt: message.sentAt,
        snippet: message.snippet,
        subject: message.subject ?? thread.subject,
      }),
    })),
  );
}

async function buildPersonContext(ownerId: string, personId: string) {
  const person = await db.query.persons.findFirst({
    where: and(
      eq(persons.id, personId),
      eq(persons.ownerId, ownerId),
      isNull(persons.deletedAt),
    ),
    with: {
      activities: { limit: 35, orderBy: [desc(activities.createdAt)] },
      notes: { limit: 35, orderBy: [desc(notes.createdAt)] },
      organization: true,
    },
  });

  if (!person) throw new Error("Contacto no encontrado o sin permisos.");

  const relatedDeals = await db.query.deals.findMany({
    limit: 12,
    orderBy: [desc(deals.updatedAt)],
    where: and(
      eq(deals.ownerId, ownerId),
      eq(deals.personId, person.id),
      isNull(deals.deletedAt),
    ),
    with: {
      pipeline: { columns: { name: true } },
      stage: { columns: { name: true, probability: true } },
    },
  });
  const [leadRows, threads] = await Promise.all([
    loadLeadsForPerson(ownerId, person.id),
    loadThreadsForPerson(
      ownerId,
      person.id,
      relatedDeals.map((deal) => deal.id),
    ),
  ]);

  const timeline: TimelineEntry[] = [
    ...person.notes.map((note) => ({
      at: note.createdAt,
      kind: "nota",
      text: limitText(note.body, 360),
    })),
    ...person.activities.map((activity) => ({
      at: activity.doneAt ?? activity.dueAt ?? activity.createdAt,
      kind: "actividad",
      text: activityEntry(activity),
    })),
    ...leadRows.map((lead) => ({
      at: lead.createdAt,
      kind: "lead/formulario",
      text: leadLine(lead),
    })),
    ...relatedDeals.map((deal) => ({
      at: deal.updatedAt,
      kind: "negocio",
      text: dealLine(deal).replace(/^- /, ""),
    })),
    ...timelineFromThreads(threads),
  ];

  const prompt = [
    `Fecha actual: ${new Date().toISOString().slice(0, 10)}`,
    "Entidad resumida: contacto",
    personBlock(person),
    organizationBlock(person.organization),
    dealsBlock(relatedDeals),
    leadsBlock(leadRows),
    threadsBlock(threads),
    timelineBlock(timeline),
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    contextStats: {
      activities: person.activities.length,
      deals: relatedDeals.length,
      emailMessages: threads.reduce((sum, thread) => sum + thread.messages.length, 0),
      emailThreads: threads.length,
      leads: leadRows.length,
      notes: person.notes.length,
    },
    prompt,
  };
}

async function buildDealContext(ownerId: string, dealId: string) {
  const deal = await db.query.deals.findFirst({
    where: and(
      eq(deals.id, dealId),
      eq(deals.ownerId, ownerId),
      isNull(deals.deletedAt),
    ),
    with: {
      activities: { limit: 40, orderBy: [desc(activities.createdAt)] },
      contacts: {
        with: {
          person: {
            columns: {
              email: true,
              firstName: true,
              id: true,
              lastName: true,
              title: true,
            },
          },
        },
      },
      notes: { limit: 40, orderBy: [desc(notes.createdAt)] },
      organization: true,
      person: true,
      pipeline: { columns: { name: true } },
      stage: { columns: { name: true, probability: true } },
    },
  });

  if (!deal) throw new Error("Negocio no encontrado o sin permisos.");

  const [leadRows, threads] = await Promise.all([
    loadLeadsForDeal(ownerId, deal.id, deal.personId),
    loadThreadsForDeal(ownerId, deal.id),
  ]);

  const participantLines = deal.contacts.map((contact) => {
    const person = contact.person;
    if (!person) return null;
    return [
      fullName(person.firstName, person.lastName),
      clean(person.title),
      clean(person.email),
    ]
      .filter(Boolean)
      .join(" | ");
  });

  const timeline: TimelineEntry[] = [
    {
      at: deal.stageChangedAt,
      kind: "negocio",
      text: `etapa actual ${deal.stage?.name ?? "sin etapa"} | estado ${
        dealStatusLabels[deal.status] ?? deal.status
      }`,
    },
    ...deal.notes.map((note) => ({
      at: note.createdAt,
      kind: "nota",
      text: limitText(note.body, 360),
    })),
    ...deal.activities.map((activity) => ({
      at: activity.doneAt ?? activity.dueAt ?? activity.createdAt,
      kind: "actividad",
      text: activityEntry(activity),
    })),
    ...leadRows.map((lead) => ({
      at: lead.createdAt,
      kind: "lead/formulario",
      text: leadLine(lead),
    })),
    ...timelineFromThreads(threads),
  ];

  const prompt = [
    `Fecha actual: ${new Date().toISOString().slice(0, 10)}`,
    "Entidad resumida: negocio",
    compactBlock("Negocio", [
      dealLine(deal).replace(/^- /, ""),
      deal.stageChangedAt
        ? `Ultimo cambio de etapa: ${timestamp(deal.stageChangedAt)}`
        : null,
      deal.wonAt ? `Ganado: ${timestamp(deal.wonAt)}` : null,
      deal.lostAt ? `Perdido: ${timestamp(deal.lostAt)}` : null,
      customFieldsLine(deal.customFields),
    ]),
    personBlock(deal.person),
    organizationBlock(deal.organization),
    participantLines.length
      ? compactBlock(
          "Participantes",
          participantLines.map((line) => (line ? `- ${line}` : null)),
        )
      : "",
    leadsBlock(leadRows),
    threadsBlock(threads),
    timelineBlock(timeline),
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    contextStats: {
      activities: deal.activities.length,
      deals: 1,
      emailMessages: threads.reduce((sum, thread) => sum + thread.messages.length, 0),
      emailThreads: threads.length,
      leads: leadRows.length,
      notes: deal.notes.length,
    },
    prompt,
  };
}

function systemPrompt(entityType: GenerateHistorySummaryValues["entityType"]) {
  const entityLabel = entityType === "person" ? "contacto" : "negocio";
  return [
    "Eres un analista senior de ventas B2B dentro de Nexo CRM.",
    `Resumen solicitado para una ficha de ${entityLabel}.`,
    "Usa solo hechos presentes en el contexto. No inventes reuniones, importes, respuestas, fechas ni intenciones.",
    "Si hay poca informacion, dilo con precision y formula preguntas abiertas utiles.",
    "Prioriza senales comerciales, cambios recientes, objeciones, riesgos y siguientes pasos.",
    "Escribe en espanol profesional, claro y accionable.",
    "Devuelve exclusivamente JSON valido que cumpla el esquema indicado.",
  ].join("\n");
}

function promptWithFocus(prompt: string, focus: string | undefined) {
  const cleanFocus = clean(focus);
  if (!cleanFocus) return prompt;
  return `${prompt}\n\n## Enfoque pedido por el usuario\n${limitText(cleanFocus, 1_000)}`;
}

function normalizeSummaryDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

export async function generateAIHistorySummary(
  ownerId: string,
  raw: GenerateHistorySummaryValues,
): Promise<AIHistorySummary> {
  const context =
    raw.entityType === "person"
      ? await buildPersonContext(ownerId, raw.entityId)
      : await buildDealContext(ownerId, raw.entityId);

  const result = await completeAI<GeneratedHistorySummaryValues>({
    feature:
      raw.entityType === "person"
        ? "history.person_summary"
        : "history.deal_summary",
    maxTokens: 1_500,
    messages: [
      {
        content: promptWithFocus(context.prompt, raw.focus),
        role: "user",
      },
    ],
    modelPreference: "fast",
    ownerId,
    requestSummary: {
      ...context.contextStats,
      entityType: raw.entityType,
      focusChars: raw.focus?.length ?? 0,
    },
    schema: generatedHistorySummarySchema,
    schemaName: "history_summary",
    system: systemPrompt(raw.entityType),
    temperature: 0.25,
  });

  if (!result.data) {
    throw new Error("La IA no devolvio un resumen valido.");
  }

  return {
    ...result.data,
    contextStats: context.contextStats,
    estimatedCostUsd: result.estimatedCostUsd,
    generatedAt: new Date().toISOString(),
    lastInteractionAt: normalizeSummaryDate(result.data.lastInteractionAt),
    model: result.model,
    provider: result.provider,
    runId: result.runId,
    usage: result.usage,
  };
}
