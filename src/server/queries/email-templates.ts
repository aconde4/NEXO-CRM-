import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";

import { requireUser } from "@/lib/session";
import { db } from "@/server/db";
import { emailTemplates } from "@/server/db/schema";

export type EmailTemplateItem = {
  category: string | null;
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  variables: string[];
};

export async function listEmailTemplates(): Promise<EmailTemplateItem[]> {
  const user = await requireUser();
  const rows = await db
    .select({
      id: emailTemplates.id,
      name: emailTemplates.name,
      subject: emailTemplates.subject,
      bodyHtml: emailTemplates.bodyHtml,
      bodyText: emailTemplates.bodyText,
      category: emailTemplates.category,
      variables: emailTemplates.variables,
    })
    .from(emailTemplates)
    .where(
      and(
        eq(emailTemplates.ownerId, user.id),
        isNull(emailTemplates.archivedAt),
      ),
    )
    .orderBy(asc(emailTemplates.name));
  return rows.map((r) => ({
    id: r.id,
    category: r.category,
    name: r.name,
    subject: r.subject,
    bodyHtml: r.bodyHtml,
    bodyText: r.bodyText ?? "",
    variables: r.variables,
  }));
}
