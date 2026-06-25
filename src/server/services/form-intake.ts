import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { db } from "@/server/db";
import {
  type AutomationRunLogEntry,
  automationRuns,
  automations,
  formSubmissions,
  forms,
  leads,
  organizations,
  persons,
} from "@/server/db/schema";
import { executeAutomationRun } from "@/server/services/automation-executor";
import { emitAutomationEventSafely } from "@/server/services/automation-runner";

/**
 * Recepción de envíos de formulario (Fase 7.4). Aplica los mapeos para crear/encontrar
 * la persona (dedupe por email), guarda el envío y crea un lead, y dispara la
 * automatización (evento `form_submitted` + automatización directa del formulario).
 * Es **pública** (sin sesión): el `ownerId` sale del propio formulario.
 */

export type FormSubmitInput = {
  formId: string;
  data: Record<string, string>;
  ip: string | null;
  userAgent: string | null;
};

export type FormSubmitResult =
  | { ok: true; redirectTo: string; leadId: string | null }
  | { ok: false; reason: "not_found" };

const NATIVE_PERSON_KEYS = new Set([
  "firstName",
  "lastName",
  "email",
  "phone",
  "title",
  "source",
  "campaign",
]);

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function successRedirect(formId: string, redirectUrl: string | null): string {
  const url = redirectUrl?.trim();
  return url ? url : `/f/${formId}?ok=1`;
}

export async function submitForm(
  input: FormSubmitInput,
): Promise<FormSubmitResult> {
  const [form] = await db
    .select({
      id: forms.id,
      ownerId: forms.ownerId,
      name: forms.name,
      status: forms.status,
      mappings: forms.mappings,
      redirectUrl: forms.redirectUrl,
      automationId: forms.automationId,
    })
    .from(forms)
    .where(eq(forms.id, input.formId))
    .limit(1);

  if (!form || form.status !== "active") return { ok: false, reason: "not_found" };

  const ownerId = form.ownerId;
  const redirectTo = successRedirect(form.id, form.redirectUrl);

  // Honeypot anti-spam (7.6): si el campo oculto viene relleno, lo descartamos en
  // silencio (respondemos "ok" para no dar pistas al bot).
  if (asText(input.data._hp)) {
    return { ok: true, redirectTo, leadId: null };
  }

  // Datos a guardar (sin el honeypot).
  const cleanData: Record<string, string> = {};
  for (const [key, value] of Object.entries(input.data)) {
    if (key !== "_hp") cleanData[key] = value;
  }

  // Resuelve los valores mapeados a persona/empresa.
  const personValues: Record<string, string> = {};
  const customFields: Record<string, unknown> = {};
  let orgName = "";
  for (const mapping of form.mappings ?? []) {
    const raw = asText(input.data[mapping.field]);
    if (!raw) continue;
    if (mapping.target === "organization.name") {
      orgName = raw;
    } else if (mapping.target.startsWith("person.custom:")) {
      customFields[mapping.target.slice("person.custom:".length)] = raw;
    } else if (mapping.target.startsWith("person.")) {
      const key = mapping.target.slice("person.".length);
      if (NATIVE_PERSON_KEYS.has(key)) personValues[key] = raw;
    }
  }

  const source = personValues.source || `Formulario: ${form.name}`;

  // Empresa: encuentra por nombre (case-insensitive) o créala.
  let orgId: string | null = null;
  if (orgName) {
    const [existingOrg] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(
        and(
          eq(organizations.ownerId, ownerId),
          sql`lower(${organizations.name}) = ${orgName.toLowerCase()}`,
        ),
      )
      .limit(1);
    if (existingOrg) {
      orgId = existingOrg.id;
    } else {
      const [created] = await db
        .insert(organizations)
        .values({ name: orgName, ownerId })
        .returning({ id: organizations.id });
      orgId = created?.id ?? null;
    }
  }

  // Persona: dedupe por email (case-insensitive).
  const email = personValues.email || null;
  const emailLower = email?.toLowerCase();
  let personId: string | null = null;
  if (emailLower) {
    const [existing] = await db
      .select({ id: persons.id })
      .from(persons)
      .where(
        and(
          eq(persons.ownerId, ownerId),
          sql`lower(${persons.email}) = ${emailLower}`,
        ),
      )
      .limit(1);
    personId = existing?.id ?? null;
  }

  if (personId) {
    // Persona existente: no pisamos sus datos; enriquecemos campos personalizados y
    // la empresa solo si estaba vacía.
    const hasCustom = Object.keys(customFields).length > 0;
    if (hasCustom || orgId) {
      await db
        .update(persons)
        .set({
          ...(hasCustom
            ? {
                customFields: sql`coalesce(${persons.customFields}, '{}'::jsonb) || ${JSON.stringify(
                  customFields,
                )}::jsonb`,
              }
            : {}),
          ...(orgId ? { orgId: sql`coalesce(${persons.orgId}, ${orgId})` } : {}),
        })
        .where(and(eq(persons.id, personId), eq(persons.ownerId, ownerId)));
    }
  } else {
    const firstName =
      personValues.firstName || (email ? email.split("@")[0]! : "Lead");
    const [created] = await db
      .insert(persons)
      .values({
        firstName: firstName || "Lead",
        lastName: personValues.lastName || null,
        email,
        phone: personValues.phone || null,
        title: personValues.title || null,
        source,
        campaign: personValues.campaign || null,
        orgId,
        ownerId,
        customFields,
      })
      .returning({ id: persons.id });
    personId = created?.id ?? null;
  }

  // Guarda el envío.
  const [submission] = await db
    .insert(formSubmissions)
    .values({
      ownerId,
      formId: form.id,
      data: cleanData,
      personId,
      ip: input.ip,
      userAgent: input.userAgent,
    })
    .returning({ id: formSubmissions.id });

  // Crea el lead (bandeja previa a negocio).
  const [lead] = await db
    .insert(leads)
    .values({
      ownerId,
      personId,
      submissionId: submission?.id ?? null,
      source: `Formulario: ${form.name}`,
      status: "new",
    })
    .returning({ id: leads.id });

  // Dispara automatizaciones.
  const payload = {
    formId: form.id,
    formName: form.name,
    leadId: lead?.id ?? null,
    submissionId: submission?.id ?? null,
  };
  if (personId) {
    // Evento general: automatizaciones con el disparador "Formulario enviado".
    await emitAutomationEventSafely({
      type: "form_submitted",
      ownerId,
      entityType: "person",
      entityId: personId,
      payload,
    });
    // Automatización directa del formulario (best-effort, sin bloquear si falla).
    if (form.automationId) {
      await runFormAutomation({
        automationId: form.automationId,
        ownerId,
        personId,
        payload,
      }).catch((error) => {
        console.error("No se pudo ejecutar la automatización del formulario", error);
      });
    }
  }

  return { ok: true, redirectTo, leadId: lead?.id ?? null };
}

