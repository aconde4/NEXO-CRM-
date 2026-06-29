"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { textToHtml } from "@/lib/email/merge-tags";
import {
  SALES_EMAIL_TEMPLATES,
  SALES_TEMPLATE_CATEGORY,
} from "@/lib/email/sales-templates";
import { requireUser } from "@/lib/session";
import {
  emailTemplateSchema,
  type EmailTemplateValues,
} from "@/lib/validations/email-template";
import { db } from "@/server/db";
import { emailTemplates } from "@/server/db/schema";
import { sanitizeEmailHtml } from "@/server/services/email-html";

const TAG_RE = /\{\{\s*([\w.]+)/g;

/** Extrae las claves de variables usadas en el asunto y el cuerpo. */
function extractVariables(...parts: string[]): string[] {
  const found = new Set<string>();
  for (const part of parts) {
    for (const match of part.matchAll(TAG_RE)) {
      if (match[1]) found.add(match[1]);
    }
  }
  return [...found];
}

function revalidate() {
  revalidatePath("/settings");
  revalidatePath("/emails/compose");
}

function bodyHtmlFrom(data: EmailTemplateValues): string {
  const html = data.bodyHtml.trim();
  return sanitizeEmailHtml(html || textToHtml(data.bodyText));
}

export async function createEmailTemplate(raw: EmailTemplateValues) {
  const user = await requireUser();
  const data = emailTemplateSchema.parse(raw);

  try {
    const bodyHtml = bodyHtmlFrom(data);
    const [row] = await db
      .insert(emailTemplates)
      .values({
        ownerId: user.id,
        name: data.name.trim(),
        subject: data.subject.trim(),
        bodyText: data.bodyText,
        bodyHtml,
        variables: extractVariables(data.subject, data.bodyText, bodyHtml),
      })
      .returning({ id: emailTemplates.id });
    if (!row) throw new Error("No se pudo crear la plantilla");
    revalidate();
    return { id: row.id };
  } catch (error) {
    if (error instanceof Error && /unique/i.test(error.message)) {
      throw new Error("Ya tienes una plantilla con ese nombre.");
    }
    throw error;
  }
}

export async function installSalesEmailTemplates() {
  const user = await requireUser();
  const names = SALES_EMAIL_TEMPLATES.map((template) => template.name);
  const existingRows = await db
    .select({ name: emailTemplates.name })
    .from(emailTemplates)
    .where(
      and(
        eq(emailTemplates.ownerId, user.id),
        inArray(emailTemplates.name, names),
      ),
    );
  const existing = new Set(existingRows.map((row) => row.name));
  const missing = SALES_EMAIL_TEMPLATES.filter(
    (template) => !existing.has(template.name),
  );

  if (missing.length > 0) {
    await db
      .insert(emailTemplates)
      .values(
        missing.map((template) => {
          const bodyHtml = textToHtml(template.bodyText);
          return {
            bodyHtml,
            bodyText: template.bodyText,
            category: SALES_TEMPLATE_CATEGORY,
            name: template.name,
            ownerId: user.id,
            subject: template.subject,
            variables: extractVariables(
              template.subject,
              template.bodyText,
              bodyHtml,
            ),
          };
        }),
      )
      .onConflictDoNothing();
  }

  revalidate();
  return {
    inserted: missing.length,
    total: SALES_EMAIL_TEMPLATES.length,
  };
}

export async function updateEmailTemplate(
  id: string,
  raw: EmailTemplateValues,
) {
  const user = await requireUser();
  const data = emailTemplateSchema.parse(raw);
  const bodyHtml = bodyHtmlFrom(data);

  await db
    .update(emailTemplates)
    .set({
      name: data.name.trim(),
      subject: data.subject.trim(),
      bodyText: data.bodyText,
      bodyHtml,
      variables: extractVariables(data.subject, data.bodyText, bodyHtml),
    })
    .where(and(eq(emailTemplates.id, id), eq(emailTemplates.ownerId, user.id)));
  revalidate();
  return { id };
}

export async function deleteEmailTemplate(id: string) {
  const user = await requireUser();
  await db
    .delete(emailTemplates)
    .where(and(eq(emailTemplates.id, id), eq(emailTemplates.ownerId, user.id)));
  revalidate();
  return { id };
}
