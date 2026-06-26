import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";

import { fullName } from "@/lib/format";
import {
  leadScoreResultSchema,
  type LeadScoreResultValues,
} from "@/lib/validations/ai-lead-score";
import { completeAI } from "@/server/services/ai";
import { db } from "@/server/db";
import {
  activities,
  emailThreads,
  formSubmissions,
  forms,
  leads,
  notes,
  organizations,
  persons,
} from "@/server/db/schema";

export type LeadScoreResult = LeadScoreResultValues & {
  leadId: string;
  estimatedCostUsd: number;
  model: string;
  provider: string;
  runId: string;
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

function valueToText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return clean(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const items = value.flatMap((item) => valueToText(item) ?? []);
    return items.length ? items.join(", ") : null;
  }
  return null;
}

function fieldsLine(label: string, values: Record<string, unknown> | null | undefined) {
  const entries = Object.entries(values ?? {})
    .flatMap(([key, value]) => {
      const text = valueToText(value);
      return text ? [`${key}: ${text}`] : [];
    })
    .slice(0, 12);
  return entries.length ? `${label}: ${entries.join(" | ")}` : null;
}

function block(title: string, lines: Array<string | null | undefined>) {
  const body = lines.filter(Boolean).join("\n");
  return body ? `## ${title}\n${body}` : "";
}

async function buildLeadContext(ownerId: string, leadId: string) {
  const [lead] = await db
    .select({
      id: leads.id,
      source: leads.source,
      status: leads.status,
      score: leads.score,
      createdAt: leads.createdAt,
      convertedDealId: leads.convertedDealId,
      personId: persons.id,
      firstName: persons.firstName,
      lastName: persons.lastName,
      email: persons.email,
      phone: persons.phone,
      title: persons.title,
      personSource: persons.source,
      campaign: persons.campaign,
      marketingStatus: persons.marketingStatus,
      personCustomFields: persons.customFields,
      orgName: organizations.name,
      orgIndustry: organizations.industry,
      orgSize: organizations.size,
      submissionData: formSubmissions.data,
      formName: forms.name,
    })
    .from(leads)
    .leftJoin(persons, eq(leads.personId, persons.id))
    .leftJoin(organizations, eq(persons.orgId, organizations.id))
    .leftJoin(formSubmissions, eq(leads.submissionId, formSubmissions.id))
    .leftJoin(forms, eq(formSubmissions.formId, forms.id))
    .where(and(eq(leads.id, leadId), eq(leads.ownerId, ownerId)))
    .limit(1);

  if (!lead) throw new Error("Lead no encontrado o sin permisos.");

  // Señales de interacción (solo si hay contacto asociado).
  let activityCount = 0;
  let noteCount = 0;
  let threadCount = 0;
  if (lead.personId) {
    [activityCount, noteCount, threadCount] = await Promise.all([
      db.$count(activities, and(eq(activities.ownerId, ownerId), eq(activities.personId, lead.personId))),
      db.$count(notes, and(eq(notes.ownerId, ownerId), eq(notes.personId, lead.personId))),
      db.$count(
        emailThreads,
        and(
          eq(emailThreads.ownerId, ownerId),
          eq(emailThreads.personId, lead.personId),
          isNull(emailThreads.deletedAt),
        ),
      ),
    ]);
  }

  const name = lead.personId
    ? fullName(lead.firstName ?? "", lead.lastName) || "Sin nombre"
    : "Sin contacto";

  const prompt = [
    `Fecha actual: ${new Date().toISOString().slice(0, 10)}`,
    block("Lead", [
      `Estado: ${leadStatusLabels[lead.status] ?? lead.status}`,
      `Recibido: ${lead.createdAt.toISOString().slice(0, 10)}`,
      clean(lead.source) ? `Origen: ${lead.source}` : null,
      clean(lead.formName) ? `Formulario: ${lead.formName}` : null,
      lead.convertedDealId ? "Ya convertido a negocio" : null,
    ]),
    block("Contacto", [
      `Nombre: ${name}`,
      clean(lead.email) ? `Email: ${lead.email}` : "Sin email",
      clean(lead.phone) ? `Telefono: ${lead.phone}` : "Sin telefono",
      clean(lead.title) ? `Cargo: ${lead.title}` : null,
      clean(lead.personSource) ? `Origen contacto: ${lead.personSource}` : null,
      clean(lead.campaign) ? `Campana: ${lead.campaign}` : null,
      lead.marketingStatus ? `Marketing: ${lead.marketingStatus}` : null,
      fieldsLine("Campos personalizados", lead.personCustomFields),
    ]),
    block("Empresa", [
      clean(lead.orgName) ? `Nombre: ${lead.orgName}` : "Sin empresa",
      clean(lead.orgIndustry) ? `Sector: ${lead.orgIndustry}` : null,
      clean(lead.orgSize) ? `Tamano: ${lead.orgSize}` : null,
    ]),
    fieldsLine("Respuestas del formulario", lead.submissionData)
      ? block("Formulario enviado", [
          fieldsLine("Respuestas", lead.submissionData),
        ])
      : "",
    block("Interaccion", [
      `Tareas/actividades: ${activityCount}`,
      `Notas: ${noteCount}`,
      `Hilos de email: ${threadCount}`,
    ]),
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    prompt,
    person: lead.personId ? { id: lead.personId, name } : null,
    stats: { activities: activityCount, notes: noteCount, emailThreads: threadCount },
  };
}

