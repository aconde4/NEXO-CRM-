import "server-only";

import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";

import { textToHtml } from "@/lib/email/merge-tags";
import { formatMoney, fullName } from "@/lib/format";
import {
  generatedEmailDraftSchema,
  type EmailDraftTone,
  type GenerateEmailDraftValues,
  type GeneratedEmailDraftValues,
} from "@/lib/validations/email";
import { completeAI, type AIUsage } from "@/server/services/ai";
import { db } from "@/server/db";
import {
  deals,
  emailMessages,
  emailTemplates,
  emailThreads,
  organizations,
  persons,
} from "@/server/db/schema";

export type AssistedEmailDraft = GeneratedEmailDraftValues & {
  bodyHtml: string;
  estimatedCostUsd: number;
  model: string;
  provider: string;
  runId: string;
  usage: AIUsage;
};

type LoadedThread = NonNullable<Awaited<ReturnType<typeof loadThread>>>;
type PersonLike = {
  campaign?: string | null;
  email?: string | null;
  firstName: string;
  lastName: string | null;
  phone?: string | null;
  source?: string | null;
  title?: string | null;
};
type OrganizationLike = {
  industry?: string | null;
  name: string;
  size?: string | null;
  tradeName?: string | null;
  website?: string | null;
};
type DealLike = {
  currency?: string;
  expectedCloseDate?: Date | null;
  pipeline?: { name: string | null } | null;
  stage?: { name: string | null; probability?: number | null } | null;
  status?: string;
  title: string;
  value?: number;
};