/**
 * Ejecuta la automatización vinculada directamente al formulario, en proceso (las
 * esperas se omiten, como en la prueba en seco). Se salta las que ya cubre el evento
 * `form_submitted` para no ejecutarlas dos veces.
 */
async function runFormAutomation(input: {
  automationId: string;
  ownerId: string;
  personId: string;
  payload: Record<string, unknown>;
}) {
  const [automation] = await db
    .select({
      id: automations.id,
      graph: automations.graph,
      version: automations.version,
      name: automations.name,
      status: automations.status,
      triggerType: automations.triggerType,
    })
    .from(automations)
    .where(
      and(
        eq(automations.id, input.automationId),
        eq(automations.ownerId, input.ownerId),
      ),
    )
    .limit(1);

  if (!automation || automation.status !== "active") return;
  // Ya se ejecuta por el evento general: evitar doble ejecución.
  if (automation.triggerType === "form_submitted") return;

  const now = new Date();
  const log: AutomationRunLogEntry[] = [
    {
      at: now.toISOString(),
      detail: { source: "form" },
      kind: "form_submitted",
      message: "Disparado por un envío de formulario.",
      nodeId: "trigger",
      status: "waiting",
    },
  ];

  const [run] = await db
    .insert(automationRuns)
    .values({
      automationId: automation.id,
      automationVersion: automation.version,
      context: {
        automationName: automation.name,
        graph: automation.graph ?? { edges: [], nodes: [] },
        state: "form_intake",
      },
      entityId: input.personId,
      entityType: "person",
      log,
      ownerId: input.ownerId,
      startedAt: now,
      status: "waiting",
      triggerEvent: {
        ...input.payload,
        entityId: input.personId,
        entityType: "person",
        ownerId: input.ownerId,
        source: "form",
      },
      triggerType: automation.triggerType,
    })
    .returning({ id: automationRuns.id });

  if (run) await executeAutomationRun(run.id);
}