function systemPrompt(): string {
  return [
    "Eres un analista de cualificacion de leads B2B dentro de Nexo CRM.",
    "Puntua de 0 a 100 la calidad y la intencion de compra del lead usando SOLO los hechos del contexto.",
    "Escala: 70-100 = caliente (alta intencion y buen encaje), 40-69 = templado, 0-39 = frio.",
    "Sube la puntuacion con: datos de contacto completos (email/telefono/empresa/cargo), respuestas de formulario con intencion clara (demo, presupuesto, plazos), origen/campana de calidad e interaccion previa (emails, tareas).",
    "Bajala con: datos incompletos, respuestas vagas o de bajo interes, o senales de spam.",
    "No inventes nada que no este en el contexto. Si hay poca informacion, puntua conservador y dilo en la justificacion.",
    "Devuelve EXCLUSIVAMENTE JSON valido que cumpla el esquema indicado, en espanol.",
  ].join("\n");
}

export async function scoreLead(
  ownerId: string,
  leadId: string,
): Promise<LeadScoreResult> {
  const context = await buildLeadContext(ownerId, leadId);

  const result = await completeAI<LeadScoreResultValues>({
    feature: "lead.score",
    maxTokens: 500,
    messages: [{ content: context.prompt, role: "user" }],
    modelPreference: "fast",
    ownerId,
    requestSummary: { ...context.stats },
    schema: leadScoreResultSchema,
    schemaName: "lead_score",
    system: systemPrompt(),
    temperature: 0.1,
  });

  if (!result.data) {
    throw new Error("La IA no devolvio una puntuacion valida.");
  }

  await db
    .update(leads)
    .set({
      score: result.data.score,
      scoreReason: result.data.rationale,
      scoredAt: new Date(),
    })
    .where(and(eq(leads.id, leadId), eq(leads.ownerId, ownerId)));

  return {
    ...result.data,
    estimatedCostUsd: result.estimatedCostUsd,
    leadId,
    model: result.model,
    provider: result.provider,
    runId: result.runId,
  };
}

export type ScoreNewLeadsResult = {
  scored: number;
  failed: number;
  total: number;
};

/** Puntúa en lote los leads `new` aún sin puntuar (acotado por `limit`). */
export async function scoreNewLeads(
  ownerId: string,
  limit: number,
): Promise<ScoreNewLeadsResult> {
  const pending = await db
    .select({ id: leads.id })
    .from(leads)
    .where(
      and(
        eq(leads.ownerId, ownerId),
        eq(leads.status, "new"),
        isNull(leads.scoredAt),
      ),
    )
    .orderBy(asc(leads.createdAt))
    .limit(limit);

  let scored = 0;
  let failed = 0;
  for (const lead of pending) {
    try {
      await scoreLead(ownerId, lead.id);
      scored += 1;
    } catch (error) {
      failed += 1;
      console.error("No se pudo puntuar el lead", lead.id, error);
    }
  }

  return { failed, scored, total: pending.length };
}