const toneLabels: Record<EmailDraftTone, string> = {
  brief: "breve, directo y sin relleno",
  direct: "directo, claro y orientado a avanzar la conversación",
  professional: "profesional, natural y consultivo",
  warm: "cercano, humano y profesional",
};

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function limitText(value: string | null | undefined, max = 900): string {
  const normalized = (value ?? "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).trimEnd()}…`;
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

async function loadPerson(ownerId: string, personId: string | null) {
  if (!personId) return null;
  const person = await db.query.persons.findFirst({
    where: and(
      eq(persons.id, personId),
      eq(persons.ownerId, ownerId),
      isNull(persons.deletedAt),
    ),
    with: { organization: true },
  });
  if (!person) throw new Error("Contacto no encontrado o sin permisos.");
  return person;
}

async function loadOrganization(ownerId: string, orgId: string | null) {
  if (!orgId) return null;
  const organization = await db.query.organizations.findFirst({
    where: and(
      eq(organizations.id, orgId),
      eq(organizations.ownerId, ownerId),
      isNull(organizations.deletedAt),
    ),
  });
  if (!organization) throw new Error("Empresa no encontrada o sin permisos.");
  return organization;
}

async function loadDeal(ownerId: string, dealId: string | null) {
  if (!dealId) return null;
  const deal = await db.query.deals.findFirst({
    where: and(
      eq(deals.id, dealId),
      eq(deals.ownerId, ownerId),
      isNull(deals.deletedAt),
    ),
    with: {
      organization: true,
      person: true,
      pipeline: { columns: { name: true } },
      stage: { columns: { name: true, probability: true } },
    },
  });
  if (!deal) throw new Error("Negocio no encontrado o sin permisos.");
  return deal;
}

async function loadThread(ownerId: string, threadId: string | null) {
  if (!threadId) return null;
  const thread = await db.query.emailThreads.findFirst({
    where: and(
      eq(emailThreads.id, threadId),
      eq(emailThreads.ownerId, ownerId),
      isNull(emailThreads.deletedAt),
    ),
    with: {
      deal: true,
      mailbox: { columns: { email: true } },
      messages: {
        limit: 12,
        orderBy: [
          desc(
            sql`coalesce(${emailMessages.sentAt}, ${emailMessages.receivedAt}, ${emailMessages.createdAt})`,
          ),
        ],
      },
      organization: true,
      person: true,
    },
  });
  if (!thread) throw new Error("Hilo no encontrado o sin permisos.");
  return thread;
}

async function loadToneSamples(ownerId: string) {
  const [messages, templates] = await Promise.all([
    db
      .select({
        bodyText: emailMessages.bodyText,
        subject: emailMessages.subject,
      })
      .from(emailMessages)
      .where(
        and(
          eq(emailMessages.ownerId, ownerId),
          eq(emailMessages.direction, "outbound"),
          isNotNull(emailMessages.bodyText),
        ),
      )
      .orderBy(desc(emailMessages.sentAt), desc(emailMessages.createdAt))
      .limit(4),
    db
      .select({
        bodyText: emailTemplates.bodyText,
        name: emailTemplates.name,
        subject: emailTemplates.subject,
      })
      .from(emailTemplates)
      .where(
        and(
          eq(emailTemplates.ownerId, ownerId),
          isNull(emailTemplates.archivedAt),
        ),
      )
      .orderBy(desc(emailTemplates.updatedAt))
      .limit(3),
  ]);

  return [
    ...messages.flatMap((message) => {
      const body = limitText(message.bodyText, 650);
      if (!body) return [];
      return [`Asunto: ${message.subject ?? "(sin asunto)"}\n${body}`];
    }),
    ...templates.flatMap((template) => {
      const body = limitText(template.bodyText, 550);
      if (!body) return [];
      return [
        `Plantilla ${template.name}: ${template.subject ?? "(sin asunto)"}\n${body}`,
      ];
    }),
  ];
}

function personBlock(person: PersonLike | null) {
  if (!person) return "";
  return compactBlock("Contacto", [
    `Nombre: ${fullName(person.firstName, person.lastName) || "Sin nombre"}`,
    clean(person.email) ? `Email: ${person.email}` : null,
    clean(person.title) ? `Cargo: ${person.title}` : null,
    clean(person.phone) ? `Teléfono: ${person.phone}` : null,
    "campaign" in person && clean(person.campaign)
      ? `Campaña: ${person.campaign}`
      : null,
    "source" in person && clean(person.source) ? `Origen: ${person.source}` : null,
  ]);
}

function organizationBlock(organization: OrganizationLike | null) {
  if (!organization) return "";
  return compactBlock("Empresa", [
    `Nombre: ${organization.name}`,
    clean(organization.tradeName)
      ? `Nombre comercial: ${organization.tradeName}`
      : null,
    clean(organization.industry) ? `Sector: ${organization.industry}` : null,
    clean(organization.website) ? `Web: ${organization.website}` : null,
    clean(organization.size) ? `Tamaño: ${organization.size}` : null,
  ]);
}

function dealBlock(deal: DealLike | null) {
  if (!deal) return "";
  return compactBlock("Negocio", [
    `Título: ${deal.title}`,
    deal.status ? `Estado: ${deal.status}` : null,
    typeof deal.value === "number"
      ? `Valor: ${formatMoney(deal.value, deal.currency ?? "EUR")}`
      : null,
    deal.stage ? `Etapa: ${deal.stage.name}` : null,
    deal.pipeline ? `Embudo: ${deal.pipeline.name}` : null,
    deal.expectedCloseDate
      ? `Cierre previsto: ${deal.expectedCloseDate.toISOString().slice(0, 10)}`
      : null,
  ]);
}

function threadBlock(thread: LoadedThread | null) {
  if (!thread) return "";
  const messages = [...thread.messages].reverse().map((message) => {
    const date =
      message.sentAt ?? message.receivedAt ?? message.createdAt ?? null;
    const body =
      limitText(message.bodyText, 700) ||
      (message.bodyHtml ? limitText(htmlToText(message.bodyHtml), 700) : "") ||
      limitText(message.snippet, 400) ||
      "(sin contenido)";
    const speaker =
      message.direction === "outbound"
        ? "Nosotros"
        : message.fromName || message.fromEmail;
    return `- ${date ? date.toISOString().slice(0, 16) : "sin fecha"} · ${speaker}: ${body}`;
  });

  return compactBlock("Conversación reciente", [
    `Asunto del hilo: ${thread.subject ?? "(sin asunto)"}`,
    ...messages,
  ]);
}

function currentDraftBlock(input: GenerateEmailDraftValues) {
  if (!clean(input.subject) && !clean(input.bodyText)) return "";
  return compactBlock("Borrador actual", [
    clean(input.subject) ? `Asunto actual: ${input.subject}` : null,
    clean(input.bodyText) ? `Cuerpo actual:\n${limitText(input.bodyText, 1_500)}` : null,
  ]);
}

function styleBlock(samples: string[]) {
  if (samples.length === 0) {
    return "## Tono del usuario\nNo hay muestras suficientes. Usa un tono comercial natural, claro y profesional.";
  }
  return compactBlock(
    "Tono del usuario",
    samples.map((sample, index) => `Muestra ${index + 1}:\n${sample}`),
  );
}

function recipientBlock(input: GenerateEmailDraftValues) {
  const recipients = input.to.map((recipient) =>
    [recipient.name, recipient.email].filter(Boolean).join(" · "),
  );
  return compactBlock("Destinatario", recipients);
}

function buildPrompt(input: {
  data: GenerateEmailDraftValues;
  deal: Awaited<ReturnType<typeof loadDeal>> | null;
  organization:
    | Awaited<ReturnType<typeof loadOrganization>>
    | LoadedThread["organization"]
    | null;
  person:
    | Awaited<ReturnType<typeof loadPerson>>
    | LoadedThread["person"]
    | null;
  samples: string[];
  thread: LoadedThread | null;
}) {
  const { data, deal, organization, person, samples, thread } = input;
  const blocks = [
    `Modo: ${data.mode === "reply" ? "respuesta a un hilo existente" : "nuevo email 1:1"}`,
    `Tono deseado: ${toneLabels[data.tone]}`,
    clean(data.instruction)
      ? `Objetivo indicado por el usuario: ${data.instruction}`
      : "Objetivo indicado por el usuario: redactar un email comercial útil y prudente.",
    recipientBlock(data),
    personBlock(person ?? deal?.person ?? thread?.person ?? null),
    organizationBlock(organization ?? deal?.organization ?? thread?.organization ?? null),
    dealBlock(deal ?? thread?.deal ?? null),
    threadBlock(thread),
    currentDraftBlock(data),
    styleBlock(samples),
  ].filter(Boolean);

  return blocks.join("\n\n");
}

function systemPrompt(mode: GenerateEmailDraftValues["mode"]) {
  return [
    "Eres un asistente experto en ventas B2B para Nexo CRM.",
    "Redactas emails 1:1 listos para editar antes de enviar.",
    "Imita el tono del usuario a partir de sus muestras sin copiar frases literales.",
    "No inventes datos, precios, reuniones, adjuntos, descuentos ni compromisos.",
    "No incluyas firma, porque Nexo CRM añade la firma del buzón al enviar.",
    "No uses markdown, listas decorativas ni HTML; devuelve texto plano natural.",
    "Si el hilo está en otro idioma, responde en ese idioma; si no, escribe en español.",
    mode === "reply"
      ? "Para respuestas, conserva el asunto del hilo y contesta a lo último relevante."
      : "Para emails nuevos, crea un asunto concreto y un cuerpo breve con llamada a siguiente paso.",
  ].join("\n");
}

export async function generateAssistedEmailDraft(
  ownerId: string,
  raw: GenerateEmailDraftValues,
): Promise<AssistedEmailDraft> {
  const data = raw;
  const [thread, person, organization, deal, samples] = await Promise.all([
    loadThread(ownerId, clean(data.threadId)),
    loadPerson(ownerId, clean(data.personId)),
    loadOrganization(ownerId, clean(data.orgId)),
    loadDeal(ownerId, clean(data.dealId)),
    loadToneSamples(ownerId),
  ]);

  const prompt = buildPrompt({
    data,
    deal,
    organization,
    person,
    samples,
    thread,
  });
  const result = await completeAI<GeneratedEmailDraftValues>({
    feature: data.mode === "reply" ? "email.reply_draft" : "email.draft",
    maxTokens: 1_200,
    messages: [{ content: prompt, role: "user" }],
    modelPreference: "fast",
    ownerId,
    requestSummary: {
      currentDraftChars: data.bodyText?.length ?? 0,
      hasDeal: Boolean(data.dealId || thread?.dealId),
      hasInstruction: Boolean(data.instruction),
      hasPerson: Boolean(data.personId || thread?.personId),
      hasThread: Boolean(data.threadId),
      mode: data.mode,
      recipientCount: data.to.length,
      styleSamples: samples.length,
      tone: data.tone,
    },
    schema: generatedEmailDraftSchema,
    schemaName: "email_draft",
    system: systemPrompt(data.mode),
    temperature: data.tone === "brief" || data.tone === "direct" ? 0.35 : 0.55,
  });

  if (!result.data) {
    throw new Error("La IA no devolvió un borrador válido.");
  }

  const subject =
    data.mode === "reply" && thread?.subject
      ? thread.subject
      : result.data.subject;
  const bodyText = result.data.bodyText.trim();

  return {
    bodyHtml: textToHtml(bodyText),
    bodyText,
    estimatedCostUsd: result.estimatedCostUsd,
    model: result.model,
    provider: result.provider,
    runId: result.runId,
    subject: subject.trim(),
    usage: result.usage,
  };
}
